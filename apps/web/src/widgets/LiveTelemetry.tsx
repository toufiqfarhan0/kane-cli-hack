import type { Ev } from "../models";

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function showEvent(e: Ev) {
  if (e.kind === "kane_cmd" || e.kind === "ndjson" || e.kind === "heal" || e.kind === "kane_step") {
    return true;
  }
  if (e.kind !== "phase") return false;
  const phase = String(e.payload?.phase ?? "");
  return phase !== "slot_acquired" && phase !== "slot_released";
}

function stepList(raw: unknown): Array<{ tool?: string; text?: string; status?: string; remark?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { text: item };
    if (item && typeof item === "object") return item as { tool?: string; text?: string; status?: string; remark?: string };
    return { text: String(item) };
  });
}

function ConsoleRow({ e }: { e: Ev }) {
  const p = e.payload ?? {};
  if (e.kind === "kane_step") {
    const tool = String(p.tool ?? "kane");
    const status = String(p.status ?? "");
    const bad = /fail/i.test(status);
    const ok = /pass|ok|success|done/i.test(status);
    return (
      <article className={`log-row ${bad ? "bad" : ok ? "ok" : "active"}`}>
        <header>
          <span className="log-kind">{tool}</span>
          <span className="log-phase">{status}</span>
          <time>{fmtTime(e.ts)}</time>
        </header>
        {p.text ? <p>{String(p.text)}</p> : null}
      </article>
    );
  }
  if (e.kind === "kane_cmd") {
    return (
      <article className="log-row active">
        <header>
          <span className="log-kind">Kane start</span>
          <span className="log-phase">{String(p.phase ?? "")}</span>
          <time>{fmtTime(e.ts)}</time>
        </header>
        {p.action ? <p>{String(p.action)}</p> : null}
      </article>
    );
  }
  if (e.kind === "ndjson") {
    const runEnd = (p.runEnd ?? {}) as Record<string, unknown>;
    const status = String(runEnd.status ?? (p.exitCode === 0 ? "ok" : `exit ${p.exitCode ?? "?"}`));
    const summary = String(p.summary ?? runEnd.summary ?? "").split("\n")[0];
    const steps = stepList(p.steps ?? p.remarks ?? p.remark);
    const ok = String(status).includes("pass") || status === "ok";
    return (
      <article className={`log-row ${ok ? "ok" : "active"}`}>
        <header>
          <span className="log-kind">Kane run</span>
          <span className="log-phase">
            {status}
            {p.stills != null ? ` · ${p.stills} stills` : ""}
          </span>
          <time>{fmtTime(e.ts)}</time>
        </header>
        {summary ? <p>{summary}</p> : p.url ? <p>{String(p.url)}</p> : null}
        {steps.length > 0 && (
          <ol className="log-steps">
            {steps.map((r, i) => (
              <li key={i}>
                <strong>{r.tool ? `${r.tool}: ` : ""}</strong>
                {String(r.text ?? r.remark ?? r.status ?? "step")}
              </li>
            ))}
          </ol>
        )}
      </article>
    );
  }
  if (e.kind === "phase") {
    const phase = String(p.phase ?? "");
    if (phase === "plan") {
      const narrations = Array.isArray(p.narrations) ? (p.narrations as string[]) : [];
      const actions = Array.isArray(p.actions) ? (p.actions as string[]) : [];
      const rows = Math.max(narrations.length, actions.length);
      return (
        <article className="log-row ok">
          <header>
            <span className="log-kind">Plan</span>
            <span className="log-phase">{String(p.source ?? "script")}</span>
            <time>{fmtTime(e.ts)}</time>
          </header>
          <ol className="log-steps">
            {Array.from({ length: rows }, (_, i) => (
              <li key={i}>
                {actions[i] ? (
                  <>
                    <strong>Scene: </strong>
                    {actions[i]}
                    <br />
                  </>
                ) : null}
                {narrations[i] ? (
                  <>
                    <strong>Voice: </strong>
                    {narrations[i]}
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </article>
      );
    }
    if (phase === "product_map" || phase === "site_map") {
      const state = (p.final_state ?? {}) as Record<string, string>;
      return (
        <article className="log-row ok">
          <header>
            <span className="log-kind">{phase === "product_map" ? "Capture map" : "Kane map"}</span>
            <time>{fmtTime(e.ts)}</time>
          </header>
          <ul className="log-steps">
            {state.hero_heading ? <li>Title: {state.hero_heading}</li> : null}
            {state.hero_cta ? <li>Brand: {state.hero_cta}</li> : null}
            {state.nav_items ? <li>Nav: {state.nav_items}</li> : null}
            {state.inputs ? <li>Assets: {state.inputs}</li> : null}
            {state.buttons ? <li>Details: {state.buttons}</li> : null}
          </ul>
        </article>
      );
    }
    if (phase === "tts") {
      const secs = Array.isArray(p.seconds) ? (p.seconds as number[]) : [];
      const engines = Array.isArray(p.engines) ? (p.engines as string[]) : [];
      return (
        <article className="log-row ok">
          <header>
            <span className="log-kind">Voice</span>
            <span className="log-phase">{engines[0] ? engines[0] : `${secs.length} lines`}</span>
            <time>{fmtTime(e.ts)}</time>
          </header>
          <p>{secs.map((s) => `${Number(s).toFixed(1)}s audio track`).join(" · ")}</p>
        </article>
      );
    }
    if (phase === "completed" || phase === "failed" || phase === "aborted") {
      return (
        <article className={`log-row ${phase === "completed" ? "ok" : "bad"}`}>
          <header>
            <span className="log-kind">{phase}</span>
            <time>{fmtTime(e.ts)}</time>
          </header>
          {p.error ? <p>{String(p.error)}</p> : <p>Video artifact is ready.</p>}
        </article>
      );
    }
    if (phase === "slot_acquired" || phase === "slot_released" || phase === "kane_log") return null;
    return (
      <article className="log-row active">
        <header>
          <span className="log-kind">Step</span>
          <span className="log-phase">{phase.replace(/_/g, " ")}</span>
          <time>{fmtTime(e.ts)}</time>
        </header>
      </article>
    );
  }
  if (e.kind === "heal") {
    return (
      <article className="log-row active">
        <header>
          <span className="log-kind">Heal</span>
          <time>{fmtTime(e.ts)}</time>
        </header>
        <p>
          {String(p.before ?? "").slice(0, 140)}
          <br />→ {String(p.after ?? "").slice(0, 140)}
        </p>
      </article>
    );
  }
  return null;
}

export function LiveTelemetry({ events }: { events: Ev[] }) {
  const log = events.filter(showEvent);
  return (
    <div className="console">
      {log.length ? (
        log.map((e) => <ConsoleRow key={e.seq} e={e} />)
      ) : (
        <p style={{ color: "#9a9aa2", margin: 0 }}>Waiting for the first Kane event…</p>
      )}
    </div>
  );
}
