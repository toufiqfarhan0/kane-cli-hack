import { execFile } from "node:child_process";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { writeFile } from "node:fs/promises";
import { BlockList, isIP } from "node:net";
import type { NormalizedProduct } from "@postready/core";
import { Agent, fetch } from "undici";
import { UA, currencyFromHtml, scrapeHtml, shopifyHandle, shopifyProduct } from "./page-parser.js";

export { scrapeHtml };

const MAX_BYTES = 25 * 1024 * 1024;

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, bits, "ipv6");
}

function embeddedV4(ip: string): string | null {
  const tail = ip.split(":").slice(-2);
  if (tail[1]?.includes(".")) return tail[1];
  const [hi, lo] = tail.map((h) => parseInt(h || "0", 16));
  if (![hi, lo].every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff)) return null;
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
}

export function isPrivate(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return blocked.check(ip, "ipv4");
  if (fam !== 6) return true;
  if (blocked.check(ip, "ipv6")) return true;
  const v = ip.toLowerCase();
  if (/^(::ffff:|::|64:ff9b::)/.test(v)) {
    const v4 = embeddedV4(v);
    return !v4 || isIP(v4) !== 4 || blocked.check(v4, "ipv4");
  }
  return false;
}

type LookupCb = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

function guardedLookup(
  hostname: string,
  options: { all?: boolean },
  cb: LookupCb,
): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) {
      cb(err, "");
      return;
    }
    const list = Array.isArray(addrs) ? addrs : [];
    const bad = list.find((a) => isPrivate(a.address));
    if (bad || !list.length) {
      cb(new Error(`Blocked private or local address: ${hostname}`), "");
      return;
    }
    list.sort((a, b) => a.family - b.family);
    if (options.all) {
      cb(null, list);
    } else {
      cb(null, list[0].address, list[0].family);
    }
  });
}

const dispatcher = new Agent({
  connect: {
    lookup: guardedLookup as never,
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 400,
    timeout: 15000,
  },
  headersTimeout: 20000,
  bodyTimeout: 30000,
});

const VIA_CURL = process.env.FETCH_VIA === "curl";

function resolvePublic(hostname: string): Promise<LookupAddress> {
  return new Promise((resolve, reject) => {
    guardedLookup(hostname, { all: true }, (err, addrs) => {
      if (err) reject(err);
      else resolve((addrs as LookupAddress[])[0]);
    });
  });
}

async function curlOnce(
  u: URL,
  accept: string,
): Promise<{
  status: number;
  headers: { get: (n: string) => string | null };
  buffer: Buffer;
  body?: undefined;
}> {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addr = isIP(host) ? { address: host, family: isIP(host) } : await resolvePublic(host);
  const pin = `${u.hostname}:${u.port || (u.protocol === "https:" ? 443 : 80)}:${
    addr.family === 6 ? `[${addr.address}]` : addr.address
  }`;
  const stdout = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      "curl",
      [
        "-sS",
        "--proto",
        "=http,https",
        "--max-redirs",
        "0",
        "--max-time",
        "25",
        "--max-filesize",
        String(MAX_BYTES),
        "--resolve",
        pin,
        "--compressed",
        "-A",
        UA,
        "-H",
        `accept: ${accept}`,
        "-H",
        "accept-language: en-US,en;q=0.9",
        "-D",
        "-",
        "-o",
        "-",
        "--",
        u.href,
      ],
      { encoding: "buffer", maxBuffer: MAX_BYTES + (1 << 16) },
      (err, out) => {
        if (err) reject(err);
        else resolve(out);
      },
    );
  });
  const cut = stdout.indexOf("\r\n\r\n");
  const head = stdout.subarray(0, cut).toString("latin1").split("\r\n");
  const status = Number(head[0].split(" ")[1]);
  const headers = new Map(
    head
      .slice(1)
      .map((l): [string, string] => [
        l.slice(0, l.indexOf(":")).toLowerCase(),
        l.slice(l.indexOf(":") + 1).trim(),
      ]),
  );
  return {
    status,
    headers: { get: (n: string) => headers.get(n.toLowerCase()) ?? null },
    buffer: stdout.subarray(cut + 4),
  };
}

async function readCapped(body: AsyncIterable<Uint8Array> | null | undefined): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("Response too large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

interface GuardedResponse {
  ok: true;
  status: number;
  headers: { get: (name: string) => string | null };
  buffer: Buffer;
  text: () => Promise<string>;
  json: <T = unknown>() => Promise<T>;
}

async function get(url: string, accept = "text/html"): Promise<GuardedResponse> {
  let current = url;
  let retries = 0;
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(current);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`Blocked non-http URL: ${u.protocol}`);
    }
    if (u.username || u.password) throw new Error("Blocked URL with credentials");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && isPrivate(host)) {
      throw new Error(`Blocked private or local address: ${u.hostname}`);
    }
    let res: Awaited<ReturnType<typeof curlOnce>> | Awaited<ReturnType<typeof fetch>>;
    try {
      res = VIA_CURL
        ? await curlOnce(u, accept)
        : await fetch(u, {
            dispatcher,
            redirect: "manual",
            headers: {
              "user-agent": UA,
              accept,
              "accept-language": "en-US,en;q=0.9",
            },
          });
    } catch (e) {
      const err = e as { cause?: { message?: string }; message?: string };
      throw new Error(err?.cause?.message ?? err.message ?? "Fetch failed");
    }
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      if ("body" in res && res.body) await res.body.cancel();
      current = new URL(loc, u).href;
      continue;
    }
    if (res.status === 429 && retries < 3) {
      if ("body" in res && res.body) await res.body.cancel();
      await new Promise((r) => setTimeout(r, [1200, 3000, 6000][retries++]));
      hop--;
      continue;
    }
    if (res.status === 429) {
      throw new Error("That store is rate-limiting requests right now. Try again in a minute.");
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`${res.status} fetching ${url}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      throw new Error(`Response too large: ${url}`);
    }
    const buffer =
      "buffer" in res && Buffer.isBuffer(res.buffer)
        ? res.buffer
        : await readCapped("body" in res ? (res.body ?? null) : null);
    return {
      ok: true,
      status: res.status,
      headers: res.headers,
      buffer,
      text: async () => buffer.toString("utf8"),
      json: async <T = unknown>() => JSON.parse(buffer.toString("utf8")) as T,
    };
  }
  throw new Error(`Too many redirects: ${url}`);
}

async function shopify(
  url: string,
): Promise<(NormalizedProduct & { html?: string }) | { html: string } | null> {
  const handle = shopifyHandle(url);
  if (!handle) return null;
  const u = new URL(url);
  const [json, html] = await Promise.all([
    get(`${u.origin}/products/${handle}.json`, "application/json")
      .then((r) => r.json<{ product?: Record<string, unknown> }>())
      .catch(() => null),
    get(url)
      .then((r) => r.text())
      .catch(() => ""),
  ]);
  if (!json) return html ? { html } : null;
  return shopifyProduct(json, url, currencyFromHtml(html));
}

export async function scrape(url: string, html?: string): Promise<NormalizedProduct> {
  if (html) return scrapeHtml(html, url);
  const s = await shopify(url);
  if (s && "images" in s && s.images.length) return s;
  const fallbackHtml = s && "html" in s && s.html ? s.html : await (await get(url)).text();
  return scrapeHtml(fallbackHtml, url);
}

export type ImageKind = "jpg" | "png" | "webp" | "avif";

export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buf.toString("latin1", 4, 8) === "ftyp" && /^(avif|avis)$/.test(buf.toString("latin1", 8, 12))) {
    return "avif";
  }
  return null;
}

export async function download(src: string, dest: string): Promise<ImageKind> {
  const res = await get(src, "image/avif,image/webp,image/*,*/*");
  const kind = sniffImage(res.buffer);
  if (!kind) throw new Error("Not a supported image");
  await writeFile(dest, res.buffer);
  return kind;
}

/** Merge live Kane browser DOM extractions with HTTP/Shopify metadata without duplicates. */
export function mergeProductData(
  base: NormalizedProduct | null,
  kane: Partial<NormalizedProduct> & { url: string },
): NormalizedProduct {
  const u = new URL(kane.url);
  const domain = u.hostname.replace(/^www\./, "");
  const imgs = [...(kane.images ?? []), ...(base?.images ?? [])].filter(
    (s, i, a) => Boolean(s) && a.indexOf(s) === i,
  );
  const bullets = [...(kane.bullets ?? []), ...(base?.bullets ?? [])].filter(
    (s, i, a) => Boolean(s) && a.indexOf(s) === i,
  );
  const finalPrice = kane.price ?? base?.price ?? null;
  let finalCompareAt = kane.compareAt ?? base?.compareAt ?? null;
  if (finalCompareAt && finalPrice) {
    const pNum = parseFloat(String(finalPrice).replace(/[^0-9.]/g, ""));
    const cNum = parseFloat(String(finalCompareAt).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(cNum) || !Number.isFinite(pNum) || cNum <= pNum) {
      finalCompareAt = null;
    }
  }
  return {
    source: base?.source ?? kane.source ?? "kane",
    url: kane.url,
    domain: kane.domain || base?.domain || domain,
    brand: kane.brand || base?.brand || domain.split(".")[0] || domain,
    title: kane.title || base?.title || domain,
    price: finalPrice,
    compareAt: finalCompareAt,
    description: (base?.description || kane.description || bullets.join(" ")).slice(0, 1500),
    bullets: bullets.slice(0, 6),
    tags: base?.tags?.length ? base.tags : kane.tags ?? [],
    images: imgs.slice(0, 8),
  };
}
