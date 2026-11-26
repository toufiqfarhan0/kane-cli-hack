import type { AdStyle, NormalizedProduct, PostReadyBrief, PostReadyStoryboard } from "@postready/core";
import { DURATION, THEME, contrast, esc, fitSize, inkOn, longestWord, lum, mix, resolvePaletteForTheme } from "./html-kit.js";

export const LAUNCH_CUES = {
  cuts: [2.8, 6.6, 11.4],
  pops: [3.2, 7.0],
  chime: 11.55,
};

export interface ComposeLaunchOptions {
  style?: AdStyle;
  brief?: PostReadyBrief;
  storyboard?: PostReadyStoryboard;
  audio?: string | null;
  web?: boolean;
  width?: number;
  height?: number;
  walkthroughVideo?: string;
}

const words = (s: unknown, maxWords: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");

interface LaunchContent {
  theme: "pop" | "noir" | "editorial" | "neon";
  bg: string;
  accent: string;
  hook: string;
  name: string;
  tagline: string;
  features: PostReadyFeature[];
  ctaLabel: string;
  ctaLine: string;
  shots: string[];
}

type PostReadyFeature = { title: string; line: string };

function extractLaunchContent(
  product: NormalizedProduct,
  images: string[],
  brief?: PostReadyBrief,
  storyboard?: PostReadyStoryboard,
): LaunchContent {
  const safeImages = images.length ? images : [""];
  const sb = storyboard;
  const theme = sb?.theme ?? brief?.theme ?? "noir";
  const resolved = resolvePaletteForTheme(theme, sb?.palette ?? brief?.palette);
  const bg = resolved.bg;
  const accent = resolved.accent;

  const stmtScene = sb?.scenes.find((s) => s.type === "statement");
  const probScene = sb?.scenes.find((s) => s.type === "problem");
  const revScene = sb?.scenes.find((s) => s.type === "reveal");
  const ctaScene = sb?.scenes.find((s) => s.type === "cta");

  const stmtLines = Array.isArray(stmtScene?.lines)
    ? (stmtScene.lines as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const hookRaw =
    brief?.hook ||
    stmtLines.join(" ") ||
    sb?.concept ||
    product.title;
  const hook = words(hookRaw, 7).replace(/[.]+$/, "") || words(product.title, 6);

  const name = words(sb?.name || brief?.name || product.title || product.domain, 5);

  const taglineRaw =
    brief?.tagline ||
    (typeof probScene?.caption === "string" && probScene.caption) ||
    (typeof revScene?.kicker === "string" && revScene.kicker) ||
    sb?.concept ||
    product.description ||
    product.title;
  const tagline = words(taglineRaw, 12);

  let features: PostReadyFeature[] = [];
  if (brief?.features?.length) {
    features = brief.features.slice(0, 3);
  } else {
    const rawItems: string[] = [];
    for (const s of sb?.scenes ?? []) {
      if (Array.isArray(s.items)) rawItems.push(...s.items.map(String));
      if (Array.isArray(s.callouts)) rawItems.push(...s.callouts.map(String));
      if (Array.isArray(s.right)) rawItems.push(...s.right.map(String));
    }
    const merged = [...rawItems, ...product.bullets]
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const defaults = [
      { title: "Instant clarity", line: "Built to get users from landing to value fast." },
      { title: "Live workflow", line: "Every step demonstrated on real interactive pages." },
      { title: "Ready to ship", line: `Explore the full workflow directly at ${product.domain}.` },
    ];
    features = [0, 1, 2].map((i) => {
      const text = merged[i];
      if (!text) return defaults[i]!;
      const split = text.split(/\s*[:—-]\s*/);
      if (split.length >= 2 && split[0]!.split(" ").length <= 4) {
        return { title: words(split[0], 3), line: words(split.slice(1).join(" "), 10) };
      }
      const title = words(text, 4);
      const rest = product.bullets.find(
        (b) => b.toLowerCase() !== title.toLowerCase() && !rawItems.includes(b),
      );
      return {
        title,
        line: words(text, 10).toLowerCase() === title.toLowerCase() ? (rest ? words(rest, 10) : "") : words(text, 10),
      };
    });
  }

  const ctaLabel =
    words(
      (typeof ctaScene?.label === "string" && ctaScene.label) || brief?.cta || "Visit website",
      3,
    ) || "Visit website";
  const ctaLine =
    words(
      (typeof ctaScene?.line === "string" && ctaScene.line) || tagline || `Live now on ${product.domain}`,
      10,
    ) || `Live now on ${product.domain}`;

  const pickShot = (i: number) => safeImages[Math.min(i, safeImages.length - 1)] ?? safeImages[0]!;
  const shots =
    safeImages.length >= 3
      ? [pickShot(0), pickShot(1), pickShot(2)]
      : safeImages.length === 2
        ? [pickShot(0), pickShot(1), pickShot(0)]
        : [pickShot(0), pickShot(0), pickShot(0)];

  return { theme, bg, accent, hook, name, tagline, features, ctaLabel, ctaLine, shots };
}

export function composeWebsiteLaunch(
  product: NormalizedProduct,
  images: string[],
  opts: ComposeLaunchOptions = {},
): string {
  const LW = opts.width ?? 1920;
  const LH = opts.height ?? 1080;
  const landscape = LW > LH;
  const square = LW === LH;
  const feed = LW === 1080 && LH === 1350;

  const c = extractLaunchContent(product, images, opts.brief, opts.storyboard);
  const t = THEME[c.theme] ?? THEME.noir;
  const style = opts.style ?? "director";
  const bg = c.bg;
  let accent = c.accent;
  if (contrast(bg, accent) < 1.8) accent = lum(bg) > 0.42 ? "#111114" : "#38bdf8";

  const ink = inkOn(bg);
  const onAccent = inkOn(accent);
  const dark = ink === "#ffffff";
  const soft = dark ? "rgba(255,255,255,.72)" : "rgba(12,12,16,.68)";
  const bg2 = mix(bg, dark ? "#040407" : "#eef0f5", 0.34);
  const bgDeep = mix(bg, "#000000", dark ? 0.25 : 0.05);
  const cardBg = dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.9)";
  const cardBorder =
    style === "classic"
      ? (dark ? "rgba(255,255,255,.32)" : "rgba(12,12,16,.28)")
      : dark
        ? "rgba(255,255,255,.16)"
        : "rgba(12,12,16,.14)";
  const chromeBar = dark ? "#16171d" : "#f3f4f6";
  const chromeInk = dark ? "rgba(255,255,255,.55)" : "rgba(15,23,42,.55)";
  const gridLine = dark ? "rgba(255,255,255,.05)" : "rgba(15,23,42,.05)";
  const italic = c.theme === "editorial" ? "font-style:italic;" : "";
  const neonShadow = c.theme === "neon" ? `text-shadow: 0 0 36px ${accent}99;` : "";
  const up = (s: unknown) => (t.upper ? String(s).toUpperCase() : String(s));

  const maxLineW = landscape ? 1340 : 880;
  const hookText = up(c.hook);
  const hookLongest = longestWord(hookText);
  const hookMax = landscape ? 144 : square ? 104 : 118;
  const hookSize = Math.min(
    hookMax,
    fitSize(hookLongest, maxLineW, hookMax, t.wide + 0.08),
    Math.max(landscape ? 74 : 52, fitSize(hookText, landscape ? 2400 : 1480, hookMax, t.wide)),
  );
  const hookWordsHtml = hookText
    .split(" ")
    .filter(Boolean)
    .map((w) => `<span class="hw"><span class="hwi">${esc(w)}</span></span>`)
    .join(" ");

  const nameText = up(c.name);
  const nameMax = landscape ? 94 : square ? 64 : 78;
  const nameSize = Math.min(
    nameMax,
    fitSize(longestWord(nameText), landscape ? 640 : 820, nameMax, t.wide + 0.08),
    Math.max(landscape ? 52 : 44, fitSize(nameText, landscape ? 1280 : 1220, nameMax, t.wide)),
  );
  const ctaHeadlineSize = Math.min(
    landscape ? 98 : 80,
    fitSize(longestWord(nameText), landscape ? 740 : 840, landscape ? 98 : 80, t.wide + 0.08),
    Math.max(landscape ? 56 : 46, fitSize(nameText, landscape ? 1400 : 1260, landscape ? 98 : 80, t.wide)),
  );

  const OV = 0.35;
  const s0Start = 0;
  const s0Dur = 3.1;
  const s1Start = +(LAUNCH_CUES.cuts[0]! - OV).toFixed(2);
  const s1Dur = +(LAUNCH_CUES.cuts[1]! - s1Start + 0.35).toFixed(2);
  const s2Start = +(LAUNCH_CUES.cuts[1]! - OV).toFixed(2);
  const s2Dur = +(LAUNCH_CUES.cuts[2]! - s2Start).toFixed(2);
  const s3Start = +(LAUNCH_CUES.cuts[2]! - OV).toFixed(2);
  const s3Dur = +(DURATION - s3Start).toFixed(2);

  // Signature geometry & motion per ad style
  const tiltDeg = style === "classic" ? 0 : style === "depth" ? -3.5 : style === "reel" ? -1.5 : -1.5;
  const showReelBars = style === "reel";
  const depth3dTransform =
    style === "depth"
      ? landscape
        ? "transform: rotateY(-7deg) rotateX(3deg);"
        : "transform: rotateX(4deg) rotateY(-3deg);"
      : style === "classic"
        ? "transform: none;"
        : `transform: rotate(${tiltDeg}deg);`;
  const frameRadius = style === "classic" ? 12 : 24;
  const cardRadius = style === "classic" ? 12 : 22;

  // Responsive Browser + Video Frame Box Geometry per Aspect Ratio
  const barH = landscape ? 50 : 42;
  const s2Box = landscape
    ? { left: 84, top: 186, width: 1012, height: 682 }
    : square
      ? { left: 56, top: 206, width: 968, height: 536 }
      : feed
        ? { left: 56, top: 236, width: 968, height: 586 }
        : { left: 64, top: 326, width: 952, height: 640 };

  const hasWalkthrough = Boolean(opts.walkthroughVideo);

  const browserChrome = (domain: string, bodyHtml: string, extraClass = "") => `
    <div class="browser ${extraClass}">
      <div class="bbar" data-layout-ignore>
        <div class="bdots"><i></i><i></i><i></i></div>
        <div class="burl"><span class="lock">●</span> https://${esc(domain)}</div>
        ${hasWalkthrough ? `<span class="rec-pill" data-layout-ignore><i class="rdot"></i>LIVE WALKTHROUGH</span>` : ""}
      </div>
      <div class="bview">${bodyHtml}</div>
    </div>`;

  const featsHtml = c.features
    .map((f, i) => {
      const sub =
        !square && f.line && f.line.trim().toLowerCase() !== f.title.trim().toLowerCase()
          ? `<div class="fline">${esc(f.line)}</div>`
          : "";
      return `
      <div class="fcard${sub ? "" : " fcard--compact"}" id="fc-${i}">
        <div class="fnum">0${i + 1}</div>
        <div class="fcopy">
          <div class="ftitle display">${esc(up(f.title))}</div>
          ${sub}
        </div>
      </div>`;
    })
    .join("");

  const tourShotsHtml = hasWalkthrough
    ? ""
    : c.shots
        .map(
          (src, i) =>
            `<img id="tshot-${i}" class="tshot" src="${esc(src)}" alt="Live screen ${i + 1}" />`,
        )
        .join("");

  const reelBarHtml = showReelBars
    ? `<div class="reel-bars">
        <div class="rb"><span id="rb0"></span></div>
        <div class="rb"><span id="rb1"></span></div>
        <div class="rb"><span id="rb2"></span></div>
        <div class="rb"><span id="rb3"></span></div>
      </div>`
    : "";

  const webStyle = opts.web
    ? `html, body { width:100%; height:100%; background:#000; } #root { position:absolute; left:0; top:0; transform-origin:0 0; }`
    : `html, body { width:${LW}px; height:${LH}px; background:${bg}; } #root { position:relative; width:${LW}px; height:${LH}px; }`;

  const webPlayer = opts.web
    ? `
    const fitStage = () => {
      const k = Math.min(innerWidth / ${LW}, innerHeight / ${LH});
      root.style.transform = "translate(" + (innerWidth - ${LW} * k) / 2 + "px," + (innerHeight - ${LH} * k) / 2 + "px) scale(" + k + ")";
    };
    const clips = [...root.querySelectorAll("[data-start]")];
    const showClips = (t) => clips.forEach((el) => {
      const s = +el.dataset.start, d = +el.dataset.duration;
      el.style.visibility = t >= s && t < s + d ? "visible" : "hidden";
    });
    addEventListener("resize", fitStage);
    fitStage();
    tl.eventCallback("onUpdate", () => showClips(tl.time()));
    tl.eventCallback("onComplete", () => setTimeout(() => tl.restart(), 800));
    showClips(0);
    (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve()).then(() => tl.play(0));`
    : "";

  const layoutCss = landscape
    ? `
  .s1-left { position:absolute; left:96px; top:160px; width:640px; }
  .s1-right { position:absolute; left:774px; top:180px; width:1058px; height:710px; }
  .s2-left { position:absolute; left:${s2Box.left}px; top:${s2Box.top}px; width:${s2Box.width}px; height:${s2Box.height}px; }
  .s2-right { position:absolute; left:1148px; top:156px; width:684px; }
  .s3-left { position:absolute; left:104px; top:190px; width:760px; }
  .s3-right { position:absolute; left:920px; top:204px; width:908px; height:618px; }
  .flist { margin-top:30px; display:flex; flex-direction:column; gap:20px; }
  `
    : square
      ? `
  .s1-left { position:absolute; left:56px; top:68px; right:56px; }
  .s1-name { margin-top:16px !important; }
  .s1-rule { margin:16px 0 !important; }
  .s1-tag { font-size:24px !important; max-width:860px; }
  .s1-meta { margin-top:16px !important; padding:10px 18px !important; font-size:18px !important; }
  .s1-right { position:absolute; left:56px; top:392px; width:968px; height:618px; }
  .s2-left { position:absolute; left:${s2Box.left}px; top:${s2Box.top}px; width:${s2Box.width}px; height:${s2Box.height}px; }
  .s2-right { position:absolute; left:56px; top:70px; right:56px; }
  .s2-title { font-size:40px !important; margin-top:6px !important; }
  .flist { position:absolute; left:0; top:696px; width:968px; display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  .fcard { padding:16px !important; gap:12px !important; border-radius:16px !important; }
  .fnum { width:40px !important; height:40px !important; font-size:18px !important; }
  .ftitle { font-size:20px !important; }
  .s3-left { position:absolute; left:56px; top:68px; right:56px; }
  .s3-title { margin-top:14px !important; }
  .s3-sub { margin-top:12px !important; font-size:24px !important; }
  .cta-wrap { margin-top:22px !important; }
  .cta-btn { padding:18px 34px !important; font-size:24px !important; }
  .s3-right { position:absolute; left:56px; top:434px; width:968px; height:580px; }
  `
      : feed
        ? `
  .s1-left { position:absolute; left:56px; top:84px; right:56px; }
  .s1-right { position:absolute; left:56px; top:510px; width:968px; height:740px; }
  .s2-left { position:absolute; left:${s2Box.left}px; top:${s2Box.top}px; width:${s2Box.width}px; height:${s2Box.height}px; }
  .s2-right { position:absolute; left:56px; top:74px; right:56px; }
  .s2-title { font-size:46px !important; }
  .flist { position:absolute; left:0; top:780px; width:968px; display:flex; flex-direction:column; gap:14px; }
  .fcard { padding:18px 22px !important; }
  .ftitle { font-size:26px !important; }
  .fline { font-size:18px !important; }
  .s3-left { position:absolute; left:56px; top:86px; right:56px; }
  .cta-btn { padding:20px 38px !important; font-size:28px !important; }
  .s3-right { position:absolute; left:56px; top:540px; width:968px; height:720px; }
  `
        : `
  .s1-left { position:absolute; left:64px; top:128px; right:64px; }
  .s1-right { position:absolute; left:64px; top:690px; width:952px; height:1060px; }
  .s2-left { position:absolute; left:${s2Box.left}px; top:${s2Box.top}px; width:${s2Box.width}px; height:${s2Box.height}px; }
  .s2-right { position:absolute; left:64px; top:108px; right:64px; }
  .s2-title { font-size:50px !important; }
  .flist { position:absolute; left:0; top:888px; width:952px; display:flex; flex-direction:column; gap:22px; }
  .s3-left { position:absolute; left:64px; top:130px; right:64px; }
  .s3-right { position:absolute; left:64px; top:740px; width:952px; height:1020px; }
  `;

  // Exact inner viewport rect for the live walkthrough <video> layer (positioned below .bbar)
  const wtLeft = s2Box.left + 1;
  const wtTop = s2Box.top + barH + 1;
  const wtWidth = s2Box.width - 2;
  const wtHeight = s2Box.height - barH - 2;

  return `<!doctype html>
<html lang="en" data-resolution="${landscape ? "landscape" : "portrait"}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${LW}, height=${LH}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=${t.fonts}&display=block" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  :root {
    --bg: ${bg};
    --bg2: ${bg2};
    --bgDeep: ${bgDeep};
    --accent: ${accent};
    --ink: ${ink};
    --on-accent: ${onAccent};
    --soft: ${soft};
    --card-bg: ${cardBg};
    --card-border: ${cardBorder};
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { overflow:hidden; font-family:"${t.body}", system-ui, sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }
  ${webStyle}
  #root { overflow:hidden; background:var(--bg); }
  .display { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.96; ${italic} ${neonShadow} }
  .scene { position:absolute; inset:0; overflow:hidden; background:var(--bg); perspective:1600px; }
  .gridbg { position:absolute; inset:0; background-image:linear-gradient(${gridLine} 1px,transparent 1px),linear-gradient(90deg,${gridLine} 1px,transparent 1px); background-size:72px 72px; mask-image:radial-gradient(ellipse 85% 85% at 50% 50%,#000 45%,transparent 100%); pointer-events:none; }
  .glow { position:absolute; width:900px; height:900px; border-radius:50%; background:var(--accent); opacity:${style === "classic" ? ".08" : ".18"}; filter:blur(160px); pointer-events:none; }

  /* Scene 0: Hook */
  #s0 { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:${landscape ? "88px 140px" : "72px 68px"}; text-align:center; z-index:1; }
  #s0 .glow { left:${landscape ? 470 : 90}px; top:40px; }
  .pill { display:inline-flex; align-items:center; gap:12px; padding:11px 24px; border-radius:999px; background:var(--card-bg); border:2px solid var(--card-border); font-size:19px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .pdot { width:11px; height:11px; border-radius:50%; background:var(--accent); box-shadow:0 0 18px var(--accent); }
  .hook-wrap { margin-top:36px; max-width:${landscape ? 1540 : 940}px; }
  .hw { display:inline-block; overflow:hidden; vertical-align:top; padding:6px 4px; }
  .hwi { display:inline-block; }
  .sub-chip { margin-top:34px; font-size:${landscape ? 24 : 21}px; color:var(--soft); font-weight:500; letter-spacing:.01em; max-width:900px; }

  /* Browser frame */
  .browser { border-radius:${frameRadius}px; overflow:hidden; border:${style === "classic" ? "2px" : "1px"} solid var(--card-border); background:${chromeBar}; box-shadow:${style === "depth" ? "0 60px 140px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.1)" : "0 40px 100px rgba(0,0,0,.4)"}; display:flex; flex-direction:column; }
  .bbar { height:${barH}px; padding:0 20px; background:${chromeBar}; border-bottom:1px solid var(--card-border); display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .bdots { display:flex; gap:8px; }
  .bdots i { width:11px; height:11px; border-radius:50%; display:block; background:var(--soft); opacity:.45; }
  .bdots i:first-child { background:#ef4444; opacity:.9; }
  .bdots i:nth-child(2) { background:#f59e0b; opacity:.9; }
  .bdots i:nth-child(3) { background:#10b981; opacity:.9; }
  .burl { flex:1; height:28px; border-radius:8px; background:${dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"}; color:${chromeInk}; font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; padding:0 12px; overflow:hidden; white-space:nowrap; }
  .burl .lock { color:#10b981; font-size:11px; }
  .rec-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:#047857; color:#ffffff; font-size:11px; font-weight:800; letter-spacing:.08em; }
  .rdot { width:7px; height:7px; border-radius:50%; background:#4ade80; }
  .bview { position:relative; flex:1; overflow:hidden; background:#0d0e12; }
  .bview img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }

  /* Scene 1: Live Website Reveal */
  #s1 { z-index:2; background:var(--bg2); }
  #s1 .glow { left:-180px; top:-120px; opacity:.22; }
  .brand-pill { display:inline-block; padding:9px 20px; border-radius:999px; background:var(--accent); color:var(--on-accent); font-size:18px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
  .s1-name { margin-top:22px; color:var(--ink); }
  .s1-rule { width:130px; height:6px; border-radius:99px; background:var(--accent); margin:22px 0; transform-origin:left center; }
  .s1-tag { font-size:${landscape ? 30 : 25}px; line-height:1.34; color:var(--soft); font-weight:500; }
  .s1-meta { margin-top:26px; display:inline-flex; align-items:center; gap:12px; padding:12px 22px; border-radius:14px; background:var(--card-bg); border:1.5px solid var(--card-border); font-size:20px; font-weight:700; }
  .s1-right .browser { width:100%; height:100%; ${depth3dTransform} }
  .glint { position:absolute; inset:0; background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.22) 50%,transparent 65%); pointer-events:none; }

  /* Scene 2: Hybrid Walkthrough Video / Multi-screen Tour + Feature Cards */
  #s2 { z-index:3; background:var(--bgDeep); }
  #s2 .glow { right:-160px; bottom:-140px; opacity:.22; }
  .s2-left .browser { width:100%; height:100%; }
  .tshot { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top center; opacity:0; }
  #tshot-0 { opacity:1; }
  .step-tag { position:absolute; right:20px; bottom:20px; padding:8px 16px; border-radius:999px; background:rgba(12,12,16,.86); color:#fff; border:1px solid rgba(255,255,255,.24); font-size:14px; font-weight:700; letter-spacing:.06em; z-index:4; }
  .s2-kicker { font-size:18px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); }
  .s2-title { margin-top:10px; font-size:50px; color:var(--ink); }
  .fcard { display:flex; align-items:flex-start; gap:20px; padding:22px 24px; border-radius:${cardRadius}px; background:var(--card-bg); border:2px solid var(--card-border); }
  .fcard--compact { align-items:center; }
  .fnum { width:50px; height:50px; border-radius:${style === "classic" ? "8px" : "14px"}; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; flex-shrink:0; }
  .ftitle { font-size:29px; color:var(--ink); line-height:1.12; }
  .fline { margin-top:6px; font-size:20px; color:var(--soft); line-height:1.32; }

  /* Walkthrough MP4 Overlay (direct sibling of scenes inside #root, zero data-start ancestor) */
  #wt-wrap { position:absolute; left:${wtLeft}px; top:${wtTop}px; width:${wtWidth}px; height:${wtHeight}px; border-radius:0 0 ${Math.max(8, frameRadius - 2)}px ${Math.max(8, frameRadius - 2)}px; overflow:hidden; z-index:16; pointer-events:none; }
  #wt-inner { position:relative; width:100%; height:100%; overflow:hidden; background:#0d0e12; }
  #walkthrough-vid { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }

  /* Scene 3: CTA Finale */
  #s3 { z-index:25; background:var(--accent); color:var(--on-accent); }
  .s3-domain { display:inline-block; padding:9px 20px; border-radius:999px; background:${onAccent === "#ffffff" ? "rgba(255,255,255,.16)" : "rgba(12,12,16,.12)"}; font-size:18px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
  .s3-title { margin-top:22px; color:var(--on-accent); }
  .s3-sub { margin-top:18px; font-size:30px; line-height:1.34; opacity:.92; font-weight:500; }
  .cta-wrap { position:relative; display:inline-block; margin-top:36px; }
  .cta-btn { display:inline-flex; align-items:center; gap:16px; padding:24px 44px; border-radius:999px; background:var(--on-accent); color:var(--accent); font-size:30px; font-weight:800; letter-spacing:-.01em; box-shadow:0 24px 60px rgba(0,0,0,.28); }
  .cta-ring { position:absolute; inset:-12px; border-radius:999px; border:3px solid var(--on-accent); opacity:0; pointer-events:none; }
  .s3-right .browser { width:100%; height:100%; ${style === "classic" ? "transform:none;" : style === "depth" ? "transform:rotateY(6deg) rotateX(3deg);" : "transform:rotate(2deg);"} }

  .reel-bars { position:absolute; top:20px; left:40px; right:40px; height:6px; display:grid; grid-template-columns:repeat(4,1fr); gap:10px; z-index:60; pointer-events:none; }
  .rb { background:rgba(255,255,255,.24); border-radius:99px; overflow:hidden; }
  .rb span { display:block; height:100%; width:100%; background:#fff; transform-origin:left center; transform:scaleX(0); }
  #flash { position:absolute; inset:0; background:#fff; z-index:70; opacity:0; pointer-events:none; }

  ${layoutCss}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="${LW}" data-height="${LH}">
  <div id="s0" class="scene clip" data-start="${s0Start}" data-duration="${s0Dur}" data-track-index="0">
    <div class="gridbg"></div>
    <div class="glow" data-layout-allow-overflow></div>
    <div class="pill"><span class="pdot"></span>${
      product.brand.toLowerCase() === product.domain.toLowerCase()
        ? `NEW LAUNCH · ${esc(product.domain)}`
        : `${esc(product.brand)} · ${esc(product.domain)}`
    }</div>
    <div class="hook-wrap display" style="font-size:${hookSize}px">${hookWordsHtml}</div>
    <div class="sub-chip">${esc(c.tagline)}</div>
  </div>

  <div id="s1" class="scene clip" data-start="${s1Start}" data-duration="${s1Dur}" data-track-index="1">
    <div class="gridbg"></div>
    <div class="glow" data-layout-allow-overflow></div>
    <div class="s1-left">
      <div class="brand-pill">${esc(product.brand)}</div>
      <div class="s1-name display" style="font-size:${nameSize}px">${esc(nameText)}</div>
      <div class="s1-rule"></div>
      <div class="s1-tag">${esc(c.tagline)}</div>
      <div class="s1-meta">${product.price ? `From ${esc(product.price)}` : `Live at ${esc(product.domain)}`}</div>
    </div>
    <div class="s1-right">
      ${browserChrome(product.domain, `<img id="s1img" src="${esc(c.shots[0])}" alt="${esc(product.title)}" /><div class="glint"></div>`)}
    </div>
  </div>

  <div id="s2" class="scene clip" data-start="${s2Start}" data-duration="${s2Dur}" data-track-index="2">
    <div class="gridbg"></div>
    <div class="glow" data-layout-allow-overflow></div>
    <div class="s2-left" data-layout-allow-overlap>
      ${browserChrome(product.domain, hasWalkthrough ? "" : `${tourShotsHtml}<div class="step-tag" id="stag">LIVE VIEW 01</div>`)}
    </div>
    <div class="s2-right">
      <div class="s2-kicker">${hasWalkthrough ? "Live walkthrough + motion film" : "Product walkthrough"}</div>
      <div class="s2-title display">${esc(up("Built for real workflows"))}</div>
      <div class="flist">${featsHtml}</div>
    </div>
  </div>

  ${
    hasWalkthrough
      ? `<div id="wt-wrap"><div id="wt-inner"><video id="walkthrough-vid" class="clip" data-start="${s2Start}" data-duration="${s2Dur}" data-track-index="3" src="${esc(opts.walkthroughVideo)}" muted playsinline></video></div></div>`
      : ""
  }

  <div id="s3" class="scene clip" data-start="${s3Start}" data-duration="${s3Dur}" data-track-index="4" data-layout-allow-overlap>
    <div class="s3-left" data-layout-allow-overlap>
      <div class="s3-domain">${esc(product.domain)}</div>
      <div class="s3-title display" style="font-size:${ctaHeadlineSize}px">${esc(nameText)}</div>
      <div class="s3-sub">${esc(c.ctaLine)}</div>
      <div class="cta-wrap">
        <div class="cta-btn">${esc(c.ctaLabel)} <span aria-hidden="true">-></span></div>
        <div class="cta-ring"></div>
      </div>
    </div>
    <div class="s3-right">
      ${browserChrome(product.domain, `<img id="s3img" src="${esc(c.shots[c.shots.length - 1])}" alt="${esc(product.title)}" />`)}
    </div>
  </div>

  ${reelBarHtml}
  <div id="flash"></div>
  ${opts.audio ? `<audio id="main-audio" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="9" data-volume="0.95" src="${esc(opts.audio)}"></audio>` : ""}
</div>

<script>
  const tl = gsap.timeline({ paused: true });
  const root = document.getElementById("root");

  // Scene 0: Hook slam
  tl.fromTo("#s0 .pill", { y: 12, opacity: 1 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0);
  tl.fromTo("#s0 .hwi", { y: 110, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, stagger: 0.07, ease: "power4.out" }, 0.16);
  tl.fromTo("#s0 .sub-chip", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, 0.72);
  tl.to("#s0 .glow", { scale: 1.25, x: 140, duration: 2.6, ease: "sine.inOut" }, 0);

  // Scene 1: Live Website Reveal
  tl.fromTo("#s1", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.48, ease: "power4.out" }, ${s1Start});
  tl.fromTo("#s1 .s1-left > *", { x: -48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, stagger: 0.09, ease: "power3.out" }, ${(s1Start + 0.25).toFixed(2)});
  tl.fromTo("#s1 .s1-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, ${(s1Start + 0.45).toFixed(2)});
  tl.fromTo("#s1 .browser", { y: 70, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.72, ease: "power3.out" }, ${(s1Start + 0.22).toFixed(2)});
  tl.fromTo("#s1img", { scale: 1.0, objectPosition: "50% 0%" }, { scale: 1.06, objectPosition: "50% 18%", duration: ${s1Dur}, ease: "sine.inOut" }, ${(s1Start + 0.3).toFixed(2)});
  tl.fromTo("#s1 .glint", { xPercent: -110 }, { xPercent: 220, duration: 1.15, ease: "power2.inOut" }, ${(s1Start + 1.1).toFixed(2)});

  // Scene 2: Combined Kane Browser Walkthrough + Highlight Cards
  ${
    showReelBars
      ? `tl.fromTo("#s2", { opacity: 0 }, { opacity: 1, duration: 0.08 }, ${s2Start});
         tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.85, duration: 0.06 }, ${s2Start});
         tl.to("#flash", { opacity: 0, duration: 0.28 }, ${(s2Start + 0.06).toFixed(2)});`
      : `tl.fromTo("#s2", { y: ${LH} }, { y: 0, duration: 0.5, ease: "expo.out" }, ${s2Start});`
  }
  ${
    hasWalkthrough
      ? showReelBars
        ? `tl.fromTo("#wt-inner", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" }, ${s2Start});`
        : `tl.fromTo("#wt-inner", { y: ${LH}, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, ${s2Start});`
      : ""
  }
  tl.fromTo("#s2 .fcard", { x: 54, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.14, ease: "power3.out" }, ${(s2Start + 0.28).toFixed(2)});
  tl.fromTo("#fc-0", { borderColor: "${cardBorder}" }, { borderColor: "${accent}", duration: 0.3 }, ${(s2Start + 0.45).toFixed(2)});
  ${
    hasWalkthrough
      ? `
  tl.to("#fc-0", { borderColor: "${cardBorder}", duration: 0.25 }, 7.95);
  tl.to("#fc-1", { borderColor: "${accent}", duration: 0.3 }, 8.0);
  tl.to("#fc-1", { borderColor: "${cardBorder}", duration: 0.25 }, 9.65);
  tl.to("#fc-2", { borderColor: "${accent}", duration: 0.3 }, 9.7);`
      : `
  tl.to("#tshot-1", { opacity: 1, duration: 0.48, ease: "power2.inOut" }, 7.95);
  tl.set("#stag", { textContent: "LIVE VIEW 02" }, 8.0);
  tl.to("#fc-0", { borderColor: "${cardBorder}", duration: 0.25 }, 7.95);
  tl.to("#fc-1", { borderColor: "${accent}", duration: 0.3 }, 8.0);
  tl.to("#tshot-2", { opacity: 1, duration: 0.48, ease: "power2.inOut" }, 9.65);
  tl.set("#stag", { textContent: "LIVE VIEW 03" }, 9.7);
  tl.to("#fc-1", { borderColor: "${cardBorder}", duration: 0.25 }, 9.65);
  tl.to("#fc-2", { borderColor: "${accent}", duration: 0.3 }, 9.7);`
  }

  // Scene 3: CTA Finale
  tl.fromTo("#s3", { clipPath: "circle(0% at 85% 50%)" }, { clipPath: "circle(140% at 85% 50%)", duration: 0.55, ease: "power3.out" }, ${s3Start});
  tl.fromTo("#s3 .s3-left > *", { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.09, ease: "power3.out" }, ${(s3Start + 0.25).toFixed(2)});
  tl.fromTo("#s3 .browser", { y: 80, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, ease: "back.out(1.2)" }, ${(s3Start + 0.3).toFixed(2)});
  tl.fromTo("#s3 .cta-btn", { scale: 0.9 }, { scale: 1.06, duration: 0.28, yoyo: true, repeat: 1, ease: "power2.inOut" }, 12.6);
  tl.fromTo("#s3 .cta-ring", { scale: 0.92, opacity: 0.85 }, { scale: 1.24, opacity: 0, duration: 0.85, ease: "power2.out" }, 12.6);

  ${
    showReelBars
      ? `
  tl.fromTo("#rb0", { scaleX: 0 }, { scaleX: 1, duration: ${LAUNCH_CUES.cuts[0]!}, ease: "none" }, 0);
  tl.fromTo("#rb1", { scaleX: 0 }, { scaleX: 1, duration: ${(LAUNCH_CUES.cuts[1]! - LAUNCH_CUES.cuts[0]!).toFixed(2)}, ease: "none" }, ${LAUNCH_CUES.cuts[0]!});
  tl.fromTo("#rb2", { scaleX: 0 }, { scaleX: 1, duration: ${(LAUNCH_CUES.cuts[2]! - LAUNCH_CUES.cuts[1]!).toFixed(2)}, ease: "none" }, ${LAUNCH_CUES.cuts[1]!});
  tl.fromTo("#rb3", { scaleX: 0 }, { scaleX: 1, duration: ${(DURATION - LAUNCH_CUES.cuts[2]!).toFixed(2)}, ease: "none" }, ${LAUNCH_CUES.cuts[2]!});`
      : ""
  }

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);${webPlayer}
</script>
</body>
</html>
`;
}
