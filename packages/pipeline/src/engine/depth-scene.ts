import type { NormalizedProduct, PostReadyBrief } from "@postready/core";
import type { ComposeOptions } from "./classic-scene.js";
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
  mix,
  rng,
} from "./html-kit.js";

export function compose3d(
  product: NormalizedProduct,
  brief: PostReadyBrief,
  images: string[],
  { web = false, audio = null, cutouts = [] }: ComposeOptions = {},
): string {
  const t = THEME[brief.theme] ?? THEME.noir;
  const bg = brief.palette.bg;
  let accent = brief.palette.accent;
  if (contrast(bg, accent) < 1.6) accent = lum(bg) > 0.4 ? "#111114" : "#ffd23f";
  const ink = inkOn(bg);
  const onAccent = inkOn(accent);
  const dark = ink === "#ffffff";
  const soft = dark ? "rgba(255,255,255,.66)" : "rgba(12,12,16,.64)";
  const glass = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.62)";
  const glassLine = dark ? "rgba(255,255,255,.2)" : "rgba(12,12,16,.1)";
  const bg2 = mix(bg, dark ? "#000000" : "#ffffff", 0.35);
  const up = (s: unknown) => (t.upper ? String(s).toUpperCase() : String(s));
  const img = (i: number) => images[i] ?? images[0];
  const cut = cutouts[brief.heroImage] ?? cutouts.find(Boolean) ?? null;
  const italic = brief.theme === "editorial" ? "font-style:italic;" : "";
  const glow = brief.theme === "neon" ? `text-shadow:0 0 46px ${accent};` : "";

  const hookWords = up(brief.hook).split(" ").filter(Boolean);
  const hookSize = fitSize(
    hookWords.reduce((a, b) => (a.length >= b.length ? a : b), ""),
    940,
    t.display === "Unbounded" ? 220 : 310,
    t.wide,
  );
  const name = up(brief.name);
  const nameSize = Math.min(
    124,
    fitSize(longestWord(name), 940, 124, t.wide + 0.1),
    Math.max(70, fitSize(name, 1750, 124, t.wide)),
  );

  const ringOrder = [brief.heroImage, ...brief.featureImages, ...images.map((_, i) => i)].filter(
    (v, i, a) => a.indexOf(v) === i,
  );
  const ring = Array.from({ length: 5 }, (_, i) => img(ringOrder[i % ringOrder.length]));
  const CARD_W = 520;
  const RADIUS = Math.round(CARD_W / 2 / Math.tan(Math.PI / 5) + 150);

  const X = 0.4;
  const A = [0, 2.7];
  const B = [2.7 - X, 3.7 + X];
  const C = [6.4 - X, 4.6 + X];
  const D = [11.0 - X, DURATION - 11.0 + X];

  const r = rng(hookWords.join("").length * 7919 + name.length * 104729 + 17);
  const sparks = Array.from({ length: 18 }, () => ({
    x: Math.round(r() * W),
    y: Math.round(r() * H),
    s: Math.round(6 + r() * 16),
    d: +(4 + r() * 6).toFixed(2),
    o: +(0.25 + r() * 0.5).toFixed(2),
    drift: Math.round(120 + r() * 260),
  }));
  const confetti = Array.from({ length: 34 }, (_, i) => {
    const ang = r() * Math.PI * 2;
    const dist = 420 + r() * 620;
    return {
      x: Math.round(Math.cos(ang) * dist),
      y: Math.round(Math.sin(ang) * dist - 220),
      rot: Math.round(r() * 720 - 360),
      w: Math.round(14 + r() * 22),
      h: Math.round(10 + r() * 30),
      c: i % 3 === 0 ? onAccent : i % 3 === 1 ? bg : mix(accent, "#ffffff", 0.55),
      round: r() > 0.6,
    };
  });

  const feats = brief.features
    .map(
      (f, i) => `
      <div class="feat" id="feat${i}">
        <div class="fnum display">0${i + 1}</div>
        <div class="ftext">
          <div class="ftitle display" style="font-size:${fitSize(up(f.title), 640, 70, t.wide)}px">${esc(
            up(f.title),
          )}</div>
          <div class="fline">${esc(f.line)}</div>
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
  :root { --bg:${bg}; --bg2:${bg2}; --accent:${accent}; --ink:${ink}; --on-accent:${onAccent}; --soft:${soft}; --glass:${glass}; --gline:${glassLine}; --r:${t.radius}px; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${W}px; height:${H}px; overflow:hidden; background:var(--bg); }
  body { font-family:"${t.body}", system-ui, sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased; }
  #root { position:relative; width:${W}px; height:${H}px; overflow:hidden; background:radial-gradient(120% 80% at 50% 0%, var(--bg) 0%, var(--bg2) 100%); }
  .display { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.92; }
  .scene { position:absolute; inset:0; perspective:1500px; perspective-origin:50% 42%; }
  .stage { position:absolute; inset:0; transform-style:preserve-3d; }
  img { display:block; }

  #bgLayer { position:absolute; inset:0; overflow:hidden; }
  .orb { position:absolute; border-radius:50%; filter:blur(130px); }
  #orb1 { width:900px; height:900px; left:-260px; top:-200px; background:var(--accent); opacity:${dark ? 0.5 : 0.34}; }
  #orb2 { width:760px; height:760px; right:-300px; top:760px; background:${mix(accent, dark ? "#ffffff" : "#000000", 0.25)}; opacity:${dark ? 0.32 : 0.2}; }
  #orb3 { width:820px; height:820px; left:120px; bottom:-420px; background:var(--accent); opacity:${dark ? 0.36 : 0.26}; }
  #floor { position:absolute; left:-540px; right:-540px; bottom:-380px; height:1500px; transform:perspective(900px) rotateX(74deg); transform-origin:50% 100%;
    background-image:linear-gradient(var(--gline) 2px, transparent 2px), linear-gradient(90deg, var(--gline) 2px, transparent 2px); background-size:120px 120px; -webkit-mask-image:linear-gradient(transparent 0%, #000 55%); mask-image:linear-gradient(transparent 0%, #000 55%); opacity:.9; }
  .spark { position:absolute; border-radius:50%; background:var(--ink); }
  ${web ? WEB_STYLE : ""}

  #hookBack { position:absolute; left:50%; top:50%; width:1500px; height:1500px; margin:-750px 0 0 -750px; object-fit:cover; border-radius:50%; opacity:.2; filter:blur(10px) saturate(1.2); }
  #band { position:absolute; left:-300px; top:1480px; width:1700px; padding:26px 0; background:var(--accent); color:var(--on-accent); transform:rotate(-7deg); white-space:nowrap; overflow:hidden; font-size:54px; }
  #bandText { display:inline-block; }
  #hook { position:absolute; left:70px; right:70px; top:300px; font-size:${hookSize}px; ${italic}${glow} transform-style:preserve-3d; }
  #hook .w { display:block; transform-origin:50% 100%; backface-visibility:hidden; }
  #brandTop { position:absolute; left:70px; top:150px; font-weight:700; font-size:32px; letter-spacing:.18em; text-transform:uppercase; padding:16px 28px; border-radius:999px; background:var(--ink); color:var(--bg); }

  #ringWrap { position:absolute; left:50%; top:700px; width:0; height:0; transform-style:preserve-3d; transform:translateZ(${-RADIUS}px) rotateX(-9deg); }
  #ring { position:absolute; left:0; top:0; width:0; height:0; transform-style:preserve-3d; }
  .rcard { position:absolute; left:${-CARD_W / 2}px; top:-340px; width:${CARD_W}px; height:680px; border-radius:var(--r); overflow:hidden; background:#fff; box-shadow:0 50px 90px rgba(0,0,0,.35); backface-visibility:hidden; }
  .rcard img { width:100%; height:100%; object-fit:cover; }
  #nameB { position:absolute; left:60px; right:60px; top:1190px; text-align:center; font-size:${nameSize}px; text-wrap:balance; ${glow} }
  #tagB { position:absolute; left:90px; right:90px; top:${1190 + Math.round(nameSize * (name.length > 14 ? 2.05 : 1.15))}px; text-align:center; font-size:48px; font-weight:500; line-height:1.22; color:var(--soft); text-wrap:balance; }
  #priceB { position:absolute; right:110px; top:250px; z-index:5; background:var(--accent); color:var(--on-accent); font-size:86px; padding:22px 44px; border-radius:999px; box-shadow:0 26px 60px rgba(0,0,0,.3); }

  #heroWrap { position:absolute; left:50%; top:170px; width:0; height:0; transform-style:preserve-3d; }
  #heroCard { position:absolute; left:-330px; top:0; width:660px; height:740px; border-radius:var(--r); overflow:hidden; background:#fff; box-shadow:0 60px 120px rgba(0,0,0,.38); }
  #heroCard img { width:100%; height:100%; object-fit:cover; }
  #shine { position:absolute; top:-20%; left:0; width:38%; height:140%; background:linear-gradient(100deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%); transform:skewX(-14deg); }
  #heroHalo { position:absolute; left:-380px; top:-10px; width:760px; height:760px; border-radius:50%; background:radial-gradient(circle, ${accent} 0%, transparent 68%); opacity:.75; }
  #heroCard.cut { background:none; box-shadow:none; overflow:visible; border-radius:0; }
  #heroCard.cut img { object-fit:contain; filter:drop-shadow(0 46px 44px rgba(0,0,0,.42)); }
  #ctaImg.cut { overflow:visible; background:rgba(255,255,255,.2); box-shadow:none; }
  #ctaImg.cut img { object-fit:contain; width:112%; height:112%; margin:-6% 0 0 -6%; filter:drop-shadow(0 40px 40px rgba(0,0,0,.4)); }
  .feat { position:absolute; left:70px; width:940px; height:240px; display:flex; align-items:center; gap:36px; padding:0 44px; border-radius:var(--r); background:var(--glass); border:2px solid var(--gline); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); transform-origin:50% 0%; backface-visibility:hidden; }
  #feat0 { top:1000px; } #feat1 { top:1270px; } #feat2 { top:1540px; }
  .fnum { flex:0 0 auto; font-size:92px; color:var(--accent); ${glow} }
  .ftitle { ${italic} }
  .fline { margin-top:14px; font-size:40px; font-weight:500; line-height:1.2; color:var(--soft); text-wrap:balance; }

  #sD { background:var(--accent); color:var(--on-accent); }
  #rays { position:absolute; left:50%; top:560px; width:2600px; height:2600px; margin:-1300px 0 0 -1300px; border-radius:50%; background:repeating-conic-gradient(from 0deg, rgba(255,255,255,.14) 0deg 7deg, transparent 7deg 18deg); -webkit-mask-image:radial-gradient(circle, #000 0%, transparent 62%); mask-image:radial-gradient(circle, #000 0%, transparent 62%); }
  #dash { position:absolute; left:50%; top:560px; width:820px; height:820px; margin:-410px 0 0 -410px; border-radius:50%; border:10px dashed var(--on-accent); opacity:.5; }
  #ctaImg { position:absolute; left:50%; top:560px; width:660px; height:660px; margin:-330px 0 0 -330px; border-radius:50%; overflow:hidden; background:#fff; box-shadow:0 50px 110px rgba(0,0,0,.34); }
  #ctaImg img { width:100%; height:100%; object-fit:cover; }
  .conf { position:absolute; left:50%; top:560px; }
  #ctaName { position:absolute; left:60px; right:60px; top:1030px; text-align:center; font-size:${Math.round(nameSize * 0.88)}px; text-wrap:balance; }
  #ctaPrice { position:absolute; left:0; right:0; top:1330px; text-align:center; font-size:156px; }
  #ctaPrice s { font-size:64px; opacity:.55; margin-right:24px; font-weight:500; font-family:"${t.body}", sans-serif; letter-spacing:0; }
  #btn { position:absolute; left:130px; right:130px; top:1545px; height:156px; border-radius:999px; background:var(--on-accent); color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:68px; overflow:hidden; }
  #btnShine { position:absolute; top:0; left:0; width:30%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent); transform:skewX(-16deg); }
  #domain { position:absolute; left:0; right:0; top:1745px; text-align:center; font-weight:700; font-size:36px; letter-spacing:.1em; opacity:.85; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="${W}" data-height="${H}">
  <div id="bgLayer">
    <div class="orb" id="orb1"></div><div class="orb" id="orb2"></div><div class="orb" id="orb3"></div>
    <div id="floor"></div>
    ${sparks.map((s, i) => `<div class="spark" id="sp${i}" style="left:${s.x}px;top:${s.y}px;width:${s.s}px;height:${s.s}px;opacity:${s.o}"></div>`).join("")}
  </div>

  <div id="sA" class="scene clip" data-start="${A[0]}" data-duration="${A[1]}" data-track-index="0">
    <div class="stage" id="stA">
      <img id="hookBack" src="${esc(img(brief.heroImage))}" alt="" />
      <div id="brandTop">${esc(product.brand)}</div>
      <div id="hook" class="display">${hookWords.map((w) => `<span class="w">${esc(w)}</span>`).join("")}</div>
      <div id="band" class="display"><span id="bandText">${Array.from({ length: 8 }, () => esc(up(product.brand))).join(" &nbsp;✦&nbsp; ")}</span></div>
    </div>
  </div>

  <div id="sB" class="scene clip" data-start="${B[0].toFixed(2)}" data-duration="${B[1].toFixed(2)}" data-track-index="1">
    <div class="stage" id="stB">
      <div id="ringWrap"><div id="ring">
        ${ring.map((src, i) => `<div class="rcard" style="transform:rotateY(${i * 72}deg) translateZ(${RADIUS}px)"><img src="${esc(src)}" alt="" /></div>`).join("\n        ")}
      </div></div>
      ${product.price ? `<div id="priceB" class="display">${esc(product.price)}</div>` : ""}
      <div id="nameB" class="display">${esc(name)}</div>
      <div id="tagB">${esc(brief.tagline)}</div>
    </div>
  </div>

  <div id="sC" class="scene clip" data-start="${C[0].toFixed(2)}" data-duration="${C[1].toFixed(2)}" data-track-index="2">
    <div class="stage" id="stC">
      <div id="heroWrap">${cut ? `<div id="heroHalo"></div><div id="heroCard" class="cut"><img src="${esc(cut)}" alt="" /></div>` : `<div id="heroCard"><img src="${esc(img(brief.heroImage))}" alt="" /><div id="shine"></div></div>`}</div>
      ${feats}
    </div>
  </div>

  <div id="sD" class="scene clip" data-start="${D[0].toFixed(2)}" data-duration="${D[1].toFixed(2)}" data-track-index="3">
    <div class="stage" id="stD">
      <div id="rays"></div>
      <div id="dash"></div>
      ${confetti.map((c, i) => `<div class="conf" id="cf${i}" style="width:${c.w}px;height:${c.h}px;background:${c.c};border-radius:${c.round ? "50%" : "4px"}"></div>`).join("")}
      <div id="ctaImg"${cut ? ' class="cut"' : ""}><img src="${esc(cut ?? img(brief.heroImage))}" alt="" /></div>
      <div id="ctaName" class="display">${esc(name)}</div>
      ${product.price ? `<div id="ctaPrice" class="display">${product.compareAt ? `<s>${esc(product.compareAt)}</s>` : ""}${esc(product.price)}</div>` : ""}
      <div id="btn" class="display"><span>${esc(up(brief.cta))}</span><div id="btnShine"></div></div>
      <div id="domain">${esc(product.domain)}</div>
    </div>
  </div>
  ${audio ? `<audio class="clip" data-start="0" data-duration="${DURATION}" data-track-index="9" data-volume="0.95" src="${esc(audio)}"></audio>` : ""}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  const D_ = ${DURATION};

  tl.fromTo("#orb1", { x: 0, y: 0 }, { x: 320, y: 420, duration: D_, ease: "sine.inOut" }, 0);
  tl.fromTo("#orb2", { x: 0, y: 0 }, { x: -380, y: -520, duration: D_, ease: "sine.inOut" }, 0);
  tl.fromTo("#orb3", { x: 0, scale: 1 }, { x: 260, scale: 1.3, duration: D_, ease: "sine.inOut" }, 0);
  tl.fromTo("#floor", { backgroundPositionY: "0px" }, { backgroundPositionY: "720px", duration: D_, ease: "none" }, 0);
  ${JSON.stringify(sparks.map((s) => [s.drift, s.d]))}.forEach(([drift, d], i) => {
    tl.fromTo("#sp" + i, { y: 0 }, { y: -drift, duration: D_, ease: "none" }, 0);
    tl.fromTo("#sp" + i, { scale: 0.4 }, { scale: 1.3, duration: d / 2, ease: "sine.inOut", yoyo: true, repeat: Math.ceil(D_ / (d / 2)) }, 0);
  });

  const push = (out, inn, at) => {
    tl.to(out, { scale: 1.6, z: 500, opacity: 0, duration: ${X}, ease: "power2.in" }, at - ${X});
    tl.fromTo(inn, { scale: 0.72, rotationX: 14, opacity: 0 }, { scale: 1, rotationX: 0, opacity: 1, duration: 0.6, ease: "expo.out" }, at - ${X} + 0.08);
  };
  push("#stA", "#stB", ${A[1]});
  push("#stB", "#stC", ${(C[0] + X).toFixed(2)});
  push("#stC", "#stD", ${(D[0] + X).toFixed(2)});

  tl.from("#brandTop", { y: -90, opacity: 0, duration: 0.45, ease: "back.out(1.8)" }, 0.05);
  tl.from("#hook .w", { rotationX: -92, y: 60, opacity: 0, duration: 0.6, ease: "back.out(1.5)", stagger: 0.14 }, 0.15);
  tl.fromTo("#hook", { z: -120 }, { z: 90, duration: ${A[1]}, ease: "none" }, 0);
  tl.fromTo("#hookBack", { scale: 0.9, rotation: -10 }, { scale: 1.25, rotation: 12, duration: ${A[1]}, ease: "none" }, 0);
  tl.from("#band", { x: -1300, duration: 0.7, ease: "expo.out" }, 0.55);
  tl.fromTo("#bandText", { x: 0 }, { x: -420, duration: ${A[1]}, ease: "none" }, 0);

  const b = ${B[0].toFixed(2)};
  tl.fromTo("#ring", { rotationY: 62 }, { rotationY: -288, duration: ${(B[1] - 0.1).toFixed(2)}, ease: "power2.inOut" }, b + 0.05);
  tl.fromTo("#ringWrap", { y: 60 }, { y: -30, duration: ${B[1].toFixed(2)}, ease: "sine.inOut" }, b);
  ${product.price ? `tl.set("#priceB", { rotation: 8 }, 0); tl.from("#priceB", { scale: 0, rotation: -40, duration: 0.55, ease: "back.out(2.2)" }, b + 0.9);` : ""}
  tl.from("#nameB", { y: 120, opacity: 0, rotationX: -50, duration: 0.6, ease: "expo.out" }, b + 0.55);
  tl.from("#tagB", { y: 70, opacity: 0, duration: 0.55, ease: "power4.out" }, b + 0.95);

  const c = ${C[0].toFixed(2)};
  tl.from("#heroWrap", { y: -160, z: -500, opacity: 0, duration: 0.7, ease: "expo.out" }, c + 0.3);
  tl.fromTo("#heroCard", { rotationY: -22, rotationX: 7 }, { rotationY: 20, rotationX: -5, duration: ${(C[1] - 0.3).toFixed(2)}, ease: "sine.inOut" }, c + 0.3);
  ${cut ? `tl.fromTo("#heroHalo", { scale: 0.5, opacity: 0 }, { scale: 1.15, opacity: 0.75, duration: 1.2, ease: "power2.out" }, c + 0.3);
  tl.fromTo("#heroCard img", { y: 0 }, { y: -26, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: 2 }, c + 0.9);` : `tl.fromTo("#shine", { x: -420 }, { x: 900, duration: 1.1, ease: "power2.inOut" }, c + 0.9);
  tl.fromTo("#shine", { x: -420 }, { x: 900, duration: 1.1, ease: "power2.inOut" }, c + 3.1);`}
  [0, 1, 2].forEach((i) => {
    const at = c + 0.75 + i * 0.95;
    tl.from("#feat" + i, { rotationX: -88, z: -260, opacity: 0, duration: 0.65, ease: "back.out(1.3)" }, at);
    tl.from("#feat" + i + " .fnum", { scale: 0, duration: 0.45, ease: "back.out(2.4)" }, at + 0.18);
    tl.from("#feat" + i + " .ftext", { x: 90, opacity: 0, duration: 0.45, ease: "power4.out" }, at + 0.22);
  });

  const d = ${(D[0] + X).toFixed(2)};
  tl.fromTo("#rays", { rotation: 0 }, { rotation: 70, duration: ${(D[1]).toFixed(2)}, ease: "none" }, d - ${X});
  tl.fromTo("#dash", { rotation: 0, scale: 0.6 }, { rotation: -120, scale: 1, duration: ${(D[1]).toFixed(2)}, ease: "power1.out" }, d - ${X});
  tl.from("#ctaImg", { scale: 0, rotation: -40, duration: 0.75, ease: "back.out(1.7)" }, d + 0.05);
  tl.fromTo("#ctaImg", { y: 0 }, { y: -24, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 2 }, d + 0.8);
  ${JSON.stringify(confetti.map((c) => [c.x, c.y, c.rot]))}.forEach(([x, y, rot], i) => {
    tl.set("#cf" + i, { opacity: 0 }, 0);
    tl.fromTo("#cf" + i, { x: 0, y: 0, rotation: 0, scale: 0.3, opacity: 1 }, { x, y, rotation: rot, scale: 1, duration: 1.1, ease: "power3.out" }, d + 0.45 + (i % 6) * 0.02);
    tl.to("#cf" + i, { y: y + 520, opacity: 0, duration: 1.5, ease: "power1.in" }, d + 1.5 + (i % 6) * 0.02);
  });
  tl.from("#ctaName", { y: 90, opacity: 0, duration: 0.5, ease: "power4.out" }, d + 0.45);
  ${product.price ? `tl.from("#ctaPrice", { scale: 0.4, opacity: 0, duration: 0.55, ease: "back.out(2.2)" }, d + 0.75);` : ""}
  tl.from("#btn", { y: 180, opacity: 0, duration: 0.55, ease: "expo.out" }, d + 1.0);
  tl.fromTo("#btn", { scale: 1 }, { scale: 1.06, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 3 }, d + 1.7);
  tl.fromTo("#btnShine", { x: -300 }, { x: 1000, duration: 0.9, ease: "power2.inOut" }, d + 1.6);
  tl.fromTo("#btnShine", { x: -300 }, { x: 1000, duration: 0.9, ease: "power2.inOut" }, d + 2.9);
  tl.from("#domain", { opacity: 0, duration: 0.4 }, d + 1.35);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);${web ? WEB_PLAYER : ""}
</script>
</body>
</html>
`;
}
