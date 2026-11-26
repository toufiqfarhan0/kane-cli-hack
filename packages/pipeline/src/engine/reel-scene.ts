import type { NormalizedProduct, PostReadyBrief } from "@postready/core";
import type { ComposeOptions } from "./classic-scene.js";
import {
  DURATION,
  H,
  THEME,
  W,
  WEB_PLAYER,
  WEB_STYLE,
  esc,
  fitSize,
  inkOn,
  longestWord,
} from "./html-kit.js";

export function composeReel(
  product: NormalizedProduct,
  brief: PostReadyBrief,
  images: string[],
  { web = false, audio = null, cutouts = [] }: ComposeOptions = {},
): string {
  const t = THEME[brief.theme] ?? THEME.noir;
  const accent = brief.palette.accent;
  const onAccent = inkOn(accent);
  const up = (s: unknown) => (t.upper ? String(s).toUpperCase() : String(s));
  const img = (i: number) => images[i] ?? images[0];
  const cut = cutouts[brief.heroImage] ?? cutouts.find(Boolean) ?? null;
  const italic = brief.theme === "editorial" ? "font-style:italic;" : "";

  const hookWords = up(brief.hook).split(" ").filter(Boolean);
  const hookSize = fitSize(
    hookWords.reduce((a, b) => (a.length >= b.length ? a : b), ""),
    900,
    t.display === "Unbounded" ? 190 : 260,
    t.wide,
  );
  const punch = hookWords.reduce(
    (best, w, i) => (w.length > (hookWords[best]?.length ?? 0) ? i : best),
    0,
  );
  const name = up(brief.name);
  const nameSize = Math.min(
    120,
    fitSize(longestWord(name), 940, 120, t.wide + 0.1),
    Math.max(68, fitSize(name, 1700, 120, t.wide)),
  );

  const order = [brief.heroImage, ...brief.featureImages, ...images.map((_, i) => i)].filter(
    (v, i, a) => a.indexOf(v) === i,
  );
  const pick = (k: number) => img(order[k % order.length]);
  const strips = [pick(1), pick(0), pick(2)];

  const A = [0, 2.8];
  const B = [2.8, 3.3];
  const F = [6.1, 1.55];
  const D = [6.1 + 3 * 1.55, DURATION - (6.1 + 3 * 1.55)];
  const segs: [number, number][] = [
    [A[0], A[1]],
    [B[0], B[1]],
    [F[0], F[1]],
    [F[0] + F[1], F[1]],
    [F[0] + 2 * F[1], F[1]],
    [D[0], D[1]],
  ];

  const featScenes = brief.features
    .map((f, i) => {
      const s = (F[0] + i * F[1]).toFixed(2);
      return `
  <div id="sF${i}" class="scene clip" data-start="${s}" data-duration="${F[1]}" data-track-index="${2 + i}">
    <img class="bleed" id="fImg${i}" src="${esc(pick(i + 1))}" alt="" />
    <div class="shade"></div>
    <div class="fBig display" id="fBig${i}">0${i + 1}</div>
    <div class="cap" id="fCap${i}">
      <div class="capTitle display" style="font-size:${fitSize(up(f.title), 900, 128, t.wide)}px"><span class="hl">${esc(
        up(f.title),
      )}</span></div>
      <div class="capLine">${esc(f.line)}</div>
    </div>
  </div>`;
    })
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
  :root { --accent:${accent}; --on-accent:${onAccent}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden; background:#000; }
  body { font-family:"${t.body}", system-ui, sans-serif; color:#fff; -webkit-font-smoothing:antialiased; }
  #root { position:relative; width:${W}px; height:${H}px; overflow:hidden; background:#000; }
  .display { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.95; }
  .scene { position:absolute; inset:0; overflow:hidden; background:#000; }
  .bleed { position:absolute; left:-6%; top:-6%; width:112%; height:112%; object-fit:cover; }
  .shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 46%, rgba(0,0,0,.86) 100%); }
  .hl { background:var(--accent); color:var(--on-accent); padding:.04em .16em .1em; border-radius:.12em; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
  ${web ? WEB_STYLE : ""}

  #chrome { position:absolute; left:0; right:0; top:0; z-index:40; padding:64px 50px 0; }
  #bars { display:flex; gap:10px; }
  .bar { flex:1; height:8px; border-radius:8px; background:rgba(255,255,255,.34); overflow:hidden; }
  .bar i { display:block; width:100%; height:100%; background:#fff; transform-origin:left center; }
  #who { margin-top:26px; display:flex; align-items:center; gap:18px; font-weight:700; font-size:36px; text-shadow:0 2px 12px rgba(0,0,0,.5); }
  #avatar { width:72px; height:72px; border-radius:50%; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:38px; }
  #flash { position:absolute; inset:0; background:#fff; z-index:30; opacity:0; pointer-events:none; }

  #hook { position:absolute; left:60px; right:60px; bottom:250px; font-size:${hookSize}px; ${italic} }
  #hook .w { display:inline-block; margin:0 .12em .1em 0; text-shadow:0 6px 30px rgba(0,0,0,.55); }
  #hook .w.p { text-shadow:none; }
  #swipe { position:absolute; left:60px; bottom:130px; font-weight:700; font-size:36px; letter-spacing:.14em; text-transform:uppercase; opacity:.9; }

  #sB { background:var(--accent); }
  .strip { position:absolute; top:0; width:${Math.round(W / 3) + 2}px; height:${H}px; overflow:hidden; }
  .strip img { position:absolute; left:-25%; top:-4%; width:150%; height:108%; object-fit:cover; }
  #st0 { left:0; } #st1 { left:${Math.round(W / 3)}px; } #st2 { left:${Math.round((2 * W) / 3)}px; }
  #bShade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.88) 100%); }
  #nameB { position:absolute; left:60px; right:60px; bottom:330px; font-size:${nameSize}px; text-wrap:balance; text-shadow:0 6px 30px rgba(0,0,0,.5); }
  #tagB { position:absolute; left:60px; right:60px; bottom:170px; font-size:50px; font-weight:500; line-height:1.2; text-wrap:balance; opacity:.92; }
  #priceB { position:absolute; right:50px; top:250px; z-index:5; width:270px; height:270px; border-radius:50%; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:${product.price && product.price.length > 6 ? 62 : 78}px; box-shadow:0 26px 60px rgba(0,0,0,.4); border:8px dashed var(--on-accent); }

  .fBig { position:absolute; right:40px; top:230px; font-size:420px; color:transparent; -webkit-text-stroke:6px rgba(255,255,255,.85); opacity:.9; }
  .cap { position:absolute; left:60px; right:60px; bottom:200px; }
  .capTitle { ${italic} line-height:1.12; }
  .capLine { margin-top:28px; font-size:54px; font-weight:500; line-height:1.2; text-wrap:balance; text-shadow:0 4px 20px rgba(0,0,0,.6); }

  #dBg { filter:blur(34px) brightness(.55) saturate(1.2); }
  #dCard { position:absolute; left:140px; top:300px; width:800px; height:800px; border-radius:48px; overflow:hidden; box-shadow:0 60px 130px rgba(0,0,0,.55); border:10px solid #fff; }
  #dCard img { width:100%; height:100%; object-fit:cover; display:block; }
  #dCard.cut { border:none; box-shadow:none; overflow:visible; border-radius:0; background:radial-gradient(circle, ${accent}cc 0%, transparent 66%); }
  #dCard.cut img { object-fit:contain; filter:drop-shadow(0 50px 50px rgba(0,0,0,.5)); }
  #dName { position:absolute; left:60px; right:60px; top:1170px; text-align:center; font-size:${Math.round(nameSize * 0.86)}px; text-wrap:balance; }
  #dPrice { position:absolute; left:0; right:0; top:1420px; text-align:center; font-size:132px; }
  #dPrice s { font-size:60px; opacity:.6; margin-right:22px; font-weight:500; font-family:"${t.body}", sans-serif; letter-spacing:0; }
  #btn { position:absolute; left:130px; right:130px; top:1600px; height:150px; border-radius:999px; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:66px; overflow:hidden; }
  #btnShine { position:absolute; top:0; left:0; width:30%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent); transform:skewX(-16deg); }
  #domain { position:absolute; left:0; right:0; top:1790px; text-align:center; font-weight:700; font-size:36px; letter-spacing:.1em; opacity:.85; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="${W}" data-height="${H}">

  <div id="sA" class="scene clip" data-start="${A[0]}" data-duration="${A[1]}" data-track-index="0">
    <img class="bleed" id="aImg" src="${esc(img(brief.heroImage))}" alt="" />
    <div class="shade"></div>
    <div id="hook" class="display">${hookWords
      .map(
        (w, i) =>
          `<span class="w${i === punch ? " p" : ""}">${
            i === punch ? `<span class="hl">${esc(w)}</span>` : esc(w)
          }</span>`,
      )
      .join("")}</div>
    <div id="swipe">${esc(product.domain)}</div>
  </div>

  <div id="sB" class="scene clip" data-start="${B[0]}" data-duration="${B[1]}" data-track-index="1">
    ${strips.map((s, i) => `<div class="strip" id="st${i}"><img src="${esc(s)}" alt="" /></div>`).join("\n    ")}
    <div id="bShade"></div>
    ${product.price ? `<div id="priceB" class="display">${esc(product.price)}</div>` : ""}
    <div id="nameB" class="display">${esc(name)}</div>
    <div id="tagB">${esc(brief.tagline)}</div>
  </div>
${featScenes}

  <div id="sD" class="scene clip" data-start="${D[0].toFixed(2)}" data-duration="${D[1].toFixed(2)}" data-track-index="5">
    <img class="bleed" id="dBg" src="${esc(img(brief.heroImage))}" alt="" />
    <div id="dCard"${cut ? ' class="cut"' : ""}><img src="${esc(cut ?? img(brief.heroImage))}" alt="" /></div>
    <div id="dName" class="display">${esc(name)}</div>
    ${product.price ? `<div id="dPrice" class="display">${product.compareAt ? `<s>${esc(product.compareAt)}</s>` : ""}${esc(product.price)}</div>` : ""}
    <div id="btn" class="display"><span>${esc(up(brief.cta))}</span><div id="btnShine"></div></div>
    <div id="domain">${esc(product.domain)}</div>
  </div>

  <div id="flash"></div>
  <div id="chrome">
    <div id="bars">${segs.map((_, i) => `<div class="bar"><i id="bar${i}"></i></div>`).join("")}</div>
    <div id="who"><div id="avatar" class="display">${esc(String(product.brand).trim().charAt(0).toUpperCase())}</div><span>${esc(product.brand)}</span></div>
  </div>
  ${audio ? `<audio class="clip" data-start="0" data-duration="${DURATION}" data-track-index="9" data-volume="0.95" src="${esc(audio)}"></audio>` : ""}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  const segs = ${JSON.stringify(segs.map(([s, d]) => [+(+s).toFixed(2), +(+d).toFixed(2)]))};

  segs.forEach(([s, d], i) => {
    tl.set("#bar" + i, { scaleX: 0 }, 0);
    tl.fromTo("#bar" + i, { scaleX: 0 }, { scaleX: 1, duration: d, ease: "none" }, s);
  });

  segs.slice(1).forEach(([s]) => {
    tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.85, duration: 0.07, ease: "power1.in" }, s - 0.07);
    tl.to("#flash", { opacity: 0, duration: 0.28, ease: "power2.out" }, s);
  });

  tl.fromTo("#aImg", { scale: 1, x: 0 }, { scale: 1.16, x: -30, duration: ${A[1]}, ease: "none" }, 0);
  tl.from("#hook .w", { y: 90, opacity: 0, scale: 0.7, rotation: -6, duration: 0.42, ease: "back.out(2.2)", stagger: 0.16 }, 0.2);
  tl.from("#swipe", { opacity: 0, x: -40, duration: 0.4, ease: "power3.out" }, 1.1);

  const b = ${B[0]};
  [0, 1, 2].forEach((i) => {
    tl.from("#st" + i, { y: i % 2 ? ${H} : -${H}, duration: 0.6, ease: "expo.out" }, b + i * 0.1);
    tl.fromTo("#st" + i + " img", { y: i % 2 ? -50 : 50, scale: 1.08 }, { y: i % 2 ? 50 : -50, scale: 1.16, duration: ${B[1]}, ease: "none" }, b);
  });
  tl.from("#nameB", { y: 120, opacity: 0, duration: 0.55, ease: "expo.out" }, b + 0.55);
  tl.from("#tagB", { y: 70, opacity: 0, duration: 0.5, ease: "power4.out" }, b + 0.85);
  ${product.price ? `tl.set("#priceB", { rotation: 12 }, 0); tl.from("#priceB", { scale: 0, rotation: -60, duration: 0.6, ease: "back.out(2.4)" }, b + 1.0); tl.fromTo("#priceB", { rotation: 12 }, { rotation: 24, duration: ${(B[1] - 1.6).toFixed(2)}, ease: "sine.inOut" }, b + 1.6);` : ""}

  const moves = [[1.02, 1.18, 40, 0], [1.18, 1.03, -40, 30], [1.03, 1.2, 0, -50]];
  [0, 1, 2].forEach((i) => {
    const s = ${F[0]} + i * ${F[1]};
    const [s0, s1, x, y] = moves[i];
    tl.fromTo("#fImg" + i, { scale: s0, x: 0, y: 0 }, { scale: s1, x, y, duration: ${F[1]}, ease: "none" }, s);
    tl.from("#fBig" + i, { x: 300, opacity: 0, duration: 0.45, ease: "expo.out" }, s + 0.05);
    tl.from("#fCap" + i + " .capTitle", { y: 110, opacity: 0, scale: 0.8, duration: 0.42, ease: "back.out(2)" }, s + 0.12);
    tl.from("#fCap" + i + " .capLine", { y: 60, opacity: 0, duration: 0.4, ease: "power4.out" }, s + 0.3);
  });

  const d = ${D[0].toFixed(2)};
  tl.fromTo("#dBg", { scale: 1.1 }, { scale: 1.3, duration: ${D[1].toFixed(2)}, ease: "none" }, d);
  tl.from("#dCard", { y: 500, rotation: 14, opacity: 0, duration: 0.7, ease: "back.out(1.5)" }, d + 0.08);
  tl.fromTo("#dCard", { rotation: -3, y: 0 }, { rotation: 3, y: -18, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: 2 }, d + 0.8);
  tl.from("#dName", { y: 80, opacity: 0, duration: 0.5, ease: "power4.out" }, d + 0.45);
  ${product.price ? `tl.from("#dPrice", { scale: 0.4, opacity: 0, duration: 0.5, ease: "back.out(2.2)" }, d + 0.7);` : ""}
  tl.from("#btn", { y: 170, opacity: 0, duration: 0.55, ease: "expo.out" }, d + 0.95);
  tl.fromTo("#btn", { scale: 1 }, { scale: 1.06, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 3 }, d + 1.6);
  tl.fromTo("#btnShine", { x: -300 }, { x: 1000, duration: 0.9, ease: "power2.inOut" }, d + 1.5);
  tl.fromTo("#btnShine", { x: -300 }, { x: 1000, duration: 0.9, ease: "power2.inOut" }, d + 2.8);
  tl.from("#domain", { opacity: 0, duration: 0.4 }, d + 1.3);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);${web ? WEB_PLAYER : ""}
</script>
</body>
</html>
`;
}
