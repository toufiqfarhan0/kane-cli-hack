import type { NormalizedProduct } from "@postready/core";

export const UA = "postready/0.1 (product short studio)";

export const strip = (html: string): string =>
  String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

export const money = (v: unknown, currency = "USD"): string | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const sym: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "$",
    AUD: "$",
    INR: "₹",
    SEK: "kr ",
  };
  return (sym[currency] ?? "$") + (Number.isInteger(n) ? String(n) : n.toFixed(2));
};

export const shopifyHandle = (url: string): string | null =>
  new URL(url).pathname.match(/\/products\/([^/?#]+)/)?.[1] ?? null;

export const currencyFromHtml = (html: string): string =>
  html.match(/"currency"\s*:\s*"([A-Z]{3})"/)?.[1] ??
  html.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/)?.[1] ??
  "USD";

export function shopifyProduct(
  data: { product?: Record<string, unknown> } | null | undefined,
  url: string,
  currency = "USD",
): NormalizedProduct | null {
  const u = new URL(url);
  const p = data?.product as
    | {
        vendor?: string;
        title?: string;
        body_html?: string;
        tags?: string[] | string;
        variants?: Array<{ price?: string | number; compare_at_price?: string | number }>;
        images?: Array<{ src?: string }>;
      }
    | undefined;
  if (!p) return null;
  const v = p.variants?.[0] ?? {};
  const price = money(v.price, currency);
  const compareAt =
    v.compare_at_price && Number(v.compare_at_price) > Number(v.price)
      ? money(v.compare_at_price, currency)
      : null;
  const domain = u.hostname.replace(/^www\./, "");
  return {
    source: "shopify",
    url,
    domain,
    brand: p.vendor || domain.split(".")[0] || domain,
    title: String(p.title ?? ""),
    price,
    compareAt,
    description: strip(p.body_html ?? "").slice(0, 1500),
    bullets: [],
    tags: Array.isArray(p.tags)
      ? p.tags.slice(0, 12)
      : String(p.tags || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12),
    images: (p.images ?? [])
      .map((i) => i.src)
      .filter((s): s is string => Boolean(s))
      .slice(0, 8),
  };
}

function fromJsonLd(html: string): Record<string, unknown> | null {
  const blocks = [
    ...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);
  for (const raw of blocks) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.trim()) as Record<string, unknown>;
    } catch {
      continue;
    }
    const graph = parsed?.["@graph"];
    const nodes = (Array.isArray(graph) ? graph : [graph ?? parsed]) as Array<
      Record<string, unknown>
    >;
    const found = nodes.find((n) => {
      const t = n?.["@type"];
      return Array.isArray(t) ? t.includes("Product") : t === "Product";
    });
    if (found) return found;
  }
  return null;
}

const meta = (html: string, name: string): string | undefined =>
  html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  )?.[1] ??
  html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
  )?.[1];

function amazon(html: string, url: string): NormalizedProduct | null {
  const title = strip(html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
  if (!title) return null;
  const images = [...new Set([...html.matchAll(/"hiRes":"(https:[^"]+)"/g)].map((m) => m[1]))];
  if (!images.length) {
    const land =
      html.match(/id="landingImage"[^>]+data-old-hires="([^"]+)"/)?.[1] ??
      html.match(/id="landingImage"[^>]+src="([^"]+)"/)?.[1];
    if (land) images.push(land);
  }
  const bulletBlock = html.match(/id="feature-bullets"[\s\S]*?<\/ul>/)?.[0] ?? "";
  const bullets = [...bulletBlock.matchAll(/<span class="a-list-item[^"]*">([\s\S]*?)<\/span>/g)]
    .map((m) => strip(m[1]))
    .filter((s) => s.length > 8)
    .slice(0, 6);
  const priceRaw = html.match(
    /class="a-price[^"]*"[^>]*>\s*<span class="a-offscreen">([^<]+)</,
  )?.[1];
  const listRaw = html.match(
    /class="a-price a-text-price"[^>]*>\s*<span class="a-offscreen">([^<]+)</,
  )?.[1];
  const brandRaw = strip(html.match(/id="bylineInfo"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
  const brand = brandRaw
    .replace(/^(Visit the|Brand:)\s*/i, "")
    .replace(/\s*Store$/i, "")
    .trim();
  const price = priceRaw?.trim() || null;
  const compareAt = listRaw && listRaw.trim() !== price ? listRaw.trim() : null;
  return {
    source: "amazon",
    url,
    domain: new URL(url).hostname.replace(/^www\./, ""),
    brand: brand || "Amazon",
    title,
    price,
    compareAt,
    description: bullets.join(" "),
    bullets,
    tags: [],
    images: images.slice(0, 8),
  };
}

export function scrapeHtml(html: string, url: string): NormalizedProduct {
  const u = new URL(url);
  if (/amazon\./.test(u.hostname)) {
    const a = amazon(html, url);
    if (a) return a;
  }
  const p = fromJsonLd(html);
  const offersRaw = p?.offers;
  const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw ?? {}) as Record<
    string,
    unknown
  >;
  const rawImgs = Array.isArray(p?.image) ? p.image : p?.image ? [p.image] : [];
  const images = rawImgs
    .map((i) => (typeof i === "string" ? i : (i as { url?: string })?.url))
    .filter((s): s is string => Boolean(s));
  const og = meta(html, "og:image");
  if (og && !images.includes(og)) images.push(og);
  const title =
    (typeof p?.name === "string" ? p.name : undefined) ??
    meta(html, "og:title") ??
    strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!title || !images.length) throw new Error(`No product data found at ${url}`);
  const domain = u.hostname.replace(/^www\./, "");
  const brandRaw =
    typeof p?.brand === "string" ? p.brand : (p?.brand as { name?: string } | undefined)?.name;
  return {
    source: "generic",
    url,
    domain,
    brand: brandRaw ?? meta(html, "og:site_name") ?? domain.split(".")[0] ?? domain,
    title: strip(title),
    price: money(
      offer.price ?? offer.lowPrice ?? meta(html, "product:price:amount"),
      String(offer.priceCurrency ?? meta(html, "product:price:currency") ?? "USD"),
    ),
    compareAt: null,
    description: strip(
      (typeof p?.description === "string" ? p.description : undefined) ??
        meta(html, "og:description") ??
        "",
    ).slice(0, 1500),
    bullets: [],
    tags: [],
    images: images
      .map((i) => {
        try {
          return new URL(i, url).href;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .slice(0, 8),
  };
}
