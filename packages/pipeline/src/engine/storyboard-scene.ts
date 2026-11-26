import type { NormalizedProduct, PostReadyStoryboard } from "@postready/core";
import {
  DURATION,
  H,
  THEME,
  type ThemeSpec,
  W,
  WEB_PLAYER,
  WEB_STYLE,
  contrast,
  esc,
  fitSize,
  inkOn,
  longestWord,
  lum,
  rng,
} from "./html-kit.js";

export { DURATION } from "./html-kit.js";
export const THEMES = ["pop", "noir", "editorial", "neon"] as const;
export const MOTIFS = [
  "none",
  "snow",
  "bubbles",
  "sparks",
  "steam",
  "petals",
  "hearts",
  "stars",
  "rain",
] as const;
export const SCENE_TYPES = [
  "statement",
  "problem",
  "reveal",
  "callouts",
  "counter",
  "compare",
  "checklist",
  "gallery",
  "gauge",
  "price",
  "cta",
] as const;
const TRANSITIONS = ["slide", "iris", "flash", "push", "wipe"] as const;

const words = (s: unknown, n: number): string =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, n)
    .join(" ");
const hexOr = (v: unknown, d: string): string =>
  /^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v).toLowerCase() : d;
const oneOf = <T>(v: unknown, list: readonly T[], d: T): T =>
  list.includes(v as T) ? (v as T) : d;
const list = <T>(v: unknown, n: number, each: (item: unknown) => T | null): T[] =>
  (Array.isArray(v) ? v : []).slice(0, n).map(each).filter((x): x is T => Boolean(x));

type SceneRec = Record<string, unknown> & {
  type: string;
  seconds: number;
  start: number;
  bg: string;
  transition: string | null;
};

export function normalizeStoryboard(
  raw: Record<string, unknown>,
  product: NormalizedProduct,
  themeOverride?: "auto" | "pop" | "noir" | "editorial" | "neon",
): PostReadyStoryboard {
  const nImg = Math.max(1, product.images.length);
  const idx = (v: unknown, d = 0) =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < nImg ? v : d % nImg;
  const facts = `${product.title} ${product.description} ${(product.bullets ?? []).join(" ")} ${
    (product.tags ?? []).join(" ")
  } ${product.price ?? ""}`.toLowerCase();
  const sb = raw && typeof raw === "object" ? raw : {};
  const theme =
    themeOverride && themeOverride !== "auto"
      ? themeOverride
      : oneOf(sb.theme, THEMES, "noir");
  const pal = (sb.palette ?? {}) as { bg?: unknown; accent?: unknown };
  let bg = hexOr(pal.bg, "#0b0b0f");
  let accent = hexOr(pal.accent, "#ff4d2e");
  if (contrast(bg, accent) < 1.6) accent = lum(bg) > 0.4 ? "#111114" : "#ffd23f";

  const clean = (rawScene: unknown): SceneRec | null => {
    const s = (rawScene ?? {}) as Record<string, unknown>;
    const type = oneOf(s?.type, SCENE_TYPES, "");
    if (!type) return null;
    const base = {
      type,
      seconds: Math.min(4, Math.max(1.4, Number(s.seconds) || 2.4)),
      start: 0,
      bg: oneOf(s.bg, ["base", "accent", "contrast"] as const, "base"),
      transition: s.transition ? oneOf(s.transition, TRANSITIONS, "slide") : null,
    };
    if (type === "statement") {
      const lines = list(s.lines, 3, (l) => words(l, 4));
      if (!lines.length) return null;
      return {
        ...base,
        lines,
        mode: oneOf(s.mode, ["slam", "typewriter", "stack"] as const, "slam"),
        emphasis: words(s.emphasis, 1),
      };
    }
    if (type === "problem") {
      const variant = oneOf(s.variant, ["search", "chat", "notification"] as const, "chat");
      const messages = list(s.messages, variant === "search" ? 1 : 3, (m) => words(m, 8));
      if (!messages.length) return null;
      return { ...base, variant, messages, caption: words(s.caption, 6) };
    }
    if (type === "reveal") {
      return {
        ...base,
        entrance: oneOf(s.entrance, ["drop", "spin", "zoom"] as const, "drop"),
        kicker: words(s.kicker, 4),
        image: idx(s.image, 0),
      };
    }
    if (type === "callouts") {
      const callouts = list(s.callouts, 3, (c) => words(c, 4));
      return callouts.length >= 2 ? { ...base, callouts, image: idx(s.image, 0) } : null;
    }
    if (type === "counter") {
      const value = Number(s.value);
      if (!Number.isFinite(value) || value <= 0 || value > 100000 || !facts.includes(String(s.value).toLowerCase())) {
        return null;
      }
      return {
        ...base,
        value,
        decimals: Number.isInteger(value) ? 0 : Math.min(2, (String(value).split(".")[1] ?? "").length),
        prefix: words(s.prefix, 1).slice(0, 2),
        unit: words(s.unit, 2).slice(0, 12),
        caption: words(s.caption, 6),
      };
    }
    if (type === "compare") {
      const left = list(s.left, 3, (c) => words(c, 4));
      const right = list(s.right, 3, (c) => words(c, 4));
      return left.length && right.length
        ? {
            ...base,
            left,
            right,
            leftTitle: words(s.leftTitle || "The usual", 3),
            rightTitle: words(s.rightTitle || product.brand, 3),
          }
        : null;
    }
    if (type === "checklist") {
      const items = list(s.items, 4, (c) => words(c, 5));
      return items.length >= 2 ? { ...base, items, title: words(s.title, 4) } : null;
    }
    if (type === "gallery") {
      const imgs = list(s.images, 4, (i) =>
        typeof i === "number" && Number.isInteger(i) && i >= 0 && i < nImg ? { i } : null,
      ).map((o) => o.i);
      while (imgs.length < Math.min(3, nImg)) imgs.push(imgs.length % nImg);
      return {
        ...base,
        images: imgs.slice(0, 4),
        variant: oneOf(s.variant, ["polaroids", "filmstrip", "grid"] as const, "polaroids"),
        caption: words(s.caption, 6),
      };
    }
    if (type === "gauge") {
      return {
        ...base,
        variant: oneOf(s.variant, ["radar", "battery", "ring", "thermo"] as const, "ring"),
        value: Math.min(100, Math.max(5, Number(s.value) || 100)),
        label: words(s.label, 3),
        caption: words(s.caption, 6),
      };
    }
    if (type === "price") return product.price ? { ...base, caption: words(s.caption, 5) } : null;
    if (type === "cta") {
      return {
        ...base,
        label: words(s.label || "Shop now", 3),
        line: words(s.line, 6),
        image: idx(s.image, 0),
      };
    }
    return null;
  };

  let scenes = (Array.isArray(sb.scenes) ? sb.scenes : [])
    .map(clean)
    .filter((x): x is SceneRec => Boolean(x));
  const last =
    scenes.filter((s) => s.type === "cta").pop() ?? {
      type: "cta",
      seconds: 2.8,
      start: 0,
      bg: "accent",
      transition: null,
      label: "Shop now",
      line: "",
      image: 0,
    };
  scenes = scenes.filter((s) => s.type !== "cta").slice(0, 6);
  if (!scenes.length || !["statement", "problem"].includes(scenes[0].type)) {
    scenes.unshift({
      type: "statement",
      seconds: 2.2,
      start: 0,
      bg: "accent",
      transition: null,
      lines: [words(sb.concept || product.title, 4)],
      mode: "slam",
      emphasis: "",
    });
  }
  if (!scenes.some((s) => s.type === "reveal")) {
    scenes.splice(1, 0, {
      type: "reveal",
      seconds: 2.4,
      start: 0,
      bg: "base",
      transition: null,
      entrance: "drop",
      kicker: "",
      image: 0,
    });
  }
  scenes = [...scenes.slice(0, 6), last];
  scenes.forEach((s, i) => {
    if (i && s.bg === scenes[i - 1].bg) s.bg = s.bg === "base" ? "accent" : "base";
    if (!s.transition) s.transition = TRANSITIONS[i % TRANSITIONS.length];
  });

  const CLOSE = 2.7;
  const body = scenes.slice(0, -1);
  const total = body.reduce((a, s) => a + s.seconds, 0) || 1;
  let t = 0;
  scenes.forEach((s, i) => {
    s.seconds =
      i === scenes.length - 1
        ? +(DURATION - t).toFixed(2)
        : +((s.seconds * (DURATION - CLOSE)) / total).toFixed(2);
    s.start = +t.toFixed(2);
    t += s.seconds;
  });

  const vo = Array.isArray(sb.voiceover)
    ? sb.voiceover.map((v) => words(v, 14)).filter(Boolean).slice(0, 6)
    : [];

  return {
    concept: words(sb.concept, 14),
    name: words(sb.name || product.title, 4),
    theme,
    palette: { bg, accent },
    motif: oneOf(sb.motif, MOTIFS, "sparks"),
    scenes,
    voiceover: vo.length ? vo : undefined,
  };
}

export const storyboardCues = (sb: PostReadyStoryboard) => ({
  cuts: sb.scenes.slice(1).map((s) => s.start),
  pops: sb.scenes
    .filter((s) => ["reveal", "price", "counter"].includes(s.type))
    .map((s) => +(s.start + 0.55).toFixed(2)),
  chime: +(sb.scenes[sb.scenes.length - 1].start + 0.2).toFixed(2),
});

interface SceneCtx {
  i: number;
  P: string;
  t0: number;
  product: NormalizedProduct;
  img: (idx: number) => string;
  cutFor: (idx: number) => string | null;
  t: ThemeSpec;
  up: (s: unknown) => string;
  name: string;
  nameSize: number;
  q: (sel: string) => string;
}

const productBlock = (c: SceneCtx, cls: string, imageIdx: number) => {
  const cut = c.cutFor(imageIdx);
  return cut
    ? `<div class="prod cutp ${cls}"><img src="${esc(cut)}" alt="" /></div>`
    : `<div class="prod card ${cls}"><img src="${esc(c.img(imageIdx))}" alt="" /></div>`;
};

const KIT: Record<string, (s: SceneRec, c: SceneCtx) => { html: string; css: string; js: string }> = {
  statement(s, c) {
    const rawLines = (s.lines as string[]) ?? [];
    const lines = rawLines.map((l) => c.up(l));
    const size = Math.min(
      fitSize(longestWord(lines.join(" ")), 940, 300, c.t.wide + 0.06),
      fitSize(
        lines.reduce((a, b) => (a.length >= b.length ? a : b), ""),
        930,
        300,
        c.t.wide + 0.02,
      ),
      Math.round(1250 / Math.max(1, lines.length)),
    );
    const em = String(s.emphasis ?? "").toLowerCase();
    const mode = String(s.mode ?? "slam");
    const word = (w: string) =>
      `<span class="w${
        em && w.toLowerCase().replace(/[^a-z0-9]/g, "") === em.replace(/[^a-z0-9]/g, "")
          ? " em"
          : ""
      }">${
        mode === "typewriter" ? [...w].map((ch) => `<i>${esc(ch)}</i>`).join("") : esc(w)
      }</span>`;
    const html = `<div class="st st-${mode}" style="font-size:${size}px">${lines
      .map((l) => `<div class="ln">${l.split(" ").map(word).join(" ")}</div>`)
      .join("")}</div><div class="stbar"></div>`;
    const css = `
      ${c.P} .st { position:absolute; left:64px; right:64px; top:50%; transform:translateY(-50%); }
      ${c.P} .ln { display:block; white-space:nowrap; }
      ${c.P} .w { display:inline-block; }
      ${c.P} .w.em { background:var(--sacc); color:var(--son); padding:0 .14em .06em; border-radius:.1em; }
      ${c.P} .w i { font-style:inherit; display:inline-block; }
      ${c.P} .stbar { position:absolute; left:64px; bottom:230px; width:300px; height:18px; border-radius:18px; background:var(--sacc); transform-origin:left center; }`;
    const at = c.t0 + 0.12;
    const js =
      mode === "slam"
        ? `tl.from(${c.q(".w")}, { scale: 3.2, opacity: 0, rotation: -8, duration: 0.34, ease: "power4.in", stagger: 0.16 }, ${at});
           ${lines
             .join(" ")
             .split(" ")
             .map(
               (_, k) =>
                 `tl.fromTo(${c.q(".st")}, { x: 0 }, { x: ${k % 2 ? -16 : 16}, duration: 0.05, yoyo: true, repeat: 3, ease: "none" }, ${(at + 0.34 + k * 0.16).toFixed(2)});`,
             )
             .join("")}`
        : mode === "typewriter"
          ? `tl.from(${c.q(".w i")}, { opacity: 0, duration: 0.001, stagger: ${Math.min(
              0.07,
              (s.seconds * 0.55) / Math.max(1, lines.join("").length),
            ).toFixed(3)} }, ${at});`
          : `${lines
              .map(
                (_, k) =>
                  `tl.from(${c.q(`.ln:nth-child(${k + 1})`)}, { x: ${k % 2 ? 1100 : -1100}, skewX: ${k % 2 ? 18 : -18}, duration: 0.6, ease: "expo.out" }, ${(at + k * 0.2).toFixed(2)});`,
              )
              .join("")}`;
    return {
      html,
      css,
      js:
        js +
        `tl.from(${c.q(".stbar")}, { scaleX: 0, duration: 0.6, ease: "expo.out" }, ${c.t0 + 0.5}); tl.fromTo(${c.q(".st")}, { scale: 1 }, { scale: 1.06, duration: ${s.seconds}, ease: "none" }, ${c.t0});`,
    };
  },

  problem(s, c) {
    const messages = (s.messages as string[]) ?? [];
    const variant = String(s.variant ?? "chat");
    const caption = String(s.caption ?? "");
    if (variant === "search") {
      const q = messages[0] ?? "";
      const html = `<div class="pcap">${esc(caption)}</div>
        <div class="sbar"><div class="mag"></div><div class="qt">${[...q]
          .map((ch) => `<i>${ch === " " ? "&nbsp;" : esc(ch)}</i>`)
          .join("")}<b class="caret"></b></div></div>
        ${[0, 1, 2].map((k) => `<div class="skel" style="top:${1010 + k * 190}px"><u></u><u></u></div>`).join("")}`;
      const css = `
        ${c.P} .pcap { position:absolute; left:70px; right:70px; top:470px; font-size:54px; font-weight:700; opacity:.8; }
        ${c.P} .sbar { position:absolute; left:60px; right:60px; top:700px; height:170px; border-radius:999px; background:#fff; color:#111; display:flex; align-items:center; padding:0 54px; gap:34px; box-shadow:0 30px 80px rgba(0,0,0,.28); }
        ${c.P} .mag { flex:none; width:58px; height:58px; border:10px solid #111; border-radius:50%; position:relative; }
        ${c.P} .mag::after { content:""; position:absolute; right:-26px; bottom:-20px; width:30px; height:10px; background:#111; border-radius:8px; transform:rotate(45deg); }
        ${c.P} .qt { font-size:${fitSize(q, 760, 70, 0.5)}px; font-weight:700; white-space:nowrap; }
        ${c.P} .qt i { font-style:normal; }
        ${c.P} .caret { display:inline-block; width:6px; height:1em; background:#111; vertical-align:-.12em; margin-left:6px; }
        ${c.P} .skel { position:absolute; left:90px; right:90px; height:150px; border-radius:28px; background:var(--sink); opacity:.1; padding:34px 40px; }
        ${c.P} .skel u { display:block; height:22px; border-radius:20px; background:var(--sbg); margin-bottom:22px; width:70%; }
        ${c.P} .skel u + u { width:42%; }`;
      const js = `tl.from(${c.q(".sbar")}, { y: -260, opacity: 0, duration: 0.55, ease: "back.out(1.6)" }, ${c.t0 + 0.1});
        tl.from(${c.q(".pcap")}, { opacity: 0, y: 40, duration: 0.4 }, ${c.t0 + 0.05});
        tl.from(${c.q(".qt i")}, { opacity: 0, duration: 0.001, stagger: ${Math.min(0.07, (s.seconds * 0.45) / Math.max(1, q.length)).toFixed(3)} }, ${c.t0 + 0.55});
        tl.fromTo(${c.q(".caret")}, { opacity: 1 }, { opacity: 0, duration: 0.25, yoyo: true, repeat: ${Math.ceil(s.seconds / 0.25)}, ease: "steps(1)" }, ${c.t0});
        tl.from(${c.q(".skel")}, { opacity: 0, y: 80, duration: 0.4, stagger: 0.12 }, ${c.t0 + s.seconds * 0.55});
        tl.to(${c.q(".skel")}, { x: 14, duration: 0.06, yoyo: true, repeat: 5, ease: "none" }, ${c.t0 + s.seconds * 0.78});`;
      return { html, css, js };
    }
    if (variant === "notification") {
      const html = `<div class="clock">9:41</div>${messages
        .map(
          (m, k) =>
            `<div class="note" style="top:${640 + k * 250}px"><div class="app display">${esc(
              String(c.product.brand).charAt(0).toUpperCase(),
            )}</div><div><b>${esc(k ? "Reminder" : "Now")}</b><span>${esc(m)}</span></div></div>`,
        )
        .join("")}<div class="pcap">${esc(caption)}</div>`;
      const css = `
        ${c.P} .clock { position:absolute; left:0; right:0; top:240px; text-align:center; font-size:230px; font-weight:700; letter-spacing:-.04em; opacity:.92; }
        ${c.P} .note { position:absolute; left:60px; right:60px; height:210px; border-radius:48px; background:rgba(255,255,255,.92); color:#111; display:flex; align-items:center; gap:34px; padding:0 40px; box-shadow:0 30px 70px rgba(0,0,0,.25); }
        ${c.P} .app { flex:none; width:120px; height:120px; border-radius:30px; background:var(--accent); color:var(--on-accent); display:flex; align-items:center; justify-content:center; font-size:68px; }
        ${c.P} .note b { display:block; font-size:34px; opacity:.55; margin-bottom:6px; }
        ${c.P} .note span { font-size:${Math.min(52, fitSize(messages.reduce((a, b) => (a.length >= b.length ? a : b), ""), 720, 52, 0.5))}px; font-weight:700; line-height:1.1; }
        ${c.P} .pcap { position:absolute; left:70px; right:70px; bottom:210px; font-size:60px; font-weight:700; text-align:center; }`;
      const js = `tl.from(${c.q(".clock")}, { opacity: 0, duration: 0.3 }, ${c.t0});
        tl.from(${c.q(".note")}, { y: -500, opacity: 0, duration: 0.55, ease: "back.out(1.5)", stagger: ${Math.min(0.5, (s.seconds * 0.55) / Math.max(1, messages.length)).toFixed(2)} }, ${c.t0 + 0.2});
        tl.from(${c.q(".pcap")}, { opacity: 0, y: 60, duration: 0.4 }, ${c.t0 + s.seconds * 0.6});`;
      return { html, css, js };
    }
    const gap = Math.min(0.75, (s.seconds * 0.7) / Math.max(1, messages.length));
    const html = `${messages
      .map(
        (m, k) =>
          `<div class="bub b${k} ${k % 2 ? "me" : "them"}" style="top:${520 + k * 300}px">${esc(
            m,
          )}</div><div class="dots d${k} ${k % 2 ? "me" : "them"}" style="top:${560 + k * 300}px"><i></i><i></i><i></i></div>`,
      )
      .join("")}<div class="pcap">${esc(caption)}</div>`;
    const css = `
      ${c.P} .bub { position:absolute; max-width:780px; padding:44px 54px; border-radius:64px; font-size:${Math.min(
        64,
        fitSize(
          messages.reduce((a, b) => (a.length >= b.length ? a : b), ""),
          1150,
          64,
          0.5,
        ),
      )}px; font-weight:700; line-height:1.15; box-shadow:0 24px 60px rgba(0,0,0,.2); }
      ${c.P} .bub.them { left:60px; background:#fff; color:#111; border-bottom-left-radius:16px; transform-origin:0 100%; }
      ${c.P} .bub.me { right:60px; background:var(--accent); color:var(--on-accent); border-bottom-right-radius:16px; transform-origin:100% 100%; }
      ${c.P} .dots { position:absolute; display:flex; gap:14px; padding:34px 40px; border-radius:50px; background:rgba(127,127,127,.35); }
      ${c.P} .dots.them { left:60px; } ${c.P} .dots.me { right:60px; }
      ${c.P} .dots i { width:22px; height:22px; border-radius:50%; background:var(--sink); opacity:.7; }
      ${c.P} .pcap { position:absolute; left:70px; right:70px; bottom:210px; font-size:58px; font-weight:700; text-align:center; }`;
    const js =
      messages
        .map((_, k) => {
          const a = c.t0 + 0.1 + k * gap;
          return `tl.fromTo(${c.q(`.d${k}`)}, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.16 }, ${a.toFixed(2)});
            tl.to(${c.q(`.d${k}`)}, { opacity: 0, duration: 0.08 }, ${(a + gap * 0.42).toFixed(2)});
            tl.from(${c.q(`.b${k}`)}, { scale: 0, opacity: 0, duration: 0.4, ease: "back.out(1.9)" }, ${(a + gap * 0.45).toFixed(2)});`;
        })
        .join("") +
      `tl.from(${c.q(".pcap")}, { opacity: 0, y: 60, duration: 0.4 }, ${(c.t0 + s.seconds * 0.72).toFixed(2)});`;
    return { html, css, js };
  },

  reveal(s, c) {
    const kicker = String(s.kicker ?? "");
    const html = `<div class="burst"></div><div class="ground"></div>${productBlock(
      c,
      "hero",
      Number(s.image ?? 0),
    )}${kicker ? `<div class="kick">${esc(kicker)}</div>` : ""}<div class="rname display" style="font-size:${c.nameSize}px">${esc(
      c.name,
    )}</div>`;
    const css = `
      ${c.P} .burst { position:absolute; left:50%; top:760px; width:2400px; height:2400px; margin:-1200px 0 0 -1200px; border-radius:50%; background:repeating-conic-gradient(from 0deg, var(--sacc) 0deg 6deg, transparent 6deg 20deg); opacity:.2; -webkit-mask-image:radial-gradient(circle, #000 0%, transparent 60%); mask-image:radial-gradient(circle, #000 0%, transparent 60%); }
      ${c.P} .ground { position:absolute; left:50%; top:1200px; width:620px; height:70px; margin-left:-310px; border-radius:50%; background:rgba(0,0,0,.34); filter:blur(26px); }
      ${c.P} .hero { position:absolute; left:140px; top:330px; width:800px; height:860px; }
      ${c.P} .kick { position:absolute; left:0; right:0; top:1310px; text-align:center; font-weight:700; font-size:40px; letter-spacing:.16em; text-transform:uppercase; color:var(--sacc); }
      ${c.P} .rname { position:absolute; left:60px; right:60px; top:${kicker ? 1380 : 1330}px; text-align:center; text-wrap:balance; }`;
    const a = c.t0 + 0.18;
    const entrance = String(s.entrance ?? "drop");
    const enter =
      entrance === "spin"
        ? `tl.from(${c.q(".hero")}, { rotationY: 540, scale: 0.2, opacity: 0, duration: 0.9, ease: "expo.out" }, ${a});`
        : entrance === "zoom"
          ? `tl.from(${c.q(".hero")}, { scale: 5, opacity: 0, duration: 0.6, ease: "power4.out" }, ${a});`
          : `tl.from(${c.q(".hero")}, { y: -1500, rotation: -14, duration: 0.62, ease: "bounce.out" }, ${a}); tl.fromTo(${c.q(".hero")}, { scaleY: 1 }, { scaleY: 0.93, duration: 0.07, yoyo: true, repeat: 1, transformOrigin: "50% 100%" }, ${a + 0.24});`;
    const js = `${enter}
      tl.fromTo(${c.q(".burst")}, { rotation: 0, scale: 0.3 }, { rotation: 60, scale: 1, duration: ${s.seconds}, ease: "power2.out" }, ${c.t0});
      tl.from(${c.q(".ground")}, { scaleX: 0.2, opacity: 0, duration: 0.5, ease: "power2.out" }, ${a + 0.1});
      tl.fromTo(${c.q(".hero img")}, { y: 0 }, { y: -26, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: ${Math.max(1, Math.round(s.seconds / 1.1))} }, ${a + 0.8});
      ${kicker ? `tl.from(${c.q(".kick")}, { opacity: 0, letterSpacing: "0.6em", duration: 0.5, ease: "power3.out" }, ${a + 0.45});` : ""}
      tl.from(${c.q(".rname")}, { y: 110, opacity: 0, rotationX: -60, duration: 0.55, ease: "expo.out" }, ${a + 0.55});`;
    return { html, css, js };
  },

  callouts(s, c) {
    const callouts = (s.callouts as string[]) ?? [];
    const spots = [
      { x: 60, y: 300, lx: 300, ly: 470, rot: 38, right: false },
      { x: 560, y: 760, lx: 560, ly: 900, rot: 150, right: true },
      { x: 60, y: 1400, lx: 290, ly: 1340, rot: -42, right: false },
    ];
    const html = `${productBlock(c, "mid", Number(s.image ?? 0))}${callouts
      .map(
        (t, k) =>
          `<div class="cline k${k}" style="left:${spots[k].lx}px;top:${spots[k].ly}px;transform:rotate(${spots[k].rot}deg)"></div><div class="cdot k${k}" style="left:${spots[k].lx - 14}px;top:${spots[k].ly - 14}px"></div><div class="cpill k${k} display" style="${
            spots[k].right ? "right:60px" : `left:${spots[k].x}px`
          };top:${spots[k].y}px;font-size:${fitSize(c.up(t), 440, 62, c.t.wide)}px">${esc(
            c.up(t),
          )}</div>`,
      )
      .join("")}`;
    const css = `
      ${c.P} .mid { position:absolute; left:240px; top:560px; width:600px; height:700px; }
      ${c.P} .cline { position:absolute; width:210px; height:8px; border-radius:8px; background:var(--sacc); transform-origin:0 50%; }
      ${c.P} .cdot { position:absolute; width:28px; height:28px; border-radius:50%; background:var(--sacc); box-shadow:0 0 0 12px color-mix(in srgb, var(--sacc) 28%, transparent); }
      ${c.P} .cpill { position:absolute; padding:26px 38px; border-radius:26px; background:var(--sacc); color:var(--son); box-shadow:0 22px 50px rgba(0,0,0,.25); white-space:nowrap; }`;
    const step = Math.min(0.75, (s.seconds - 0.9) / Math.max(1, callouts.length));
    const js =
      `tl.from(${c.q(".mid")}, { scale: 0.5, opacity: 0, duration: 0.55, ease: "back.out(1.5)" }, ${c.t0 + 0.12}); tl.fromTo(${c.q(".mid")}, { rotation: -3 }, { rotation: 3, duration: ${s.seconds}, ease: "sine.inOut" }, ${c.t0});` +
      callouts
        .map((_, k) => {
          const a = (c.t0 + 0.55 + k * step).toFixed(2);
          return `tl.from(${c.q(`.cdot.k${k}`)}, { scale: 0, duration: 0.25, ease: "back.out(3)" }, ${a});
            tl.from(${c.q(`.cline.k${k}`)}, { scaleX: 0, duration: 0.3, ease: "power3.out" }, ${a});
            tl.from(${c.q(`.cpill.k${k}`)}, { scale: 0, opacity: 0, rotation: ${k % 2 ? 10 : -10}, duration: 0.42, ease: "back.out(2.2)" }, ${(+a + 0.18).toFixed(2)});`;
        })
        .join("");
    return { html, css, js };
  },

  counter(s, c) {
    const value = Number(s.value ?? 0);
    const decimals = Number(s.decimals ?? 0);
    const prefix = String(s.prefix ?? "");
    const shown = `${prefix}${value.toFixed(decimals)}`;
    const size = fitSize(shown + "0", 760, 420, c.t.wide + 0.04);
    const R = 400;
    const C = +(2 * Math.PI * R).toFixed(1);
    const html = `<svg class="ring" viewBox="0 0 900 900"><circle cx="450" cy="450" r="${R}" class="track"/><circle cx="450" cy="450" r="${R}" class="arc" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
      <div class="num display" style="font-size:${size}px"><span class="n">${esc(shown)}</span></div><div class="unit display">${esc(
        c.up(s.unit ?? ""),
      )}</div><div class="ccap">${esc(s.caption ?? "")}</div>`;
    const css = `
      ${c.P} .ring { position:absolute; left:90px; top:330px; width:900px; height:900px; transform:rotate(-90deg); }
      ${c.P} .track { fill:none; stroke:var(--sink); stroke-opacity:.14; stroke-width:36; }
      ${c.P} .arc { fill:none; stroke:var(--sacc); stroke-width:36; stroke-linecap:round; }
      ${c.P} .num { position:absolute; left:0; right:0; top:${780 - size * 0.62}px; text-align:center; }
      ${c.P} .unit { position:absolute; left:0; right:0; top:${780 + size * 0.36}px; text-align:center; font-size:76px; color:var(--sacc); }
      ${c.P} .ccap { position:absolute; left:80px; right:80px; top:1370px; text-align:center; font-size:62px; font-weight:700; line-height:1.15; text-wrap:balance; }`;
    const dur = Math.min(1.5, s.seconds * 0.55);
    const js = `(function(){ const o = { v: 0 }; const el = document.querySelector(${c.q(".n")});
        tl.to(o, { v: ${value}, duration: ${dur}, ease: "power2.out", onUpdate: () => { el.textContent = ${JSON.stringify(prefix)} + o.v.toFixed(${decimals}); } }, ${c.t0 + 0.2}); })();
      tl.to(${c.q(".arc")}, { strokeDashoffset: ${(C * 0.14).toFixed(1)}, duration: ${dur}, ease: "power2.out" }, ${c.t0 + 0.2});
      tl.from(${c.q(".num")}, { scale: 0.5, opacity: 0, duration: 0.4, ease: "back.out(2)" }, ${c.t0 + 0.12});
      tl.fromTo(${c.q(".num")}, { scale: 1 }, { scale: 1.12, duration: 0.14, yoyo: true, repeat: 1 }, ${(c.t0 + 0.2 + dur).toFixed(2)});
      tl.from(${c.q(".unit")}, { y: 50, opacity: 0, duration: 0.4 }, ${c.t0 + 0.5});
      tl.from(${c.q(".ccap")}, { y: 70, opacity: 0, duration: 0.45, ease: "power4.out" }, ${c.t0 + 0.2 + dur * 0.8});`;
    return { html, css, js };
  },

  compare(s, c) {
    const left = (s.left as string[]) ?? [];
    const right = (s.right as string[]) ?? [];
    const leftTitle = String(s.leftTitle ?? "The usual");
    const rightTitle = String(s.rightTitle ?? c.product.brand);
    const col = (title: string, items: string[], cls: string, mark: string) =>
      `<div class="col ${cls}"><div class="ct display">${esc(c.up(title))}</div>${items
        .map((t) => `<div class="ci"><b>${mark}</b><span>${esc(t)}</span></div>`)
        .join("")}</div>`;
    const all = [...left, ...right];
    const html = `${col(leftTitle, left, "lcol", "✕")}${col(
      rightTitle,
      right,
      "rcol",
      "✓",
    )}<div class="vs display">VS</div>`;
    const css = `
      ${c.P} .col { position:absolute; left:60px; right:60px; height:720px; border-radius:48px; padding:54px 56px; }
      ${c.P} .lcol { top:210px; background:var(--sink); color:var(--sbg); opacity:.9; }
      ${c.P} .rcol { top:1000px; background:var(--sacc); color:var(--son); box-shadow:0 40px 90px rgba(0,0,0,.3); }
      ${c.P} .ct { font-size:${fitSize(c.up(leftTitle.length > rightTitle.length ? leftTitle : rightTitle), 820, 84, c.t.wide)}px; margin-bottom:34px; }
      ${c.P} .ci { display:flex; align-items:center; gap:28px; font-size:${Math.min(
        58,
        fitSize(
          all.reduce((a, b) => (a.length >= b.length ? a : b), ""),
          760,
          58,
          0.5,
        ),
      )}px; font-weight:700; margin-bottom:26px; }
      ${c.P} .ci b { flex:none; width:76px; height:76px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:44px; background:rgba(127,127,127,.3); }
      ${c.P} .rcol .ci b { background:var(--son); color:var(--sacc); }
      ${c.P} .vs { position:absolute; left:50%; top:880px; width:180px; height:180px; margin-left:-90px; border-radius:50%; background:var(--sbg); color:var(--sink); border:10px solid var(--sacc); display:flex; align-items:center; justify-content:center; font-size:64px; z-index:3; }`;
    const half = s.seconds * 0.42;
    const js = `tl.from(${c.q(".lcol")}, { x: -1100, rotation: -6, duration: 0.5, ease: "expo.out" }, ${c.t0 + 0.1});
      tl.from(${c.q(".lcol .ci")}, { x: -80, opacity: 0, duration: 0.3, stagger: 0.14 }, ${c.t0 + 0.4});
      tl.from(${c.q(".vs")}, { scale: 0, rotation: -180, duration: 0.45, ease: "back.out(2)" }, ${(c.t0 + half * 0.75).toFixed(2)});
      tl.from(${c.q(".rcol")}, { x: 1100, rotation: 6, duration: 0.5, ease: "expo.out" }, ${(c.t0 + half).toFixed(2)});
      tl.from(${c.q(".rcol .ci")}, { x: 80, opacity: 0, duration: 0.3, stagger: 0.14 }, ${(c.t0 + half + 0.3).toFixed(2)});
      tl.to(${c.q(".lcol")}, { opacity: 0.35, scale: 0.94, duration: 0.4 }, ${(c.t0 + half + 0.2).toFixed(2)});
      tl.fromTo(${c.q(".rcol")}, { scale: 1 }, { scale: 1.04, duration: 0.3, yoyo: true, repeat: 1 }, ${(c.t0 + half + 0.9).toFixed(2)});`;
    return { html, css, js };
  },

  checklist(s, c) {
    const items = (s.items as string[]) ?? [];
    const title = String(s.title ?? "");
    const top = title ? 560 : 440;
    const rowH = Math.min(260, 1000 / Math.max(1, items.length));
    const html = `${
      title
        ? `<div class="ktitle display" style="font-size:${fitSize(c.up(title), 940, 120, c.t.wide)}px">${esc(
            c.up(title),
          )}</div>`
        : ""
    }${items
      .map(
        (t, k) =>
          `<div class="row r${k}" style="top:${top + k * rowH}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/><path d="M28 52 L44 68 L74 34" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg><span>${esc(
            t,
          )}</span></div>`,
      )
      .join("")}`;
    const css = `
      ${c.P} .ktitle { position:absolute; left:64px; right:64px; top:300px; }
      ${c.P} .row { position:absolute; left:64px; right:64px; display:flex; align-items:center; gap:40px; font-size:${Math.min(
        72,
        fitSize(
          items.reduce((a, b) => (a.length >= b.length ? a : b), ""),
          760,
          72,
          0.5,
        ),
      )}px; font-weight:700; line-height:1.1; }
      ${c.P} .row svg { flex:none; width:140px; height:140px; }
      ${c.P} .row circle { fill:var(--sacc); }
      ${c.P} .row path { fill:none; stroke:var(--son); stroke-width:11; stroke-linecap:round; stroke-linejoin:round; }`;
    const step = Math.min(0.6, (s.seconds - 0.8) / Math.max(1, items.length));
    const js =
      (title
        ? `tl.from(${c.q(".ktitle")}, { y: -80, opacity: 0, duration: 0.45, ease: "power4.out" }, ${c.t0 + 0.1});`
        : "") +
      items
        .map((_, k) => {
          const a = (c.t0 + 0.35 + k * step).toFixed(2);
          const row = `.r${k}`;
          return `tl.from(${c.q(row)}, { x: 240, opacity: 0, duration: 0.4, ease: "expo.out" }, ${a});
            tl.from(${c.q(row + " circle")}, { scale: 0, transformOrigin: "50% 50%", duration: 0.3, ease: "back.out(2.6)" }, ${a});
            tl.to(${c.q(row + " path")}, { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" }, ${(+a + 0.2).toFixed(2)});`;
        })
        .join("");
    return { html, css, js };
  },

  gallery(s, c) {
    const imgIndices = (s.images as number[]) ?? [0];
    const pics = imgIndices.map((i) => c.img(i));
    const caption = String(s.caption ?? "");
    const variant = String(s.variant ?? "polaroids");
    const cap = caption
      ? `<div class="gcap display" style="font-size:${fitSize(
          c.up(caption),
          940,
          96,
          c.t.wide * 0.9,
        )}px">${esc(c.up(caption))}</div>`
      : "";
    if (variant === "filmstrip") {
      const strip = [...pics, ...pics, ...pics];
      const html = `<div class="film"><div class="reel">${strip
        .map((p) => `<div class="fr"><img src="${esc(p)}" alt="" /></div>`)
        .join("")}</div></div>${cap}`;
      const css = `
        ${c.P} .film { position:absolute; left:-80px; right:-80px; top:420px; height:880px; transform:rotate(-5deg); background:#0c0c10; padding:44px 0; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,.4); }
        ${c.P} .film::before, ${c.P} .film::after { content:""; position:absolute; left:0; right:0; height:24px; background:repeating-linear-gradient(90deg, #fff 0 34px, transparent 34px 68px); opacity:.85; }
        ${c.P} .film::before { top:10px; } ${c.P} .film::after { bottom:10px; }
        ${c.P} .reel { display:flex; gap:26px; height:100%; }
        ${c.P} .fr { flex:none; width:640px; height:100%; border-radius:14px; overflow:hidden; background:#fff; }
        ${c.P} .fr img { width:100%; height:100%; object-fit:cover; }
        ${c.P} .gcap { position:absolute; left:64px; right:64px; top:1430px; text-wrap:balance; }`;
      const js = `tl.fromTo(${c.q(".reel")}, { x: 200 }, { x: ${-666 * pics.length}, duration: ${s.seconds}, ease: "power1.inOut" }, ${c.t0});
        tl.from(${c.q(".film")}, { scaleY: 0, duration: 0.45, ease: "expo.out" }, ${c.t0 + 0.05});
        ${caption ? `tl.from(${c.q(".gcap")}, { y: 90, opacity: 0, duration: 0.5, ease: "power4.out" }, ${c.t0 + 0.6});` : ""}`;
      return { html, css, js };
    }
    if (variant === "grid") {
      const four = [0, 1, 2, 3].map((k) => pics[k % pics.length]);
      const html = `<div class="grid">${four
        .map((p) => `<div class="tile"><img src="${esc(p)}" alt="" /></div>`)
        .join("")}</div>${cap}`;
      const css = `
        ${c.P} .grid { position:absolute; left:60px; top:260px; width:960px; height:1100px; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:24px; perspective:1400px; }
        ${c.P} .tile { border-radius:36px; overflow:hidden; background:#fff; box-shadow:0 26px 60px rgba(0,0,0,.25); backface-visibility:hidden; }
        ${c.P} .tile img { width:100%; height:100%; object-fit:cover; }
        ${c.P} .gcap { position:absolute; left:64px; right:64px; top:1440px; text-wrap:balance; }`;
      const js = `tl.from(${c.q(".tile")}, { rotationY: -100, opacity: 0, duration: 0.6, ease: "back.out(1.3)", stagger: 0.16 }, ${c.t0 + 0.1});
        tl.fromTo(${c.q(".tile img")}, { scale: 1.02 }, { scale: 1.16, duration: ${s.seconds}, ease: "none" }, ${c.t0});
        ${caption ? `tl.from(${c.q(".gcap")}, { y: 90, opacity: 0, duration: 0.5, ease: "power4.out" }, ${c.t0 + 0.75});` : ""}`;
      return { html, css, js };
    }
    const three = [0, 1, 2].map((k) => pics[k % pics.length]);
    const fan = [
      { r: -11, x: -210, y: 60 },
      { r: 8, x: 220, y: 0 },
      { r: -2, x: 0, y: 130 },
    ];
    const html = `${three
      .map((p, k) => `<div class="pol p${k}"><img src="${esc(p)}" alt="" /></div>`)
      .join("")}${cap}`;
    const css = `
      ${c.P} .pol { position:absolute; left:230px; top:330px; width:620px; height:760px; background:#fff; padding:30px 30px 120px; border-radius:10px; box-shadow:0 40px 90px rgba(0,0,0,.34); }
      ${c.P} .pol img { width:100%; height:100%; object-fit:cover; border-radius:4px; }
      ${c.P} .gcap { position:absolute; left:64px; right:64px; top:1420px; text-wrap:balance; }`;
    const js =
      three
        .map(
          (_, k) =>
            `tl.fromTo(${c.q(`.p${k}`)}, { y: 1700, rotation: ${k % 2 ? 40 : -40}, x: 0 }, { y: ${fan[k].y}, x: ${fan[k].x}, rotation: ${fan[k].r}, duration: 0.7, ease: "back.out(1.2)" }, ${(c.t0 + 0.1 + k * 0.24).toFixed(2)});`,
        )
        .join("") +
      `tl.to(${c.q(".pol")}, { y: "-=24", duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 2, stagger: 0.1 }, ${c.t0 + 1.1});
       ${caption ? `tl.from(${c.q(".gcap")}, { y: 90, opacity: 0, duration: 0.5, ease: "power4.out" }, ${c.t0 + 0.8});` : ""}`;
    return { html, css, js };
  },

  gauge(s, c) {
    const val = Number(s.value ?? 100);
    const labelText = String(s.label ?? "");
    const caption = String(s.caption ?? "");
    const variant = String(s.variant ?? "ring");
    const label = `<div class="glabel display" style="font-size:${fitSize(
      c.up(labelText || " "),
      900,
      130,
      c.t.wide,
    )}px">${esc(c.up(labelText))}</div><div class="gcap2">${esc(caption)}</div>`;
    const labelCss = `${c.P} .glabel { position:absolute; left:64px; right:64px; top:1250px; text-align:center; } ${c.P} .gcap2 { position:absolute; left:80px; right:80px; top:1430px; text-align:center; font-size:58px; font-weight:700; line-height:1.15; text-wrap:balance; opacity:.85; }`;
    const labelJs = `tl.from(${c.q(".glabel")}, { scale: 0.6, opacity: 0, duration: 0.45, ease: "back.out(2)" }, ${c.t0 + s.seconds * 0.45}); tl.from(${c.q(".gcap2")}, { y: 60, opacity: 0, duration: 0.4 }, ${c.t0 + s.seconds * 0.58});`;
    if (variant === "radar") {
      const html = `<div class="radar">${[0, 1, 2]
        .map(() => `<i class="rr"></i>`)
        .join("")}<div class="sweep"></div><div class="blip"></div>${[0, 1]
        .map(() => `<i class="pulse"></i>`)
        .join("")}</div>${label}`;
      const css = `
        ${c.P} .radar { position:absolute; left:140px; top:330px; width:800px; height:800px; border-radius:50%; border:8px solid var(--sacc); overflow:hidden; background:radial-gradient(circle, color-mix(in srgb, var(--sacc) 22%, transparent) 0%, transparent 70%); }
        ${c.P} .rr { position:absolute; left:50%; top:50%; border:5px solid var(--sacc); border-radius:50%; opacity:.4; }
        ${c.P} .rr:nth-child(1) { width:560px; height:560px; margin:-280px; } ${c.P} .rr:nth-child(2) { width:320px; height:320px; margin:-160px; } ${c.P} .rr:nth-child(3) { width:90px; height:90px; margin:-45px; }
        ${c.P} .sweep { position:absolute; left:50%; top:50%; width:400px; height:400px; transform-origin:0 0; background:conic-gradient(from 0deg at 0 0, color-mix(in srgb, var(--sacc) 75%, transparent) 0deg, transparent 70deg); }
        ${c.P} .blip { position:absolute; left:560px; top:250px; width:54px; height:54px; margin:-27px; border-radius:50%; background:var(--sink); box-shadow:0 0 0 14px color-mix(in srgb, var(--sink) 30%, transparent); }
        ${c.P} .pulse { position:absolute; left:560px; top:250px; width:54px; height:54px; margin:-27px; border-radius:50%; border:6px solid var(--sink); }
        ${labelCss}`;
      const js = `tl.fromTo(${c.q(".sweep")}, { rotation: -90 }, { rotation: ${Math.round(360 * s.seconds * 0.7) - 90}, duration: ${s.seconds}, ease: "none" }, ${c.t0});
        tl.from(${c.q(".radar")}, { scale: 0.4, opacity: 0, duration: 0.5, ease: "back.out(1.6)" }, ${c.t0 + 0.08});
        tl.from(${c.q(".blip")}, { scale: 0, duration: 0.3, ease: "back.out(3)" }, ${c.t0 + s.seconds * 0.38});
        tl.fromTo(${c.q(".pulse")}, { scale: 1, opacity: 0.9 }, { scale: 5.5, opacity: 0, duration: 0.9, ease: "power2.out", stagger: 0.35, repeat: 2 }, ${c.t0 + s.seconds * 0.38});
        ${labelJs}`;
      return { html, css, js };
    }
    if (variant === "battery") {
      const html = `<div class="batt"><div class="fill"></div><div class="bolt display">${Math.round(
        val,
      )}%</div></div><div class="nub"></div>${label}`;
      const css = `
        ${c.P} .batt { position:absolute; left:160px; top:470px; width:720px; height:400px; border:22px solid var(--sink); border-radius:70px; overflow:hidden; }
        ${c.P} .nub { position:absolute; left:894px; top:600px; width:50px; height:140px; border-radius:0 30px 30px 0; background:var(--sink); }
        ${c.P} .fill { position:absolute; left:16px; top:16px; bottom:16px; width:${(644 * val) / 100}px; border-radius:36px; background:var(--sacc); transform-origin:left center; }
        ${c.P} .bolt { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:170px; color:var(--sink); mix-blend-mode:difference; }
        ${labelCss}`;
      const js = `tl.from(${c.q(".batt")}, { scale: 0.6, opacity: 0, duration: 0.45, ease: "back.out(1.7)" }, ${c.t0 + 0.08});
        tl.from(${c.q(".fill")}, { scaleX: 0, duration: ${Math.min(1.4, s.seconds * 0.5)}, ease: "power2.out" }, ${c.t0 + 0.3});
        tl.fromTo(${c.q(".fill")}, { opacity: 1 }, { opacity: 0.7, duration: 0.3, yoyo: true, repeat: 3 }, ${c.t0 + s.seconds * 0.6});
        ${labelJs}`;
      return { html, css, js };
    }
    if (variant === "thermo") {
      const html = `<div class="tube"><div class="merc"></div></div><div class="bulb"></div>${[
        0, 1, 2, 3, 4,
      ]
        .map((k) => `<i class="tick" style="top:${420 + k * 150}px"></i>`)
        .join("")}${label}`;
      const css = `
        ${c.P} .tube { position:absolute; left:470px; top:330px; width:140px; height:740px; border:16px solid var(--sink); border-radius:80px; overflow:hidden; }
        ${c.P} .merc { position:absolute; left:14px; right:14px; bottom:0; height:${(680 * val) / 100}px; border-radius:50px; background:var(--sacc); transform-origin:50% 100%; }
        ${c.P} .bulb { position:absolute; left:430px; top:1010px; width:220px; height:220px; border-radius:50%; background:var(--sacc); border:16px solid var(--sink); }
        ${c.P} .tick { position:absolute; left:660px; width:90px; height:12px; border-radius:10px; background:var(--sink); opacity:.5; }
        ${labelCss}`;
      const js = `tl.from([${c.q(".tube")}, ${c.q(".bulb")}], { y: 200, opacity: 0, duration: 0.5, ease: "back.out(1.5)" }, ${c.t0 + 0.08});
        tl.from(${c.q(".tick")}, { scaleX: 0, transformOrigin: "0 50%", duration: 0.25, stagger: 0.06 }, ${c.t0 + 0.3});
        tl.from(${c.q(".merc")}, { scaleY: 0.04, duration: ${Math.min(1.5, s.seconds * 0.5)}, ease: "power2.inOut" }, ${c.t0 + 0.35});
        ${labelJs}`;
      return { html, css, js };
    }
    const R = 340;
    const C = +(2 * Math.PI * R).toFixed(1);
    const html = `<svg class="gr" viewBox="0 0 800 800"><circle cx="400" cy="400" r="${R}" class="track"/><circle cx="400" cy="400" r="${R}" class="arc" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg><div class="gval display">${Math.round(
      val,
    )}%</div>${label}`;
    const css = `
      ${c.P} .gr { position:absolute; left:140px; top:330px; width:800px; height:800px; transform:rotate(-90deg); }
      ${c.P} .track { fill:none; stroke:var(--sink); stroke-opacity:.14; stroke-width:60; }
      ${c.P} .arc { fill:none; stroke:var(--sacc); stroke-width:60; stroke-linecap:round; }
      ${c.P} .gval { position:absolute; left:0; right:0; top:620px; text-align:center; font-size:220px; }
      ${labelCss}`;
    const js = `tl.to(${c.q(".arc")}, { strokeDashoffset: ${(C * (1 - val / 100)).toFixed(1)}, duration: ${Math.min(1.5, s.seconds * 0.55)}, ease: "power2.out" }, ${c.t0 + 0.2});
      tl.from(${c.q(".gval")}, { scale: 0.4, opacity: 0, duration: 0.45, ease: "back.out(2)" }, ${c.t0 + 0.2});
      ${labelJs}`;
    return { html, css, js };
  },

  price(s, c) {
    const p = c.product;
    const priceStr = p.price ?? "";
    const saves = p.compareAt
      ? (() => {
          const a = parseFloat(String(p.compareAt).replace(/[^0-9.]/g, ""));
          const b = parseFloat(String(priceStr).replace(/[^0-9.]/g, ""));
          return a > b ? Math.round(((a - b) / a) * 100) : 0;
        })()
      : 0;
    const html = `<div class="string"></div><div class="tag"><div class="hole"></div>${
      p.compareAt ? `<div class="was">${esc(p.compareAt)}<i></i></div>` : ""
    }<div class="now display" style="font-size:${fitSize(
      priceStr,
      600,
      250,
      c.t.wide + 0.02,
    )}px">${esc(priceStr)}</div>${
      saves ? `<div class="save display">SAVE ${saves}%</div>` : ""
    }</div><div class="pcap2">${esc(s.caption ?? "")}</div>`;
    const css = `
      ${c.P} .string { position:absolute; left:536px; top:-40px; width:8px; height:470px; background:var(--sink); opacity:.6; transform-origin:50% 0; }
      ${c.P} .tag { position:absolute; left:170px; top:400px; width:740px; height:780px; border-radius:60px; background:var(--sacc); color:var(--son); transform-origin:50% -360px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; box-shadow:0 50px 110px rgba(0,0,0,.34); }
      ${c.P} .hole { position:absolute; left:50%; top:44px; width:70px; height:70px; margin-left:-35px; border-radius:50%; background:var(--sbg); }
      ${c.P} .was { position:relative; font-size:86px; font-weight:700; opacity:.7; }
      ${c.P} .was i { position:absolute; left:-12px; right:-12px; top:50%; height:10px; background:var(--son); border-radius:8px; transform-origin:left center; }
      ${c.P} .save { font-size:70px; padding:14px 34px; border-radius:20px; background:var(--son); color:var(--sacc); }
      ${c.P} .pcap2 { position:absolute; left:80px; right:80px; top:1330px; text-align:center; font-size:64px; font-weight:700; line-height:1.15; text-wrap:balance; }`;
    const js = `tl.from([${c.q(".tag")}, ${c.q(".string")}], { y: -1500, duration: 0.55, ease: "power3.out" }, ${c.t0 + 0.08});
      tl.fromTo(${c.q(".tag")}, { rotation: 16 }, { rotation: -10, duration: 0.5, ease: "sine.inOut" }, ${c.t0 + 0.5});
      tl.to(${c.q(".tag")}, { rotation: 6, duration: 0.45, ease: "sine.inOut" }, ${c.t0 + 1.0});
      tl.to(${c.q(".tag")}, { rotation: 0, duration: 0.5, ease: "sine.out" }, ${c.t0 + 1.45});
      ${p.compareAt ? `tl.from(${c.q(".was i")}, { scaleX: 0, duration: 0.3, ease: "power3.out" }, ${c.t0 + 0.9});` : ""}
      tl.from(${c.q(".now")}, { scale: 0, duration: 0.45, ease: "back.out(2.4)" }, ${c.t0 + (p.compareAt ? 1.1 : 0.7)});
      ${saves ? `tl.from(${c.q(".save")}, { scale: 0, rotation: -20, duration: 0.4, ease: "back.out(2.6)" }, ${c.t0 + 1.45});` : ""}
      tl.from(${c.q(".pcap2")}, { y: 70, opacity: 0, duration: 0.4 }, ${c.t0 + 1.2});`;
    return { html, css, js };
  },

  cta(s, c) {
    const p = c.product;
    const line = String(s.line ?? "");
    const label = String(s.label ?? "Shop now");
    const html = `${[0, 1, 2].map(() => `<i class="rip"></i>`).join("")}${productBlock(
      c,
      "fin",
      Number(s.image ?? 0),
    )}
      <div class="fname display" style="font-size:${Math.round(c.nameSize * 0.9)}px">${esc(c.name)}</div>
      ${line ? `<div class="fline">${esc(line)}</div>` : ""}
      ${p.price ? `<div class="fprice display">${p.compareAt ? `<s>${esc(p.compareAt)}</s>` : ""}${esc(p.price)}</div>` : ""}
      <div class="fbtn display"><span>${esc(c.up(label))}</span><b></b></div><div class="fdom">${esc(p.domain)}</div>`;
    const css = `
      ${c.P} .rip { position:absolute; left:50%; top:520px; width:560px; height:560px; margin:-280px 0 0 -280px; border-radius:50%; border:8px solid var(--sacc); }
      ${c.P} .fin { position:absolute; left:250px; top:230px; width:580px; height:580px; }
      ${c.P} .fin.card { border-radius:50%; }
      ${c.P} .fname { position:absolute; left:60px; right:60px; top:900px; text-align:center; text-wrap:balance; }
      ${c.P} .fline { position:absolute; left:80px; right:80px; top:${900 + Math.round(c.nameSize * (c.name.length > 14 ? 1.95 : 1.05))}px; text-align:center; font-size:52px; font-weight:500; opacity:.85; text-wrap:balance; }
      ${c.P} .fprice { position:absolute; left:0; right:0; top:1330px; text-align:center; font-size:150px; }
      ${c.P} .fprice s { font-size:62px; opacity:.55; margin-right:22px; font-weight:500; font-family:"${c.t.body}", sans-serif; letter-spacing:0; }
      ${c.P} .fbtn { position:absolute; left:130px; right:130px; top:1540px; height:156px; border-radius:999px; background:var(--sacc); color:var(--son); display:flex; align-items:center; justify-content:center; font-size:${fitSize(c.up(label), 700, 68, c.t.wide)}px; overflow:hidden; }
      ${c.P} .fbtn b { position:absolute; top:0; left:0; width:30%; height:100%; background:linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent); transform:skewX(-16deg); }
      ${c.P} .fdom { position:absolute; left:0; right:0; top:1740px; text-align:center; font-weight:700; font-size:36px; letter-spacing:.1em; opacity:.85; }`;
    const d = c.t0;
    const js = `tl.fromTo(${c.q(".rip")}, { scale: 0.6, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 1.6, ease: "power2.out", stagger: 0.5, repeat: 1 }, ${d + 0.3});
      tl.from(${c.q(".fin")}, { scale: 0, rotation: -30, duration: 0.7, ease: "back.out(1.7)" }, ${d + 0.12});
      tl.fromTo(${c.q(".fin img")}, { y: 0 }, { y: -22, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 2 }, ${d + 0.85});
      tl.from(${c.q(".fname")}, { y: 90, opacity: 0, duration: 0.5, ease: "power4.out" }, ${d + 0.4});
      ${line ? `tl.from(${c.q(".fline")}, { opacity: 0, y: 40, duration: 0.4 }, ${d + 0.6});` : ""}
      ${p.price ? `tl.from(${c.q(".fprice")}, { scale: 0.4, opacity: 0, duration: 0.5, ease: "back.out(2.2)" }, ${d + 0.7});` : ""}
      tl.from(${c.q(".fbtn")}, { y: 180, opacity: 0, duration: 0.55, ease: "expo.out" }, ${d + 0.95});
      tl.fromTo(${c.q(".fbtn")}, { scale: 1 }, { scale: 1.06, duration: 0.42, ease: "sine.inOut", yoyo: true, repeat: 3 }, ${d + 1.6});
      tl.fromTo(${c.q(".fbtn b")}, { x: -300 }, { x: 1000, duration: 0.9, ease: "power2.inOut" }, ${d + 1.5});
      tl.from(${c.q(".fdom")}, { opacity: 0, duration: 0.4 }, ${d + 1.3});`;
    return { html, css, js };
  },
};

function motifLayer(motif: string, color: string, seed: number) {
  if (motif === "none") return { html: "", css: "", js: "" };
  const r = rng(seed);
  const N = motif === "rain" ? 34 : motif === "steam" ? 10 : 22;
  const glyph = ({ hearts: "♥", stars: "★" } as Record<string, string>)[motif];
  const parts = Array.from({ length: N }, () => ({
    x: Math.round(r() * W),
    y: Math.round(r() * H),
    s: 0.5 + r(),
    d: +(3 + r() * 6).toFixed(2),
    o: +(0.25 + r() * 0.5).toFixed(2),
    sway: Math.round((r() - 0.5) * 240),
  }));
  const html = `<div id="motif">${parts
    .map((p, i) => `<i id="mo${i}" style="left:${p.x}px;top:${p.y}px;opacity:${p.o}">${glyph ?? ""}</i>`)
    .join("")}</div>`;
  const shape = ({
    snow: "width:16px;height:16px;border-radius:50%;background:#fff;filter:blur(1px);",
    bubbles: `width:44px;height:44px;border-radius:50%;border:5px solid ${color};background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.6), transparent 45%);`,
    sparks: `width:18px;height:18px;background:${color};transform:rotate(45deg);`,
    steam: "width:230px;height:230px;border-radius:50%;background:#fff;filter:blur(70px);",
    petals: `width:34px;height:20px;border-radius:50% 0 50% 0;background:${color};`,
    hearts: `font-style:normal;font-size:60px;color:${color};`,
    stars: `font-style:normal;font-size:54px;color:${color};`,
    rain: "width:5px;height:90px;border-radius:5px;background:#fff;",
  } as Record<string, string>)[motif] ?? "";
  const css = `#motif { position:absolute; inset:0; z-index:60; pointer-events:none; overflow:hidden; } #motif i { position:absolute; display:block; ${shape} }`;
  const up = ["bubbles", "steam", "hearts", "stars", "sparks"].includes(motif);
  const js = parts
    .map((p, i) => {
      const dist = motif === "rain" ? H * 3 : motif === "steam" ? 700 : 500 + p.s * 700;
      return `tl.set("#mo${i}", { scale: ${p.s.toFixed(2)} }, 0);
        tl.fromTo("#mo${i}", { y: ${up ? Math.round(dist * 0.4) : -Math.round(dist * 0.4)}, x: 0 }, { y: ${
          up ? -Math.round(dist * 0.6) : Math.round(dist * 0.6)
        }, x: ${motif === "rain" ? -120 : p.sway}, duration: ${DURATION}, ease: "none" }, 0);
        ${
          ["sparks", "stars", "hearts"].includes(motif)
            ? `tl.fromTo("#mo${i}", { opacity: ${p.o} }, { opacity: 0.05, duration: ${(p.d / 3).toFixed(2)}, yoyo: true, repeat: ${Math.ceil(DURATION / (p.d / 3))}, ease: "sine.inOut" }, 0);`
            : ""
        }
        ${
          motif === "petals"
            ? `tl.fromTo("#mo${i}", { rotation: 0 }, { rotation: ${p.sway * 3}, duration: ${DURATION}, ease: "none" }, 0);`
            : ""
        }`;
    })
    .join("");
  return { html, css, js };
}

export function composeDirected(
  product: NormalizedProduct,
  sb: PostReadyStoryboard,
  images: string[],
  {
    web = false,
    audio = null,
    cutouts = [],
  }: { web?: boolean; audio?: string | null; cutouts?: Array<string | null> } = {},
): string {
  const baseT = THEME[sb.theme] ?? THEME.noir;
  const t: ThemeSpec = sb.theme === "neon" ? { ...baseT, wide: 0.76 } : baseT;
  const { bg, accent } = sb.palette;
  const ink = inkOn(bg);
  const onAccent = inkOn(accent);
  const contrastBg = ink === "#ffffff" ? "#f4f1ea" : "#0e0e12";
  const up = (s: unknown) => (t.upper ? String(s).toUpperCase() : String(s));
  const name = up(sb.name);
  const nameSize = Math.min(
    124,
    fitSize(longestWord(name), 940, 124, t.wide + 0.1),
    Math.max(70, fitSize(name, 1750, 124, t.wide)),
  );
  const img = (i: number) => images[i] ?? images[0];
  const anyCut = cutouts.find(Boolean) ?? null;
  const cutFor = (i: number) => cutouts[i] ?? anyCut;

  const OV = 0.32;
  const parts = (sb.scenes as SceneRec[]).map((s, i) => {
    const sbg = s.bg === "accent" ? accent : s.bg === "contrast" ? contrastBg : bg;
    const sink = inkOn(sbg);
    const sacc = s.bg === "accent" ? sink : contrast(sbg, accent) >= 1.6 ? accent : sink;
    const P = `#s${i}`;
    const c: SceneCtx = {
      i,
      P,
      t0: s.start,
      product,
      img,
      cutFor,
      t,
      up,
      name,
      nameSize,
      q: (sel: string) => JSON.stringify(`${P} ${sel}`),
    };
    const r = KIT[s.type](s, c);
    const start = i ? +(s.start - OV).toFixed(2) : 0;
    const dur = +(s.seconds + (i ? OV : 0)).toFixed(2);
    const enter =
      i === 0
        ? ""
        : s.transition === "slide"
          ? `tl.fromTo("${P}", { y: ${H} }, { y: 0, duration: ${OV + 0.1}, ease: "expo.out" }, ${start});`
          : s.transition === "iris"
            ? `tl.fromTo("${P}", { clipPath: "circle(0% at 50% 45%)" }, { clipPath: "circle(120% at 50% 45%)", duration: ${OV + 0.2}, ease: "power3.out" }, ${start});`
            : s.transition === "wipe"
              ? `tl.fromTo("${P}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${OV + 0.1}, ease: "power4.out" }, ${start});`
              : s.transition === "push"
                ? `tl.fromTo("${P}", { scale: 0.4, opacity: 0, borderRadius: "120px" }, { scale: 1, opacity: 1, borderRadius: "0px", duration: ${OV + 0.15}, ease: "back.out(1.2)" }, ${start});`
                : `tl.fromTo("${P}", { opacity: 0 }, { opacity: 1, duration: 0.08 }, ${(s.start - 0.08).toFixed(2)}); tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.9, duration: 0.07 }, ${(s.start - 0.08).toFixed(2)}); tl.to("#flash", { opacity: 0, duration: 0.3 }, ${s.start});`;
    return {
      html: `<div id="s${i}" class="scene clip" data-start="${start}" data-duration="${dur}" data-track-index="${i}" style="z-index:${i + 1};--sbg:${sbg};--sink:${sink};--sacc:${sacc};--son:${inkOn(
        sacc,
      )}"><div class="glow"></div>${r.html}</div>`,
      css: r.css,
      js:
        enter +
        r.js +
        `tl.fromTo("${P} .glow", { scale: 0.8, x: -120 }, { scale: 1.3, x: 160, duration: ${dur}, ease: "sine.inOut" }, ${start});`,
    };
  });
  const motif = motifLayer(sb.motif, accent, sb.name.length * 7919 + sb.scenes.length * 104729 + 31);

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
  html, body { width:${W}px; height:${H}px; overflow:hidden; background:${bg}; }
  body { font-family:"${t.body}", system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  #root { position:relative; width:${W}px; height:${H}px; overflow:hidden; background:${bg}; }
  .display { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.94; ${sb.theme === "editorial" ? "font-style:italic;" : ""} }
  .scene { position:absolute; inset:0; overflow:hidden; background:var(--sbg); color:var(--sink); perspective:1400px; }
  .scene .st, .scene .rname, .scene .fname, .scene .ktitle, .scene .gcap { font-family:"${t.display}", sans-serif; font-weight:${t.weight}; letter-spacing:${t.track}; line-height:.94; ${sb.theme === "editorial" ? "font-style:italic;" : ""} }
  .glow { position:absolute; left:-200px; top:300px; width:1100px; height:1100px; border-radius:50%; background:var(--sacc); opacity:.2; filter:blur(140px); }
  .prod img { width:100%; height:100%; display:block; }
  .prod.card { background:#fff; border-radius:48px; overflow:hidden; box-shadow:0 50px 110px rgba(0,0,0,.34); }
  .prod.card img { object-fit:cover; }
  .prod.cutp img { object-fit:contain; filter:drop-shadow(0 46px 42px rgba(0,0,0,.42)); }
  #flash { position:absolute; inset:0; background:#fff; z-index:70; opacity:0; pointer-events:none; }
  ${web ? WEB_STYLE : ""}
  ${motif.css}
  ${parts.map((p) => p.css).join("\n")}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="${W}" data-height="${H}">
${parts.map((p) => p.html).join("\n")}
${motif.html}
<div id="flash"></div>
  ${audio ? `<audio class="clip" data-start="0" data-duration="${DURATION}" data-track-index="9" data-volume="0.95" src="${esc(audio)}"></audio>` : ""}
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  ${motif.js}
  ${parts.map((p) => p.js).join("\n  ")}
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);${web ? WEB_PLAYER : ""}
</script>
</body>
</html>
`;
}

export const SYSTEM_DIRECTOR = `You are an award-winning short-form ad director. For one product you invent a 15-second vertical ad and write it as a storyboard. A scene kit stages your storyboard exactly as written, so the creative quality is entirely your choices: the idea, the order, the pacing, the words.

Output one JSON object and nothing else:
{
  "concept": string,      // the idea in one line, e.g. "The wallet that texts you back"
  "name": string,         // short product name, max 4 words, no SKU noise
  "theme": "pop" | "noir" | "editorial" | "neon",   // typography + attitude
  "palette": { "bg": "#rrggbb", "accent": "#rrggbb" },   // drawn from the product; must contrast
  "motif": "none" | "snow" | "bubbles" | "sparks" | "steam" | "petals" | "hearts" | "stars" | "rain",
  "scenes": [ 5 to 7 scenes ],
  "voiceover": [string, ...]  // 4 to 5 concise spoken sentences matching the opening, product reveal, standout proof/benefit, and CTA (~32 words total so it speaks smoothly inside 14 seconds)
}

Every scene has "type", "seconds" (1.5-3.5; all scenes are rescaled to total 15), optional "bg" ("base" | "accent" | "contrast") and optional "transition" ("slide" | "iris" | "flash" | "push" | "wipe"). Scene types and their fields:
- "statement": { "lines": [1-3 lines, max 4 words each], "mode": "slam" | "typewriter" | "stack", "emphasis": one word from the lines to highlight }
- "problem": the itch before the product. { "variant": "search" | "chat" | "notification", "messages": [search: 1 query a real person would type; chat/notification: 2-3 short messages, max 8 words], "caption": max 6 words }
- "reveal": the product arrives. { "entrance": "drop" | "spin" | "zoom", "kicker": max 4 words, "image": index }
- "callouts": the product with labels pointing at it. { "callouts": [2-3 labels, max 4 words], "image": index }
- "counter": one number counted up. { "value": number, "prefix": e.g. "$", "unit": e.g. "g fiber", "caption": max 6 words }. The number MUST appear in the product data.
- "compare": { "leftTitle": e.g. "The usual", "left": [2-3 items, max 4 words], "rightTitle": brand or product, "right": [2-3 items] }. Never name a competitor.
- "checklist": { "title": max 4 words, "items": [2-4 items, max 5 words] }
- "gallery": real product photos. { "variant": "polaroids" | "filmstrip" | "grid", "images": [3-4 indices], "caption": max 6 words }
- "gauge": a small instrument that makes one benefit visible. { "variant": "radar" | "battery" | "thermo" | "ring", "value": 5-100, "label": max 3 words, "caption": max 6 words }
- "price": the price as a swinging tag. { "caption": max 5 words }. Only if the product has a price.
- "cta": always last. { "label": 2-3 words, "line": max 6 words, "image": index }

Rules:
- Open with a "statement" or "problem" that stops a thumb. No product name in the first scene.
- Include exactly one "reveal". End with "cta". Never use the same scene type twice in a row.
- Write like a human copywriter with taste. No cliches ("game-changer", "elevate", "unleash"), no emojis, no hashtags.
- Use only facts from the product data. Never invent ratings, review counts, awards, discounts, or claims.
- If photos are attached, choose colours that flatter them and prefer clean full-product shots for "reveal", "callouts" and "cta".`;
