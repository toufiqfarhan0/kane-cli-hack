import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import {
  loadConfig,
  prefix,
  putObject,
  updateJob,
  getPool,
  getJob,
  resolveHyperframesLaunch,
  type AdStyle,
  type Artifact,
  type AspectRatio,
  type Beat,
  type JobInput,
  type NormalizedProduct,
  type PostReadyBrief,
  type PostReadyStoryboard,
} from "@postready/core";
import { workDir } from "./temp-dir.js";
import { emitEvent } from "./health.js";
import { ApplicationFailure, Context } from "@temporalio/activity";
import { soundtrack } from "./engine/synth-audio.js";
import { DURATION, composeDirected, storyboardCues } from "./engine/storyboard-scene.js";
import { LAUNCH_CUES, composeWebsiteLaunch } from "./engine/deck-launch.js";
import { SOUND_CUES, composeVideo } from "./engine/style-presets.js";

const execFileAsync = promisify(execFile);
const cfg = loadConfig();

function beatHeartbeat(info?: unknown) {
  try {
    Context.current().heartbeat(info);
  } catch {
    /* not inside Temporal activity */
  }
}

const WIDTH = 1440;
const HEIGHT = 900;
const FPS = 30;
const AR = 48000;

function findStills(dir: string): string[] {
  const acc: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) {
        if (name.name === "live" || name.name === "_raw" || name.name === "_testmd") continue;
        walk(p);
        continue;
      }
      if (/annotated/i.test(name.name)) continue;
      if (!/\.(jpg|jpeg|png)$/i.test(name.name)) continue;
      if (statSync(p).size < 16_000) continue;
      acc.push(p);
    }
  };
  walk(dir);
  return acc.sort();
}

async function ff(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv; shell?: boolean; maxBuffer?: number },
) {
  beatHeartbeat({ cmd });
  const hb = setInterval(() => beatHeartbeat({ cmd }), 10_000);
  try {
    return await execFileAsync(cmd, args, {
      cwd: opts?.cwd,
      timeout: opts?.timeout ?? 180_000,
      env: opts?.env,
      shell: opts?.shell,
      maxBuffer: opts?.maxBuffer ?? 1 << 25,
      windowsHide: true,
    });
  } finally {
    clearInterval(hb);
  }
}

async function probeDuration(path: string): Promise<number> {
  const { stdout } = await ff("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]).catch(() => ({ stdout: "0" }));
  return Number(stdout.trim()) || 0;
}

const SCALE = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p`;

type LiveRec = { t: number; file: string; url?: string };

function readLiveIndex(dir: string): LiveRec[] {
  const p = join(dir, "stills", "live", "index.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const rec = JSON.parse(line) as LiveRec;
        return rec.file && existsSync(rec.file) ? [rec] : [];
      } catch {
        return [];
      }
    });
}

async function pictureFromTimedJpegs(files: string[], stepSec: number[], seconds: number, outMp4: string) {
  if (!files.length) return false;
  const picked: { file: string; dur: number }[] = [];
  let acc = 0;
  for (let i = files.length - 1; i >= 0 && acc < seconds; i--) {
    const raw = i === files.length - 1 ? Math.max(1.5, stepSec[i] ?? 0.25) : Math.max(0.04, stepSec[i] ?? 0.25);
    const dur = Math.min(raw, seconds - acc);
    picked.unshift({ file: files[i], dur });
    acc += dur;
  }
  const d = seconds.toFixed(3);
  const list = outMp4.replace(/\.mp4$/, ".txt");
  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < picked.length; i++) {
    const escaped = picked[i].file.replace(/'/g, `'\\''`);
    const dur = i === picked.length - 1 ? Math.max(0.04, seconds - used) : picked[i].dur;
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${dur.toFixed(3)}`);
    used += dur;
  }
  const last = picked[picked.length - 1].file.replace(/'/g, `'\\''`);
  lines.push(`file '${last}'`);
  writeFileSync(list, `${lines.join("\n")}\n`);
  await ff("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-vf",
    SCALE,
    "-t",
    d,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outMp4,
  ]);
  return existsSync(outMp4) && statSync(outMp4).size > 1000;
}

function liveFilesForWindow(
  live: LiveRec[],
  t0: number,
  win: { startMs: number; endMs: number } | undefined,
  audioDur: number,
  carry?: string,
): { files: string[]; steps: number[]; lastUrl?: string } {
  if (!live.length) return { files: carry ? [carry] : [], steps: [] };
  const a = t0 + (win?.startMs ?? 0);
  const b = t0 + (win?.endMs ?? live[live.length - 1].t - t0 + 1);
  let inWin = live.filter((f) => f.t >= a && f.t <= b);
  if (!inWin.length) {
    const before = live.filter((f) => f.t <= b);
    if (before.length) inWin = [before[before.length - 1]];
    else if (carry) return { files: [carry], steps: [Math.max(1.5, audioDur)] };
    else inWin = [live[0]];
  }
  const tailStart = b - Math.max(audioDur, 1.5) * 1000;
  const tail = inWin.filter((f) => f.t >= tailStart);
  const use = tail.length ? tail : inWin.slice(-8);
  const files = use.map((f) => f.file);
  const steps = use.map((f, i) =>
    i + 1 < use.length ? Math.max(0.04, (use[i + 1].t - f.t) / 1000) : Math.max(1.5, audioDur),
  );
  return { files, steps, lastUrl: use[use.length - 1]?.url };
}

async function sliceScreen(src: string, startSec: number, seconds: number, outMp4: string) {
  const d = seconds.toFixed(3);
  await ff("ffmpeg", [
    "-y",
    "-ss",
    Math.max(0, startSec).toFixed(3),
    "-i",
    src,
    "-vf",
    `${SCALE},tpad=stop_mode=clone:stop_duration=${(seconds + 3).toFixed(3)},trim=duration=${d},setpts=PTS-STARTPTS`,
    "-an",
    "-t",
    d,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outMp4,
  ]);
}

function findSessionVideo(dir: string): string | undefined {
  const acc: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) {
        if (name.name === "clips" || name.name === "out" || name.name === "audio") continue;
        walk(p);
        continue;
      }
      if (/\.(webm|mp4)$/i.test(name.name) && statSync(p).size > 40_000) acc.push(p);
    }
  };
  walk(join(dir, "pw-video"));
  walk(join(dir, "stills"));
  return acc.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}
async function pictureForDuration(pngs: string[], seconds: number, outMp4: string) {
  if (!pngs.length) return false;
  const shot = pngs[pngs.length - 1];
  const escaped = shot.replace(/'/g, `'\\''`);
  const list = outMp4.replace(/\.mp4$/, ".txt");
  const d = seconds.toFixed(3);
  writeFileSync(list, `file '${escaped}'\nduration ${d}\nfile '${escaped}'\n`);
  await ff("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    "-vf",
    SCALE,
    "-t",
    d,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outMp4,
  ]);
  return true;
}

/**
 * One beat = one sealed MP4. Video is padded/trimmed to the WAV length.
 * Audio is atrimmed/apadded to the same length. No -shortest (that cuts speech).
 */
async function sealBeat(silentVideo: string, wav: string, seconds: number, outMp4: string) {
  const d = seconds.toFixed(3);
  await ff("ffmpeg", [
    "-y",
    "-i",
    silentVideo,
    "-i",
    wav,
    "-filter_complex",
    [
      `[0:v]${SCALE},tpad=stop_mode=clone:stop_duration=${(seconds + 3).toFixed(3)},trim=duration=${d},setpts=PTS-STARTPTS[v]`,
      `[1:a]aformat=sample_rates=${AR}:channel_layouts=mono,apad=pad_dur=2,atrim=0:${d},asetpts=PTS-STARTPTS[a]`,
    ].join(";"),
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ar",
    String(AR),
    "-ac",
    "1",
    "-t",
    d,
    "-movflags",
    "+faststart",
    outMp4,
  ]);
}

async function elevenLabsSpeech(apiKey: string, voiceId: string, text: string, wavPath: string): Promise<boolean> {
  try {
    const id = voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel default
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: "eleven_multilingual_v2",
      }),
    });
    if (!res.ok) {
      console.error("ElevenLabs speech failed", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mp3 = wavPath.replace(/\.wav$/, ".mp3");
    writeFileSync(mp3, buf);
    await ff("ffmpeg", ["-y", "-i", mp3, "-ar", String(AR), "-ac", "1", wavPath], {
      timeout: 30_000,
    });
    return true;
  } catch (err) {
    console.error("ElevenLabs speech error", err);
    return false;
  }
}

async function lmntSpeech(apiKey: string, voice: string, text: string, wavPath: string): Promise<boolean> {
  try {
    const headers = {
      "X-API-Key": apiKey.trim(),
      "lmnt-version": "1.2",
      "Content-Type": "application/json",
    };
    const body = JSON.stringify({ text: text.slice(0, 5000), voice, format: "mp3" });
    // Binary endpoint — /v1/ai/speech returns JSON+base64, not raw audio.
    let res = await fetch("https://api.lmnt.com/v1/ai/speech/bytes", {
      method: "POST",
      headers,
      body,
    });
    let buf: Buffer;
    if (res.ok) {
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      res = await fetch("https://api.lmnt.com/v1/ai/speech", { method: "POST", headers, body });
      if (!res.ok) {
        console.error("lmnt speech failed", res.status, (await res.text()).slice(0, 400));
        return false;
      }
      const json = (await res.json()) as { audio?: string };
      if (!json.audio) return false;
      buf = Buffer.from(json.audio, "base64");
    }
    if (buf.length > 0 && buf[0] === 0x7b) {
      const json = JSON.parse(buf.toString("utf8")) as { audio?: string };
      if (!json.audio) return false;
      buf = Buffer.from(json.audio, "base64");
    }
    const mp3 = wavPath.replace(/\.wav$/, ".mp3");
    writeFileSync(mp3, buf);
    await ff("ffmpeg", ["-y", "-i", mp3, "-ar", String(AR), "-ac", "1", wavPath], {
      timeout: 30_000,
    });
    return true;
  } catch (err) {
    console.error("lmnt speech error", err);
    return false;
  }
}

/** Neural TTS via Microsoft Edge (much better than espeak on Linux). */
async function edgeTtsSpeech(text: string, wavPath: string): Promise<boolean> {
  const mp3 = wavPath.replace(/\.wav$/, ".edge.mp3");
  const voice = process.env.EDGE_TTS_VOICE || "en-US-JennyNeural";
  const edgeArgs = ["--voice", voice, "--text", text, "--write-media", mp3];
  const launchers: Array<[string, string[]]> = [
    ["edge-tts", edgeArgs],
    ["python", ["-m", "edge_tts", ...edgeArgs]],
    ["python3", ["-m", "edge_tts", ...edgeArgs]],
  ];
  for (const [cmd, args] of launchers) {
    try {
      await ff(cmd, args, { timeout: 90_000 });
      await ff("ffmpeg", ["-y", "-i", mp3, "-ar", String(AR), "-ac", "1", wavPath], {
        timeout: 30_000,
      });
      return true;
    } catch {
      /* try next launcher */
    }
  }
  console.error("edge-tts failed across launchers");
  return false;
}

async function synthesizeSingleText(text: string, raw: string): Promise<string> {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const elevenVoice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (elevenKey && (await elevenLabsSpeech(elevenKey, elevenVoice, text, raw))) {
    return "elevenlabs";
  }
  if (
    cfg.lmntApiKey &&
    (await lmntSpeech(cfg.lmntApiKey, process.env.LMNT_VOICE || cfg.lmntVoice, text, raw))
  ) {
    return "lmnt";
  }
  if (await edgeTtsSpeech(text, raw)) {
    return "edge-tts";
  }
  if (process.platform === "darwin") {
    await ff("say", ["-o", raw, "--data-format=LEF32@22050", text]);
    return "say";
  }
  writeFileSync(raw.replace(/\.wav$/, ".txt"), text);
  const spoken = await ff("espeak-ng", ["-w", raw, text])
    .catch(() => ff("espeak", ["-w", raw, text]))
    .catch(() => null);
  if (spoken) return "espeak";
  await ff("ffmpeg", ["-f", "lavfi", "-i", `anullsrc=r=${AR}:cl=mono`, "-t", "3", "-y", raw]);
  return "silence";
}

export async function synthesizeBeats(args: {
  jobId: string;
  mode: "kane" | "naive";
  beats: Beat[];
  engine?: string;
}): Promise<{ seconds: number[]; wavs: string[] }> {
  const dir = join(workDir(args.jobId), "audio");
  mkdirSync(dir, { recursive: true });
  const seconds: number[] = [];
  const wavs: string[] = [];
  const engines: string[] = [];
  for (let i = 0; i < args.beats.length; i++) {
    beatHeartbeat({ phase: "tts", beat: i });
    const raw = join(dir, `beat-${i}-raw.wav`);
    const wav = join(dir, `beat-${i}.wav`);
    const text = args.beats[i].narration;
    try {
      const engine = await synthesizeSingleText(text, raw);
      engines.push(engine);
      await ff("ffmpeg", ["-y", "-i", raw, "-ar", String(AR), "-ac", "1", wav]);
      const dur = await probeDuration(wav);
      seconds.push(dur > 0 ? dur : 3);
      wavs.push(wav);
      await putObject(
        prefix(args.mode, args.jobId, `audio/beat-${i}.wav`),
        await import("node:fs/promises").then((fs) => fs.readFile(wav)),
        "audio/wav",
      );
    } catch {
      seconds.push(3);
      wavs.push(wav);
      engines.push("error");
    }
  }
  await emitEvent(args.jobId, "phase", { phase: "tts", seconds, engines });
  return { seconds, wavs };
}

export async function assembleDemo(args: {
  jobId: string;
  mode: "kane" | "naive";
  beats: Beat[];
  seconds: number[];
  videoPath?: string;
  productName?: string;
  websiteUrl: string;
}): Promise<{ objectKey: string; captionsKey: string; timelineKey: string }> {
  const dir = workDir(args.jobId);
  const outDir = join(dir, "out");
  mkdirSync(outDir, { recursive: true });
  const audioDir = join(dir, "audio");
  const clipsDir = join(dir, "clips");
  mkdirSync(clipsDir, { recursive: true });

  const durations: number[] = [];
  for (let i = 0; i < args.beats.length; i++) {
    const wav = join(audioDir, `beat-${i}.wav`);
    const probed = existsSync(wav) ? await probeDuration(wav) : 0;
    durations.push(probed || args.seconds[i] || 3);
  }

  const srtLines: string[] = [];
  let t = 0;
  const timeline = args.beats.map((b, i) => {
    const d = durations[i];
    const start = t;
    t += d;
    const fmt = (s: number) => {
      const ms = Math.floor((s % 1) * 1000);
      const sec = Math.floor(s) % 60;
      const min = Math.floor(s / 60);
      const pad = (n: number, w = 2) => String(n).padStart(w, "0");
      return `00:${pad(min)}:${pad(sec)},${String(ms).padStart(3, "0")}`;
    };
    srtLines.push(`${i + 1}\n${fmt(start)} --> ${fmt(start + d)}\n${b.narration}\n`);
    return { beatId: b.id, videoStartMs: start * 1000, videoEndMs: (start + d) * 1000, audioDurationMs: d * 1000 };
  });
  writeFileSync(join(outDir, "captions.srt"), srtLines.join("\n"));
  writeFileSync(join(dir, "timeline.json"), JSON.stringify({ timeline, durations }, null, 2));

  const outMp4 = join(outDir, "demo.mp4");

  try {
    const missingWav = args.beats.some((_, i) => !existsSync(join(audioDir, `beat-${i}.wav`)));
    if (missingWav) {
      throw ApplicationFailure.create({
        message: "No narration audio was generated.",
        type: "capture_failed",
        nonRetryable: true,
      });
    }
    let windows: Array<{ beatIndex: number; startMs: number; endMs: number }> = [];
    let captureT0 = 0;
    const tlPath = join(dir, "beat-timeline.json");
    if (existsSync(tlPath)) {
      try {
        const parsed = JSON.parse(readFileSync(tlPath, "utf8")) as {
          windows?: typeof windows;
          t0?: number;
        };
        if (Array.isArray(parsed.windows)) windows = parsed.windows;
        if (typeof parsed.t0 === "number") captureT0 = parsed.t0;
      } catch {
        /* ignore */
      }
    }
    const live = readLiveIndex(dir);
    const screen =
      live.length > 0
        ? undefined
        : (args.videoPath && existsSync(args.videoPath) ? args.videoPath : undefined) || findSessionVideo(dir);
    const screenOk = screen ? (await probeDuration(screen)) > 0.4 : false;

    if (
      !live.length &&
      !screenOk &&
      !args.beats.every((_, i) => findStills(join(dir, "stills", `beat-${i}`)).length > 0)
    ) {
      throw ApplicationFailure.create({
        message: "No browser video or screenshots were captured, so a demo video cannot be built.",
        type: "capture_failed",
        nonRetryable: true,
      });
    }

    const clipFiles: string[] = [];
    let carry: string | undefined;

    for (let i = 0; i < args.beats.length; i++) {
      beatHeartbeat({ phase: "seal", beat: i });
      const audioDur = durations[i];
      const wav = join(audioDir, `beat-${i}.wav`);
      const silent = join(clipsDir, `v-${i}.mp4`);
      const muxed = join(clipsDir, `m-${i}.mp4`);
      let made = false;
      const win = windows.find((w) => w.beatIndex === i) ?? windows[i];
      if (live.length) {
        const picked = liveFilesForWindow(live, captureT0, win, audioDur, carry);
        carry = picked.files[picked.files.length - 1];
        try {
          made = await pictureFromTimedJpegs(picked.files, picked.steps, audioDur, silent);
        } catch {
          made = false;
        }
      }
      if (!made && screenOk && screen) {
        const startSec = win ? win.startMs / 1000 : 0;
        try {
          await sliceScreen(screen, startSec, audioDur, silent);
          made = existsSync(silent) && statSync(silent).size > 1000;
        } catch {
          made = false;
        }
      }
      if (!made) {
        const beatShots = findStills(join(dir, "stills", `beat-${i}`));
        made = await pictureForDuration(beatShots, audioDur, silent);
      }
      if (!made) {
        throw ApplicationFailure.create({
          message: `No video or screenshots for beat ${i + 1}. Kane did not capture that step.`,
          type: "capture_failed",
          nonRetryable: true,
        });
      }

      await sealBeat(silent, wav, audioDur, muxed);
      clipFiles.push(muxed);
    }

    const list = join(dir, "cliplist.txt");
    writeFileSync(list, clipFiles.map((f) => `file '${f.replace(/'/g, `'\\''`)}'`).join("\n"));
    await ff("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      String(AR),
      "-ac",
      "1",
      "-movflags",
      "+faststart",
      outMp4,
    ]);
  } catch (err) {
    writeFileSync(join(outDir, "assemble-error.txt"), String(err));
    throw err;
  }

  const fs = await import("node:fs/promises");
  const mp4 = await fs.readFile(outMp4);
  const srt = await fs.readFile(join(outDir, "captions.srt"));
  const tl = await fs.readFile(join(dir, "timeline.json"));
  const objectKey = prefix(args.mode, args.jobId, "out/demo.mp4");
  const captionsKey = prefix(args.mode, args.jobId, "out/captions.srt");
  const timelineKey = prefix(args.mode, args.jobId, "timeline.json");
  await putObject(objectKey, mp4, "video/mp4");
  await putObject(captionsKey, srt, "text/plain");
  await putObject(timelineKey, tl, "application/json");

  const db = getPool(cfg.databaseUrl);
  const prior = ((await getJob(db, args.jobId))?.artifacts ?? []).filter(
    (a) => a.type === "kane-log" || a.type === "kane-jsonl",
  );
  const artifacts: Artifact[] = [
    ...prior,
    { type: "video", object_key: objectKey, mime_type: "video/mp4" },
    { type: "captions", object_key: captionsKey, mime_type: "text/plain" },
    { type: "timeline", object_key: timelineKey, mime_type: "application/json" },
  ];
  await updateJob(getPool(cfg.databaseUrl), args.jobId, {
    status: "completed",
    step: "upload",
    artifacts,
    error: null,
  });
  await emitEvent(args.jobId, "phase", { phase: "completed", objectKey });
  return { objectKey, captionsKey, timelineKey };
}

function fmtSrtTime(s: number): string {
  const clamped = Math.max(0, s);
  const ms = Math.floor((clamped % 1) * 1000);
  const sec = Math.floor(clamped) % 60;
  const min = Math.floor(clamped / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `00:${pad(min)}:${pad(sec)},${String(ms).padStart(3, "0")}`;
}

const ASPECT_DIMS: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "16:9": [1920, 1080],
};

async function buildWalkthroughClip(dir: string, outMp4: string, targetSeconds = 5.4): Promise<boolean> {
  const live = readLiveIndex(dir).filter((rec) => {
    try {
      return statSync(rec.file).size >= 16_000;
    } catch {
      return false;
    }
  });
  if (live.length < 4) return false;
  // Skip earliest loading frame when plenty of captured walkthrough frames exist
  const trimmed = live.length >= 10 ? live.slice(2) : live;
  const maxFrames = 64;
  const sampled: LiveRec[] = [];
  if (trimmed.length <= maxFrames) {
    sampled.push(...trimmed);
  } else {
    for (let k = 0; k < maxFrames; k++) {
      sampled.push(trimmed[Math.round((k * (trimmed.length - 1)) / (maxFrames - 1))]!);
    }
  }
  const perFrame = Math.max(0.06, targetSeconds / Math.max(1, sampled.length));
  const files = sampled.map((s) => s.file);
  const steps = files.map(() => perFrame);
  const list = outMp4.replace(/\.mp4$/, ".txt");
  const lines: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const escaped = files[i]!.replace(/'/g, `'\\''`);
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${steps[i]!.toFixed(3)}`);
  }
  lines.push(`file '${files[files.length - 1]!.replace(/'/g, `'\\''`)}'`);
  writeFileSync(list, `${lines.join("\n")}\n`);
  try {
    await ff("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-vf",
      "scale=1280:800:force_original_aspect_ratio=increase,crop=1280:800,setsar=1,fps=30,format=yuv420p",
      "-t",
      targetSeconds.toFixed(3),
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      outMp4,
    ]);
    return existsSync(outMp4) && statSync(outMp4).size > 10_000;
  } catch {
    return false;
  }
}

export async function renderProductShort(args: {
  jobId: string;
  mode: "kane" | "naive";
  input: JobInput;
  product: NormalizedProduct;
  style: AdStyle;
  brief?: PostReadyBrief;
  storyboard?: PostReadyStoryboard;
  voiceover: string[];
  localImages: string[];
  cutouts: Array<string | null>;
}): Promise<{ objectKey: string; captionsKey: string; timelineKey: string }> {
  const dir = workDir(args.jobId);
  const outDir = join(dir, "out");
  mkdirSync(outDir, { recursive: true });
  const renderDir = join(dir, "hyperframes-render");
  rmSync(renderDir, { recursive: true, force: true });
  mkdirSync(join(renderDir, "assets"), { recursive: true });

  const relImages = args.localImages.map((srcPath, i) => {
    const ext = extname(srcPath) || ".jpg";
    const rel = `./assets/img-${i}${ext}`;
    copyFileSync(srcPath, join(renderDir, rel));
    return rel;
  });

  const relCutouts = args.cutouts.map((cutPath, i) => {
    if (!cutPath || !existsSync(cutPath)) return null;
    const rel = `./assets/cut-${i}.png`;
    copyFileSync(cutPath, join(renderDir, rel));
    return rel;
  });

  const aspect =
    args.input.aspect_ratio ??
    (args.input.job_type === "website_short" ? "16:9" : "9:16");
  const isWebsiteLaunch = args.input.job_type === "website_short";
  const [tw, th] = ASPECT_DIMS[aspect] ?? (isWebsiteLaunch ? [1920, 1080] : [1080, 1920]);
  const isDirector = args.style === "director" && Boolean(args.storyboard);
  const theme = isDirector
    ? args.storyboard!.theme
    : args.brief?.theme ?? "noir";
  const cues = isWebsiteLaunch
    ? LAUNCH_CUES
    : isDirector
      ? storyboardCues(args.storyboard!)
      : SOUND_CUES[
          args.style === "reel" || args.style === "classic" ? args.style : "depth"
        ];

  let walkthroughVideoRel: string | undefined;
  if (isWebsiteLaunch) {
    const wtDest = join(renderDir, "assets", "walkthrough.mp4");
    if (await buildWalkthroughClip(dir, wtDest, 5.5)) {
      walkthroughVideoRel = "./assets/walkthrough.mp4";
    }
  }

  const bgmWav = join(dir, "bgm.wav");
  writeFileSync(bgmWav, soundtrack({ theme, duration: DURATION, ...cues }));

  const lines = args.voiceover.map((l) => l.trim()).filter(Boolean);
  const span = Math.max(1, lines.length);
  const stepSec = 13.8 / span;
  const srtContent = (lines.length ? lines : [`${args.product.brand} — ${args.product.title}`])
    .map((text, idx) => {
      const start = 0.4 + idx * stepSec;
      const end = Math.min(DURATION - 0.2, start + stepSec - 0.1);
      return `${idx + 1}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${text}\n`;
    })
    .join("\n");
  writeFileSync(join(outDir, "captions.srt"), srtContent);

  const audioAssetRel = "./assets/audio.wav";
  const finalAudioWav = join(renderDir, "assets", "audio.wav");
  const db = getPool(cfg.databaseUrl);

  let voiceEngine = "music-only";
  let voiceDuration = 0;
  if (args.input.voiceover_enabled !== false && lines.length) {
    beatHeartbeat({ phase: "tts" });
    const voiceRaw = join(dir, "voice-raw.wav");
    const voiceFit = join(dir, "voice-fit.wav");
    voiceEngine = await synthesizeSingleText(lines.join(". "), voiceRaw);
    if (voiceEngine !== "silence") {
      voiceDuration = await probeDuration(voiceRaw);
      const maxVoiceSec = 13.9;
      if (voiceDuration > maxVoiceSec) {
        const tempo = Math.min(1.42, voiceDuration / (maxVoiceSec - 0.1));
        await ff("ffmpeg", [
          "-y",
          "-i",
          voiceRaw,
          "-filter:a",
          `atempo=${tempo.toFixed(3)}`,
          "-ar",
          "44100",
          "-ac",
          "2",
          voiceFit,
        ]);
        voiceDuration = await probeDuration(voiceFit);
      } else {
        copyFileSync(voiceRaw, voiceFit);
      }
      await ff("ffmpeg", [
        "-y",
        "-i",
        bgmWav,
        "-i",
        voiceFit,
        "-filter_complex",
        [
          "[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=0.58[bgm]",
          "[1:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=350|350,apad=whole_dur=15,volume=1.15,asplit=2[vo_sc][vo_mix]",
          "[bgm][vo_sc]sidechaincompress=threshold=0.015:ratio=4.5:attack=30:release=280[bgm_ducked]",
          "[bgm_ducked][vo_mix]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[out]",
        ].join(";"),
        "-map",
        "[out]",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-t",
        String(DURATION),
        finalAudioWav,
      ]);
    } else {
      copyFileSync(bgmWav, finalAudioWav);
    }
  } else {
    copyFileSync(bgmWav, finalAudioWav);
  }

  await emitEvent(args.jobId, "phase", {
    phase: "tts",
    seconds: [voiceDuration || DURATION],
    engines: [voiceEngine],
  });

  await updateJob(db, args.jobId, { step: "render" });
  await emitEvent(args.jobId, "phase", {
    phase: "render",
    style: args.style,
    theme,
    walkthroughRecorded: Boolean(walkthroughVideoRel),
  });

  const html = isWebsiteLaunch
    ? composeWebsiteLaunch(args.product, relImages, {
        style: args.style,
        brief: args.brief,
        storyboard: args.storyboard,
        audio: audioAssetRel,
        width: tw,
        height: th,
        walkthroughVideo: walkthroughVideoRel,
      })
    : isDirector
      ? composeDirected(args.product, args.storyboard!, relImages, {
          audio: audioAssetRel,
          cutouts: relCutouts,
        })
      : composeVideo(args.product, args.brief!, relImages, {
          style:
            args.style === "reel" || args.style === "classic" ? args.style : "depth",
          audio: audioAssetRel,
          cutouts: relCutouts,
        });

  writeFileSync(join(renderDir, "index.html"), html);
  writeFileSync(
    join(renderDir, "hyperframes.json"),
    JSON.stringify({ paths: { assets: "assets" } }, null, 2),
  );

  const rawRenderedMp4 = join(
    outDir,
    isWebsiteLaunch ? `launch-${tw}x${th}.mp4` : "short-9x16.mp4",
  );
  const outMp4 = join(outDir, "demo.mp4");
  const launch = resolveHyperframesLaunch(
    ["render", ".", "--output", rawRenderedMp4, "--quiet"],
    process.env,
  );

  try {
    await ff(launch.command, launch.args, {
      cwd: renderDir,
      timeout: 300_000,
      shell: launch.shell,
      env: { ...process.env, HYPERFRAMES_RENDER_LOCK: "off" },
    });

    const nativeMatchesAspect = isWebsiteLaunch ? true : aspect === "9:16";
    if (nativeMatchesAspect) {
      await ff("ffmpeg", [
        "-y",
        "-i",
        rawRenderedMp4,
        "-i",
        finalAudioWav,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-t",
        String(DURATION),
        "-movflags",
        "+faststart",
        outMp4,
      ]);
    } else {
      const [tw, th] = ASPECT_DIMS[aspect] ?? [1080, 1920];
      await ff("ffmpeg", [
        "-y",
        "-i",
        rawRenderedMp4,
        "-i",
        finalAudioWav,
        "-filter_complex",
        `[0:v]split=2[bg][fg];[bg]scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},boxblur=28:10,eq=brightness=-0.12[b];[fg]scale=${tw}:${th}:force_original_aspect_ratio=decrease[f];[b][f]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]`,
        "-map",
        "[v]",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-t",
        String(DURATION),
        "-movflags",
        "+faststart",
        outMp4,
      ]);
    }
  } catch (err) {
    writeFileSync(join(outDir, "render-error.txt"), String(err));
    throw err;
  }

  const finalDur = await probeDuration(outMp4);
  if (!existsSync(outMp4) || finalDur < 1) {
    throw ApplicationFailure.create({
      message: "HyperFrames render did not produce a valid video.",
      type: "capture_failed",
      nonRetryable: true,
    });
  }

  const timelinePayload = {
    job_type: args.input.job_type ?? "product_short",
    style: args.style,
    theme,
    aspect_ratio: aspect,
    duration: finalDur,
    voiceEngine,
    cues,
    product: {
      brand: args.product.brand,
      title: args.product.title,
      price: args.product.price,
      domain: args.product.domain,
    },
    scenes: args.storyboard?.scenes ?? undefined,
    brief: args.brief ?? undefined,
    voiceover: lines,
  };
  writeFileSync(join(dir, "timeline.json"), JSON.stringify(timelinePayload, null, 2));

  const fs = await import("node:fs/promises");
  const [mp4Buf, srtBuf, tlBuf, htmlBuf] = await Promise.all([
    fs.readFile(outMp4),
    fs.readFile(join(outDir, "captions.srt")),
    fs.readFile(join(dir, "timeline.json")),
    fs.readFile(join(renderDir, "index.html")),
  ]);

  const objectKey = prefix(args.mode, args.jobId, "out/demo.mp4");
  const captionsKey = prefix(args.mode, args.jobId, "out/captions.srt");
  const timelineKey = prefix(args.mode, args.jobId, "timeline.json");
  const compositionKey = prefix(args.mode, args.jobId, "out/index.html");

  await Promise.all([
    putObject(objectKey, mp4Buf, "video/mp4"),
    putObject(captionsKey, srtBuf, "text/plain"),
    putObject(timelineKey, tlBuf, "application/json"),
    putObject(compositionKey, htmlBuf, "text/html"),
  ]);

  const prior = ((await getJob(db, args.jobId))?.artifacts ?? []).filter(
    (a) =>
      a.type === "kane-log" ||
      a.type === "kane-jsonl" ||
      a.type === "product" ||
      a.type === "plan",
  );
  const artifacts: Artifact[] = [
    ...prior,
    { type: "video", object_key: objectKey, mime_type: "video/mp4" },
    { type: "captions", object_key: captionsKey, mime_type: "text/plain" },
    { type: "timeline", object_key: timelineKey, mime_type: "application/json" },
    { type: "composition", object_key: compositionKey, mime_type: "text/html" },
  ];
  await updateJob(db, args.jobId, {
    status: "completed",
    step: "upload",
    artifacts,
    error: null,
  });
  await emitEvent(args.jobId, "phase", { phase: "completed", objectKey });
  return { objectKey, captionsKey, timelineKey };
}
