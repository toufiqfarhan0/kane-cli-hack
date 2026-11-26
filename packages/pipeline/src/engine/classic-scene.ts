import type { NormalizedProduct, PostReadyBrief } from "@postready/core";
import {
  DURATION,
  H,
  THEME,
  W,
  WEB_PLAYER,
  WEB_STYLE,
  contrast,
  esc,
  fitSize,
  inkOn,
  longestWord,
  lum,
} from "./html-kit.js";

export interface ComposeOptions {
  web?: boolean;
  audio?: string | null;
  cutouts?: Array<string | null>;
}

export function compose(
  product: NormalizedProduct,
  brief: PostReadyBrief,
  images: string[],
  { web = false, audio = null, cutouts = [] }: ComposeOptions = {},
): string {
  const baseT = THEME[brief.theme] ?? THEME.noir;
  const radius = brief.theme === "pop" ? 64 : brief.theme === "editorial" ? 20 : baseT.radius;
  const t = { ...baseT, radius };

  const bg = brief.palette.bg;
  let accent = brief.palette.accent;
  if (contrast(bg, accent) < 1.6) accent = lum(bg) > 0.4 ? "#111114" : "#ffd23f";
  const ink = inkOn(bg);
  const onAccent = inkOn(accent);
  const soft = ink === "#ffffff" ? "rgba(255,255,255,.62)" : "rgba(12,12,16,.62)";
  const line = ink === "#ffffff" ? "rgba(255,255,255,.16)" : "rgba(12,12,16,.14)";
  const up = (s: unknown) => (t.upper ? String(s).toUpperCase() : String(s));
  const img = (i: number) => images[i] ?? images[0];
  const cut = cutouts[brief.heroImage] ?? cutouts.find(Boolean) ?? null;

  const hookWords = up(brief.hook).split(" ").filter(Boolean);
  const hookSize = fitSize(
    hookWords.reduce((a, b) => (a.length >= b.length ? a : b), ""),
    960,
    t.display === "Unbounded" ? 230 : 330,
    t.display === "Unbounded" ? 0.74 : 0.6,
  );
  const wide = t.display === "Unbounded" ? 0.86 : 0.64;
  const nameSize = Math.min(
    132,
    fitSize(longestWord(up(brief.name)), 940, 132, wide),
    Math.max(72, fitSize(up(brief.name), 1800, 132, t.display === "Unbounded" ? 0.7 : 0.55)),
  );
  const glow = brief.theme === "neon" ? `text-shadow:0 0 42px ${accent}aa;` : "";
  const italic = brief.theme === "editorial" ? "font-style:italic;" : "";

  const A = [0, 2.8];
  const B = [2.8, 3.8];
  const C = [6.6, 4.8];
  const D = [11.4, DURATION - 11.4];
  const cuts = [B[0], C[0], D[0]];
  const wipeColor = [bg, accent, ink];

  const featRows = brief.features
    .map(
      (f, i) => `
        <div class="row ${i % 2 ? "flip" : ""}" id="row${i}">
          <div class="thumb"><img src="${esc(img(brief.featureImages[i]))}" alt="" /></div>
          <div class="rtext">
            <div class="num">0${i + 1}</div>
            <div class="rtitle" style="font-size:${fitSize(
              up(f.title),
              520,
              84,
              t.display === "Unbounded" ? 0.72 : 0.56,
            )}px">${esc(up(f.title))}</div>
            <div class="rline">${esc(f.line)}</div>
          </div>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=${t.fonts}&display=block" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
  :root { --bg:${bg}; --accent:${accent}; --ink:${ink}; --on-accent:${onAccent}; --soft:${soft}; --line:${line}; --r:${t.radius}px; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden; background:var(--bg); }
  body { font-family:"${t.body}", system-ui, sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }
  #root { position:relative; width:${W}px; height:${H}px; overflow:hidden; }
  .scene { position:absolute; inset:0; overflow:hidden; }
  .display { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.92; }
  .chip { display:inline-block; font-weight:700; font-size:30px; letter-spacing:.16em; text-transform:uppercase; padding:16px 28px; border-radius:999px; }
  .card { background:#fff; border-radius:var(--r); overflow:hidden; display:flex; align-items:center; justify-content:center; }
  .card img, .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .card.cut { background:none; box-shadow:none !important; overflow:visible; }
  .card.cut img { object-fit:contain; filter:drop-shadow(0 46px 44px rgba(0,0,0,.4)); }
  #ctaCard.cut { background:rgba(255,255,255,.22); }
  #ctaCard.cut img { width:112%; height:112%; margin:-6%; }
  .wipe { position:absolute; left:0; top:0; width:${W}px; height:${H}px; z-index:50; }
  .blob { position:absolute; border-radius:50%; filter:blur(120px); opacity:.5; }
  ${web ? WEB_STYLE : ""}

  #sA { background:var(--accent); color:var(--on-accent); }
  #sA .chip { position:absolute; top:150px; left:60px; background:var(--on-accent); color:var(--accent); }
  #hook { position:absolute; left:60px; right:60px; top:50%; transform:translateY(-50%); font-size:${hookSize}px; ${italic} }
  #hook .w { display:block; overflow:hidden; padding-bottom:.06em; }
  #hook .w span { display:block; }
  #ring { position:absolute; right:-170px; bottom:-170px; width:620px; height:620px; border-radius:50%; border:44px solid var(--on-accent); opacity:.16; }

  #sB { background:var(--bg); }
  #sB .blob { width:900px; height:900px; left:90px; top:160px; background:var(--accent); }
  #heroCard { position:absolute; left:90px; top:230px; width:900px; height:980px; box-shadow:0 60px 120px rgba(0,0,0,.28); }
  #price { position:absolute; right:60px; top:1110px; background:var(--accent); color:var(--on-accent); font-size:84px; padding:22px 44px; border-radius:999px; box-shadow:0 24px 60px rgba(0,0,0,.25); }
  #name { position:absolute; left:60px; right:60px; top:1300px; font-size:${nameSize}px; text-wrap:balance; ${glow} }
  #tag { position:absolute; left:60px; right:60px; bottom:150px; font-size:50px; font-weight:500; line-height:1.2; color:var(--soft); text-wrap:balance; }

  #sC { background:var(--bg); }
  #sC .head { position:absolute; top:130px; left:60px; right:60px; display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:30px; letter-spacing:.16em; text-transform:uppercase; color:var(--soft); }
  #bar { position:absolute; top:200px; left:60px; width:960px; height:6px; background:var(--line); border-radius:6px; overflow:hidden; }
  #barFill { width:960px; height:6px; background:var(--accent); transform-origin:left center; }
  .row { position:absolute; left:60px; width:960px; height:470px; display:flex; align-items:center; gap:48px; }
  .row.flip { flex-direction:row-reverse; text-align:right; }
  #row0 { top:270px; } #row1 { top:770px; } #row2 { top:1270px; }
  .thumb { flex:0 0 400px; height:400px; background:#fff; border-radius:var(--r); overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,.22); }
  .num { font-weight:700; font-size:34px; letter-spacing:.14em; color:var(--accent); margin-bottom:18px; }
  .rtitle { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.95; ${italic} }
  .rline { margin-top:22px; font-size:42px; font-weight:500; line-height:1.22; color:var(--soft); text-wrap:balance; }

  #sD { background:var(--accent); color:var(--on-accent); }
  #ctaCard { position:absolute; left:210px; top:190px; width:660px; height:660px; border-radius:50%; box-shadow:0 50px 110px rgba(0,0,0,.3); }
  #ctaName { position:absolute; left:60px; right:60px; top:930px; text-align:center; font-size:${Math.round(nameSize * 0.9)}px; text-wrap:balance; }
  #ctaPrice { position:absolute; left:0; right:0; top:1290px; text-align:center; font-size:150px; }
  #ctaPrice s { font-size:64px; opacity:.55; margin-right:24px; font-weight:500; font-family:"${t.body}", sans-serif; letter-spacing:0; }
  #btn { position:absolute; left:140px; right:140px; top:1500px; height:150px; border-radius:999px; background:var(--on-accent); color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:66px; }
  #domain { position:absolute; left:0; right:0; top:1700px; text-align:center; font-weight:700; font-size:36px; letter-spacing:.1em; opacity:.8; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="${W}" data-height="${H}">

  <div id="sA" class="scene clip" data-start="${A[0]}" data-duration="${A[1]}" data-track-index="0">
    <div class="chip" id="brandChip">${esc(product.brand)}</div>
    <div id="ring"></div>
    <div id="hook" class="display">${hookWords.map((w) => `<span class="w"><span>${esc(w)}</span></span>`).join("")}</div>
  </div>

  <div id="sB" class="scene clip" data-start="${B[0]}" data-duration="${B[1]}" data-track-index="1">
    <div class="blob"></div>
    <div id="heroCard" class="card${cut ? " cut" : ""}"><img id="heroImg" src="${esc(cut ?? img(brief.heroImage))}" alt="" /></div>
    ${product.price ? `<div id="price" class="display">${esc(product.price)}</div>` : ""}
    <div id="name" class="display">${esc(up(brief.name))}</div>
    <div id="tag">${esc(brief.tagline)}</div>
  </div>

  <div id="sC" class="scene clip" data-start="${C[0]}" data-duration="${C[1]}" data-track-index="2">
    <div class="head"><span>${esc(product.brand)}</span><span>${esc(brief.name)}</span></div>
    <div id="bar"><div id="barFill"></div></div>
    ${featRows}
  </div>

  <div id="sD" class="scene clip" data-start="${D[0]}" data-duration="${D[1]}" data-track-index="3">
    <div id="ctaCard" class="card${cut ? " cut" : ""}"><img src="${esc(cut ?? img(brief.heroImage))}" alt="" /></div>
    <div id="ctaName" class="display">${esc(up(brief.name))}</div>
    ${product.price ? `<div id="ctaPrice" class="display">${product.compareAt ? `<s>${esc(product.compareAt)}</s>` : ""}${esc(product.price)}</div>` : ""}
    <div id="btn" class="display">${esc(up(brief.cta))}</div>
    <div id="domain">${esc(product.domain)}</div>
  </div>

  ${cuts.map((_, i) => `<div class="wipe" id="wipe${i}" style="background:${wipeColor[i]}"></div>`).join("\n  ")}
  ${audio ? `<audio class="clip" data-start="0" data-duration="${DURATION}" data-track-index="9" data-volume="0.95" src="${esc(audio)}"></audio>` : ""}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  const cuts = ${JSON.stringify(cuts)};

  cuts.forEach((c, i) => {
    tl.set("#wipe" + i, { y: ${H} }, 0);
    tl.fromTo("#wipe" + i, { y: ${H} }, { y: 0, duration: 0.32, ease: "power3.in" }, c - 0.32);
    tl.to("#wipe" + i, { y: -${H}, duration: 0.38, ease: "power3.out" }, c);
  });

  tl.from("#brandChip", { y: -80, opacity: 0, duration: 0.4, ease: "power3.out" }, 0.05);
  tl.from("#hook .w span", { y: ${Math.round(hookSize * 1.1)}, duration: 0.55, ease: "expo.out", stagger: 0.13 }, 0.12);
  tl.fromTo("#ring", { scale: 0.4, rotation: -40 }, { scale: 1.15, rotation: 20, duration: ${A[1]}, ease: "power1.out" }, 0);
  tl.to("#hook", { scale: 1.05, duration: ${(A[1] - 1).toFixed(2)}, ease: "none" }, 1);

  const b = ${B[0]};
  tl.from("#heroCard", { y: 220, scale: 0.82, rotation: -5, opacity: 0, duration: 0.75, ease: "expo.out" }, b + 0.1);
  tl.fromTo("#heroImg", { scale: 1 }, { scale: 1.1, duration: ${B[1]}, ease: "none" }, b);
  tl.fromTo("#sB .blob", { scale: 0.7 }, { scale: 1.2, duration: ${B[1]}, ease: "none" }, b);
  ${product.price ? `tl.from("#price", { scale: 0, rotation: -24, duration: 0.5, ease: "back.out(2.2)" }, b + 0.75); tl.set("#price", { rotation: -6 }, 0);` : ""}
  tl.from("#name", { y: 90, opacity: 0, duration: 0.55, ease: "power4.out" }, b + 0.5);
  tl.from("#tag", { y: 60, opacity: 0, duration: 0.55, ease: "power4.out" }, b + 0.85);

  const c = ${C[0]};
  tl.fromTo("#barFill", { scaleX: 0 }, { scaleX: 1, duration: ${C[1] - 0.3}, ease: "none" }, c + 0.15);
  [0, 1, 2].forEach((i) => {
    const at = c + 0.25 + i * 1.25;
    const dir = i % 2 ? -1 : 1;
    tl.from("#row" + i + " .thumb", { x: -260 * dir, rotation: -8 * dir, opacity: 0, duration: 0.6, ease: "expo.out" }, at);
    tl.from("#row" + i + " .rtext", { x: 160 * dir, opacity: 0, duration: 0.55, ease: "power4.out" }, at + 0.12);
  });

  const d = ${D[0]};
  tl.from("#ctaCard", { scale: 0, rotation: -30, duration: 0.7, ease: "back.out(1.6)" }, d + 0.1);
  tl.fromTo("#ctaCard", { y: 0 }, { y: -22, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: 1 }, d + 0.85);
  tl.from("#ctaName", { y: 80, opacity: 0, duration: 0.5, ease: "power4.out" }, d + 0.4);
  ${product.price ? `tl.from("#ctaPrice", { scale: 0.5, opacity: 0, duration: 0.5, ease: "back.out(2)" }, d + 0.7);` : ""}
  tl.from("#btn", { y: 160, opacity: 0, duration: 0.55, ease: "expo.out" }, d + 0.95);
  tl.fromTo("#btn", { scale: 1 }, { scale: 1.06, duration: 0.4, ease: "sine.inOut", yoyo: true, repeat: 3 }, d + 1.6);
  tl.from("#domain", { opacity: 0, duration: 0.4 }, d + 1.3);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);${web ? WEB_PLAYER : ""}
</script>
</body>
</html>
`;
}
