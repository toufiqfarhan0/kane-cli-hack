export const W = 1080;
export const H = 1920;
export const DURATION = 15;

export interface ThemeSpec {
  display: string;
  weight: number;
  body: string;
  upper: boolean;
  radius: number;
  track: string;
  wide: number;
  fonts: string;
}

export const THEME: Record<"pop" | "noir" | "editorial" | "neon", ThemeSpec> = {
  pop: {
    display: "Bricolage Grotesque",
    weight: 800,
    body: "Inter",
    upper: true,
    radius: 56,
    track: "-0.035em",
    wide: 0.6,
    fonts: "Bricolage+Grotesque:opsz,wght@12..96,800&family=Inter:wght@500;700",
  },
  noir: {
    display: "Space Grotesk",
    weight: 700,
    body: "Inter",
    upper: true,
    radius: 36,
    track: "-0.04em",
    wide: 0.6,
    fonts: "Space+Grotesk:wght@700&family=Inter:wght@500;700",
  },
  editorial: {
    display: "Fraunces",
    weight: 600,
    body: "Inter",
    upper: false,
    radius: 24,
    track: "-0.03em",
    wide: 0.52,
    fonts: "Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Inter:wght@500;700",
  },
  neon: {
    display: "Unbounded",
    weight: 800,
    body: "Inter",
    upper: true,
    radius: 44,
    track: "-0.03em",
    wide: 0.74,
    fonts: "Unbounded:wght@800&family=Inter:wght@500;700",
  },
};

export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const inkOn = (hex: string): "#0c0c10" | "#ffffff" =>
  lum(hex) > 0.42 ? "#0c0c10" : "#ffffff";

export const fitSize = (
  text: unknown,
  maxWidth: number,
  maxSize: number,
  ratio = 0.56,
): number =>
  Math.round(Math.min(maxSize, maxWidth / (Math.max(String(text).length, 1) * ratio)));

export const longestWord = (text: unknown): string =>
  String(text ?? "")
    .split(/\s+/)
    .reduce((a, b) => (a.length >= b.length ? a : b), "");

export const mix = (hex: string, toward: string, t: number): string => {
  const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(toward.slice(i, i + 2), 16));
  return (
    "#" +
    a
      .map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
};

export const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

export const WEB_STYLE = `html, body { width:100%; height:100%; background:#000; } #root { position:absolute; left:0; top:0; transform-origin:0 0; }`;

export const WEB_PLAYER = `
  (function () {
    const root = document.getElementById("root");
    const clips = [...root.querySelectorAll("[data-start]")];
    const show = (t) => clips.forEach((el) => {
      const s = +el.dataset.start, d = +el.dataset.duration;
      el.style.visibility = t >= s && t < s + d ? "visible" : "hidden";
    });
    const fitStage = () => {
      const k = Math.min(innerWidth / ${W}, innerHeight / ${H});
      root.style.transform = "translate(" + (innerWidth - ${W} * k) / 2 + "px," + (innerHeight - ${H} * k) / 2 + "px) scale(" + k + ")";
    };
    addEventListener("resize", fitStage);
    fitStage();
    tl.set({}, {}, ${DURATION});
    tl.eventCallback("onUpdate", () => show(tl.time()));
    tl.eventCallback("onComplete", () => setTimeout(() => tl.restart(), 800));
    show(0);
    (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve()).then(() => tl.play(0));
  })();`;
