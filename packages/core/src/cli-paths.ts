import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type KaneLaunch = {
  command: string;
  args: string[];
  shell: boolean;
};

/** Build a cross-platform PATH that includes the global npm bin on Windows and ~/.local/bin on POSIX. */
export function kaneSearchPath(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME || env.USERPROFILE || homedir();
  const base = env.PATH ?? env.Path ?? "";
  const parts = base.split(delimiter).filter(Boolean);
  const extras =
    process.platform === "win32"
      ? [env.APPDATA ? join(env.APPDATA, "npm") : join(home, "AppData", "Roaming", "npm")]
      : [join(home, ".local", "bin")];
  for (const dir of extras) {
    if (dir && !parts.includes(dir)) parts.unshift(dir);
  }
  return parts.join(delimiter);
}

/**
 * Resolve how to execute `kane-cli` across POSIX and Windows.
 * On Windows, npm installs `kane-cli.cmd` (which fails with ENOENT when shell is false),
 * so prefer spawning Node directly on its `.cjs` entrypoint to preserve multiline arguments.
 */
export function resolveKaneLaunch(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): KaneLaunch {
  if (process.platform !== "win32") {
    return { command: "kane-cli", args, shell: false };
  }
  const searchDirs = kaneSearchPath(env).split(delimiter).filter(Boolean);
  for (const dir of searchDirs) {
    const cjsNearCmd = join(dir, "node_modules", "@testmuai", "kane-cli", "bin", "kane-cli.cjs");
    if (existsSync(join(dir, "kane-cli.cmd")) && existsSync(cjsNearCmd)) {
      return { command: process.execPath, args: [cjsNearCmd, ...args], shell: false };
    }
    const exe = join(dir, "kane-cli.exe");
    if (existsSync(exe)) {
      return { command: exe, args, shell: false };
    }
    const cmd = join(dir, "kane-cli.cmd");
    if (existsSync(cmd)) {
      return { command: cmd, args, shell: true };
    }
  }
  const appDataCjs = join(
    env.APPDATA || join(homedir(), "AppData", "Roaming"),
    "npm",
    "node_modules",
    "@testmuai",
    "kane-cli",
    "bin",
    "kane-cli.cjs",
  );
  if (existsSync(appDataCjs)) {
    return { command: process.execPath, args: [appDataCjs, ...args], shell: false };
  }
  return { command: "kane-cli", args, shell: true };
}

/**
 * Resolve how to execute `hyperframes` reliably on Windows and POSIX.
 * Walks up from this package and cwd to find `node_modules/hyperframes/bin/hyperframes.mjs`
 * and launches it directly via Node (`process.execPath`) with `shell: false`.
 */
export function resolveHyperframesLaunch(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): KaneLaunch {
  const roots = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of roots) {
    let dir = resolve(start);
    for (let i = 0; i < 6; i++) {
      const mjs = join(dir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      if (existsSync(mjs)) {
        return { command: process.execPath, args: [mjs, ...args], shell: false };
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  if (process.platform === "win32") {
    const searchDirs = kaneSearchPath(env).split(delimiter).filter(Boolean);
    for (const dir of searchDirs) {
      const mjs = join(dir, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
      if (existsSync(mjs)) {
        return { command: process.execPath, args: [mjs, ...args], shell: false };
      }
      const cmd = join(dir, "hyperframes.cmd");
      if (existsSync(cmd)) {
        return { command: cmd, args, shell: true };
      }
    }
  }
  return { command: "hyperframes", args, shell: process.platform === "win32" };
}
