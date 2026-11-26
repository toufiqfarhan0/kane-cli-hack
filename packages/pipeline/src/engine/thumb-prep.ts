import { execFile } from "node:child_process";

const DEMUXER: Record<string, string> = {
  jpg: "jpeg_pipe",
  png: "png_pipe",
  webp: "webp_pipe",
};

export async function thumbnail(file: string, kind: string): Promise<string | null> {
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
        "scale=448:448:force_original_aspect_ratio=decrease",
        "-frames:v",
        "1",
        "-q:v",
        "6",
        "-f",
        "image2pipe",
        "-c:v",
        "mjpeg",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 1 << 24 },
      (err, out) => {
        if (err) reject(err);
        else resolve(out);
      },
    );
  });
  return `data:image/jpeg;base64,${stdout.toString("base64")}`;
}
