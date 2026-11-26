import type { NormalizedProduct, PostReadyBrief } from "@postready/core";
import { compose, type ComposeOptions } from "./classic-scene.js";
import { composeReel } from "./reel-scene.js";
import { compose3d } from "./depth-scene.js";

export type FixedStyle = "depth" | "reel" | "classic";

export const STYLES: Record<
  FixedStyle,
  (p: NormalizedProduct, b: PostReadyBrief, imgs: string[], opts?: ComposeOptions) => string
> = {
  depth: compose3d,
  reel: composeReel,
  classic: compose,
};

export const SOUND_CUES: Record<FixedStyle, { cuts: number[]; pops: number[]; chime: number }> = {
  depth: { cuts: [2.7, 6.4, 11.0], pops: [3.2], chime: 11.15 },
  reel: { cuts: [2.8, 6.1, 7.65, 9.2, 10.75], pops: [3.8], chime: 10.9 },
  classic: { cuts: [2.8, 6.6, 11.4], pops: [3.55], chime: 11.55 },
};

export function composeVideo(
  product: NormalizedProduct,
  brief: PostReadyBrief,
  images: string[],
  opts: ComposeOptions & { style?: FixedStyle } = {},
): string {
  const fn = STYLES[opts.style ?? "depth"] ?? compose3d;
  return fn(product, brief, images, opts);
}
