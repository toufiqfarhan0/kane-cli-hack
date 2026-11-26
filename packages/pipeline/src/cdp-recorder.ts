import { mkdirSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { workDir } from "./temp-dir.js";

async function pickCdpPort(preferred: number): Promise<number> {
  const tryListen = (port: number) =>
    new Promise<number | null>((resolve) => {
      const srv = createServer();
      srv.unref();
      srv.once("error", () => resolve(null));
      srv.listen(port, "127.0.0.1", () => {
        const addr = srv.address();
        const chosen = typeof addr === "object" && addr ? addr.port : port;
        srv.close(() => resolve(chosen));
      });
    });
  if (preferred >= 9300) {
    const ok = await tryListen(preferred);
    if (ok) return ok;
  }
  return (await tryListen(0)) ?? preferred;
}

async function waitForCdpReady(cdpUrl: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${cdpUrl}/json/version`);
      if (res.ok) return;
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

function headed(): boolean {
  return process.env.KANE_HEADED === "1" || process.env.KANE_HEADLESS === "0";
}

function isPaintedPage(page: Page): boolean {
  const url = page.url();
  if (!url || url === "about:blank" || url.startsWith("chrome://") || url.startsWith("chrome-error://")) return false;
  return /^https?:/i.test(url);
}

function activePage(context: BrowserContext): Page | undefined {
  const pages = context.pages();
  for (let i = pages.length - 1; i >= 0; i--) {
    if (isPaintedPage(pages[i])) return pages[i];
  }
  return undefined;
}

/**
 * Kane attaches over CDP. The first Playwright tab is about:blank; Kane paints a later tab.
 * The demo camera is therefore screenshots of the active http(s) page, not Playwright recordVideo
 * of tab 0 (that film is white).
 */
export async function runWithRecordedChrome<T>(args: {
  jobId: string;
  port: number;
  fn: () => Promise<T>;
}): Promise<{ result: T; videoPath?: string; framesDir: string }> {
  const dir = workDir(args.jobId);
  const framesDir = join(dir, "stills", "live");
  mkdirSync(framesDir, { recursive: true });
  const indexPath = join(framesDir, "index.jsonl");
  writeFileSync(indexPath, "");

  const debugPort = await pickCdpPort(args.port);
  const userData = join(dir, "chrome-profile", String(debugPort));
  mkdirSync(userData, { recursive: true });

  const cdp = `http://127.0.0.1:${debugPort}`;
  const prevCdp = process.env.KANE_CDP_ENDPOINT;

  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(userData, {
      headless: !headed(),
      viewport: { width: 1440, height: 900 },
      args: [
        `--remote-debugging-port=${debugPort}`,
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        ...(process.platform === "linux" ? ["--no-sandbox", "--disable-dev-shm-usage"] : []),
      ],
    });
    await waitForCdpReady(cdp);
  } catch (err) {
    console.error("chrome camera launch failed, Kane will run without CDP stills:", err);
    const result = await args.fn();
    return { result, framesDir };
  }

  process.env.KANE_CDP_ENDPOINT = cdp;
  let frameI = 0;
  let stopped = false;
  const shoot = () => {
    if (stopped || !context) return;
    const page = activePage(context);
    if (!page) {
      setTimeout(shoot, 250);
      return;
    }
    const dest = join(framesDir, `live-${String(frameI++).padStart(5, "0")}.jpg`);
    const url = page.url();
    const t = Date.now();
    page
      .screenshot({ path: dest, type: "jpeg", quality: 72 })
      .then(() => {
        if (existsSync(dest)) appendFileSync(indexPath, `${JSON.stringify({ t, file: dest, url })}\n`);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!stopped) setTimeout(shoot, 250);
      });
  };
  shoot();

  const stopCamera = async () => {
    stopped = true;
    const page = context ? activePage(context) : undefined;
    if (page) {
      const dest = join(framesDir, `live-${String(frameI++).padStart(5, "0")}.jpg`);
      const url = page.url();
      const t = Date.now();
      try {
        await page.screenshot({ path: dest, type: "jpeg", quality: 72 });
        if (existsSync(dest)) appendFileSync(indexPath, `${JSON.stringify({ t, file: dest, url })}\n`);
      } catch {
        /* ignore */
      }
    }
  };

  try {
    const result = await args.fn();
    await stopCamera();
    await context.close();
    context = undefined;
    return { result, framesDir };
  } catch (err) {
    await stopCamera();
    try {
      await context?.close();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    if (prevCdp === undefined) delete process.env.KANE_CDP_ENDPOINT;
    else process.env.KANE_CDP_ENDPOINT = prevCdp;
  }
}
