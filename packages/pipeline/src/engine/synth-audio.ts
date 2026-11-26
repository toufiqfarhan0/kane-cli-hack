const SR = 44100;
const TAU = Math.PI * 2;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296 - 0.5;
};

interface MoodDef {
  bpm: number;
  chords: number[][];
  kick: number[];
  clap: number[];
  hat: number;
  arp: number;
  bass: number;
  bright: number;
}

const MOODS: Record<string, MoodDef> = {
  pop: {
    bpm: 122,
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ],
    kick: [0, 1.5, 2, 3],
    clap: [1, 3],
    hat: 0.5,
    arp: 0.25,
    bass: 0.5,
    bright: 1,
  },
  noir: {
    bpm: 98,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    kick: [0, 2.5],
    clap: [1, 3],
    hat: 0.5,
    arp: 0.5,
    bass: 1,
    bright: 0.55,
  },
  editorial: {
    bpm: 104,
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    kick: [0, 2],
    clap: [3],
    hat: 1,
    arp: 0.5,
    bass: 1,
    bright: 0.7,
  },
  neon: {
    bpm: 128,
    chords: [
      [54, 57, 61],
      [50, 54, 57],
      [57, 61, 64],
      [52, 56, 59],
    ],
    kick: [0, 1, 2, 3],
    clap: [1, 3],
    hat: 0.25,
    arp: 0.25,
    bass: 0.5,
    bright: 1.15,
  },
};

export function soundtrack({
  theme = "noir",
  duration = 15,
  cuts = [] as number[],
  pops = [] as number[],
  chime = null as number | null,
} = {}): Buffer {
  const m = MOODS[theme] ?? MOODS.noir;
  const n = Math.round(duration * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / m.bpm;
  const bar = beat * 4;
  const noise = rng(20261121);
  const add = (i: number, l: number, r = l) => {
    if (i >= 0 && i < n) {
      L[i] += l;
      R[i] += r;
    }
  };
  const drumsFrom = bar;

  const kick = (t: number, g = 1) => {
    const len = Math.round(0.28 * SR);
    let ph = 0;
    for (let k = 0; k < len; k++) {
      const x = k / SR;
      ph += (TAU * (46 + 110 * Math.exp(-x * 34))) / SR;
      add(Math.round(t * SR) + k, Math.sin(ph) * Math.exp(-x * 13) * 0.9 * g);
    }
  };
  const clap = (t: number, g = 1) => {
    const len = Math.round(0.16 * SR);
    let prev = 0;
    for (let k = 0; k < len; k++) {
      const x = k / SR;
      const w = noise();
      const hp = w - prev;
      prev = w;
      const env = Math.exp(-x * 30) * (1 + 0.6 * Math.sin(x * 420));
      add(Math.round(t * SR) + k, hp * env * 0.42 * g * 0.9, hp * env * 0.42 * g * 1.1);
    }
  };
  const hat = (t: number, g = 1, pan = 0) => {
    const len = Math.round(0.04 * SR);
    let prev = 0;
    for (let k = 0; k < len; k++) {
      const w = noise();
      const hp = w - prev;
      prev = w;
      const v = hp * Math.exp((-k / SR) * 95) * 0.2 * g * m.bright;
      add(Math.round(t * SR) + k, v * (1 - pan), v * (1 + pan));
    }
  };
  const pluck = (t: number, f: number, g: number, pan: number) => {
    const len = Math.round(0.42 * SR);
    for (const [delay, dg, dp] of [
      [0, 1, pan],
      [beat * 0.75, 0.34, -pan],
      [beat * 1.5, 0.14, pan],
    ] as const) {
      for (let k = 0; k < len; k++) {
        const x = k / SR;
        const env = Math.exp(-x * 9) * Math.min(1, x * 400);
        const s =
          (Math.sin(TAU * f * x) +
            0.35 * Math.sin(TAU * f * 2 * x) +
            0.12 * Math.sin(TAU * f * 3 * x) * m.bright) *
          env *
          g *
          dg;
        add(Math.round((t + delay) * SR) + k, s * (1 - dp), s * (1 + dp));
      }
    }
  };
  const bassNote = (t: number, f: number, len: number, g: number) => {
    const N = Math.round(len * SR);
    for (let k = 0; k < N; k++) {
      const x = k / SR;
      const env = Math.min(1, x * 120) * Math.exp(-x * 4.5) * Math.min(1, (N - k) / 400);
      add(
        Math.round(t * SR) + k,
        (Math.sin(TAU * f * x) + 0.4 * Math.sin(TAU * f * 2 * x) + 0.18 * Math.sin(TAU * f * 3 * x)) *
          env *
          0.34 *
          g,
      );
    }
  };
  const pad = (t: number, notes: number[], len: number, g: number) => {
    const N = Math.round(len * SR);
    notes.forEach((note, j) => {
      const f = hz(note);
      const det = 1 + (j - 1) * 0.0016;
      const pan = (j - (notes.length - 1) / 2) * 0.3;
      for (let k = 0; k < N; k++) {
        const x = k / SR;
        const env = Math.min(1, x * 3.2) * Math.min(1, (N - k) / (SR * 0.35));
        const s = (Math.sin(TAU * f * det * x) + 0.3 * Math.sin(TAU * f * 2 * x)) * env * 0.075 * g;
        add(Math.round(t * SR) + k, s * (1 - pan), s * (1 + pan));
      }
    });
  };

  const bars = Math.ceil(duration / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const chord = m.chords[b % m.chords.length];
    const intro = t0 < drumsFrom;
    pad(t0, chord, bar, 1);
    for (let s = 0; s < 4; s += m.bass) {
      bassNote(t0 + s * beat, hz(chord[0] - 12), m.bass * beat * 0.92, intro ? 0.55 : 1);
    }
    for (let s = 0, i = 0; s < 4; s += m.arp, i++) {
      const note = chord[i % chord.length] + (i % (chord.length * 2) >= chord.length ? 12 : 0) + 12;
      pluck(t0 + s * beat, hz(note), intro ? 0.07 : 0.1, i % 2 ? 0.45 : -0.45);
    }
    if (intro) continue;
    for (const k of m.kick) kick(t0 + k * beat);
    for (const c of m.clap) clap(t0 + c * beat);
    for (let s = 0, i = 0; s < 4; s += m.hat, i++) {
      hat(t0 + s * beat, i % 2 ? 0.7 : 1, i % 2 ? 0.3 : -0.3);
    }
  }
  for (let b = 0; b < bars; b++) {
    if (b * bar < drumsFrom) continue;
    for (const k of m.kick) {
      const s = Math.round((b * bar + k * beat) * SR);
      const len = Math.round(0.16 * SR);
      for (let i = 0; i < len && s + i < n; i++) {
        const g = 0.72 + 0.28 * (i / len);
        L[s + i] *= g;
        R[s + i] *= g;
      }
    }
  }

  for (const c of cuts) {
    const pre = 0.34;
    const post = 0.22;
    const s0 = Math.round((c - pre) * SR);
    const N = Math.round((pre + post) * SR);
    let lp = 0;
    for (let k = 0; k < N; k++) {
      const x = k / N;
      const peak = pre / (pre + post);
      const env = x < peak ? (x / peak) ** 2.2 : ((1 - x) / (1 - peak)) ** 1.6;
      const cutoff = 0.03 + 0.5 * env;
      lp += cutoff * (noise() * 2 - lp);
      const pan = x * 2 - 1;
      add(s0 + k, lp * env * 0.34 * (1 - pan * 0.6), lp * env * 0.34 * (1 + pan * 0.6));
    }
    const len = Math.round(0.2 * SR);
    for (let k = 0; k < len; k++) {
      const x = k / SR;
      add(Math.round(c * SR) + k, Math.sin(TAU * (70 - 90 * x) * x) * Math.exp(-x * 22) * 0.45);
    }
  }
  for (const p of pops) {
    const len = Math.round(0.12 * SR);
    for (let k = 0; k < len; k++) {
      const x = k / SR;
      add(Math.round(p * SR) + k, Math.sin(TAU * (520 + 2600 * x) * x) * Math.exp(-x * 34) * 0.3);
    }
  }
  if (chime != null) {
    const root = hz(m.chords[0][0] + 24);
    for (const [mult, g, delay] of [
      [1, 0.2, 0],
      [1.5, 0.13, 0.07],
      [2, 0.1, 0.14],
      [3, 0.05, 0.14],
    ] as const) {
      const len = Math.round(1.6 * SR);
      for (let k = 0; k < len; k++) {
        const x = k / SR;
        const s = Math.sin(TAU * root * mult * x) * Math.exp(-x * 3.2) * Math.min(1, x * 300) * g;
        add(Math.round((chime + delay) * SR) + k, s * 0.9, s * 1.1);
      }
    }
  }

  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.05) * Math.min(1, (duration - t) / 0.7);
    L[i] = Math.tanh(L[i] * 1.25) * fade;
    R[i] = Math.tanh(R[i] * 1.25) * fade;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0 ? 0.82 / peak : 1;

  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
  }
  return buf;
}
