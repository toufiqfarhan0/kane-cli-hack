import { execFile } from "node:child_process";

const DEMUXER: Record<string, string> = {
  jpg: "jpeg_pipe",
  png: "png_pipe",
  webp: "webp_pipe",
};

function parsePam(buf: Buffer): { w: number; h: number; px: Buffer } {
  const end = buf.indexOf("ENDHDR\n");
  if (end < 0) throw new Error("bad PAM");
  const head = buf.toString("latin1", 0, end);
  const w = Number(/WIDTH (\d+)/.exec(head)?.[1]);
  const h = Number(/HEIGHT (\d+)/.exec(head)?.[1]);
  const depth = Number(/DEPTH (\d+)/.exec(head)?.[1]);
  if (!w || !h || depth !== 4) throw new Error("bad PAM");
  return { w, h, px: buf.subarray(end + 7, end + 7 + w * h * 4) };
}

export async function cutout(
  file: string,
  kind: string,
  outFile: string,
): Promise<{ width: number; height: number; share: number } | null> {
  const demuxer = DEMUXER[kind];
  if (!demuxer) return null;

  const stdout = await new Promise<Buffer>((resolve, reject) => {
    execFile(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-protocol_whitelist",
        "file",
        "-f",
        demuxer,
        "-i",
        file,
        "-vf",
        "scale=1100:1100:force_original_aspect_ratio=decrease",
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-c:v",
        "pam",
        "-pix_fmt",
        "rgba",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 1 << 26 },
      (err, out) => {
        if (err) reject(err);
        else resolve(out);
      },
    );
  });

  const { w, h, px } = parsePam(stdout);
  const at = (x: number, y: number) => (y * w + x) * 4;

  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(at(x, 0), at(x, h - 1));
  for (let y = 1; y < h - 1; y++) border.push(at(0, y), at(w - 1, y));

  const mean = [0, 0, 0];
  for (const i of border) {
    for (let c = 0; c < 3; c++) mean[c] += px[i + c];
  }
  for (let c = 0; c < 3; c++) mean[c] /= border.length;

  const light = 0.299 * mean[0] + 0.587 * mean[1] + 0.114 * mean[2];
  const near = (i: number, tol: number) =>
    Math.abs(px[i] - mean[0]) <= tol &&
    Math.abs(px[i + 1] - mean[1]) <= tol &&
    Math.abs(px[i + 2] - mean[2]) <= tol;

  const even = border.filter((i) => near(i, 14)).length / border.length;
  if (light < 205 || even < 0.9) return null;

  const TOL = 20;
  const gone = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (!gone[p] && near(p * 4, TOL)) {
      gone[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let kept = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (gone[p]) {
        px[p * 4 + 3] = 0;
        continue;
      }
      let out = 0;
      let total = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          total++;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || gone[ny * w + nx]) out++;
        }
      }
      px[p * 4 + 3] = out ? Math.round(255 * Math.max(0, 1 - (out / total) * 1.6)) : 255;
      kept++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const share = kept / (w * h);
  if (share < 0.05 || share > 0.88 || x1 < 0) return null;

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const crop = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    px.copy(crop, y * cw * 4, at(x0, y0 + y), at(x0, y0 + y) + cw * 4);
  }
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      "ffmpeg",
      [
        "-v",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${cw}x${ch}`,
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-f",
        "image2",
        "-c:v",
        "png",
        outFile,
      ],
      (err) => (err ? reject(err) : resolve()),
    );
    child.stdin?.end(crop);
  });
  return { width: cw, height: ch, share: +share.toFixed(2) };
}
