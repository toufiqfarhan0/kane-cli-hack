import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, Terminal } from "lucide-react";

type FlowDelta = {
  key: string;
  baseline: string | null;
  candidate: string | null;
  verdict: string;
};

type VerifiedFlow = {
  flow: string;
  status: string;
  reason: string | null;
  failedStep: string | null;
  deltas: FlowDelta[];
  infraError: string | null;
  shareUrl: string | null;
};

type VerifyReport = {
  verdict: "passed" | "blocked" | "error";
  changeRequest: string;
  agent: string;
  attempt: number;
  maxAttempts: number;
  startedAt: string;
  finishedAt: string;
  changedFiles: string[];
  affectedFlows: string[];
  unexpectedCount: number;
  flows: VerifiedFlow[];
  timeline: { at: string; label: string; kind: string }[];
};

type Payload = {
  live: VerifyReport | null;
  blocked: VerifyReport | null;
  verified: VerifyReport | null;
  baseline: { commit?: string; createdAt?: string; flows?: Record<string, unknown> } | null;
  source: "live" | "snapshot";
};

function verdictLabel(verdict: string): string {
  if (verdict === "passed") return "SAFE TO SHIP";
  if (verdict === "blocked") return "BLOCKED";
  return "COULD NOT VERIFY";
}

function ReportCard({ title, report }: { title: string; report: VerifyReport }) {
  const isPass = report.verdict === "passed";
  return (
    <article className={`verified-card ${report.verdict}`}>
      <header className="verified-card-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            {isPass ? (
              <CheckCircle2 className="h-5" style={{ color: "var(--green-deep)" }} />
            ) : (
              <ShieldAlert className="h-5" style={{ color: "var(--red)" }} />
            )}
            <h2 style={{ fontSize: "20px" }}>{title}</h2>
          </div>
          <p className="field-hint" style={{ marginTop: "0.2rem" }}>
            “{report.changeRequest}”
          </p>
        </div>
        <span className={`stamp-badge ${report.verdict}`}>{verdictLabel(report.verdict)}</span>
      </header>

      <div className="summary-grid" style={{ borderTop: 0, paddingTop: 0 }}>
        <div className="summary-cell">
          <span>Agent</span>
          <strong>{report.agent}</strong>
        </div>
        <div className="summary-cell">
          <span>Attempt</span>
          <strong>
            {report.attempt} / {report.maxAttempts}
          </strong>
        </div>
        <div className="summary-cell">
          <span>Affected flows</span>
          <strong>{report.affectedFlows.join(", ") || "none"}</strong>
        </div>
        <div className="summary-cell">
          <span>Unexpected diffs</span>
          <strong>{report.unexpectedCount}</strong>
        </div>
      </div>

      {report.changedFiles.length > 0 ? (
        <div className="launch-mono-box">Changed: {report.changedFiles.join(", ")}</div>
      ) : null}

      <ul className="verified-flows">
        {report.flows.map((flow) => (
          <li key={flow.flow} className="verified-flow-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{flow.flow}</strong>
              <span className={`status-chip ${flow.status === "passed" ? "completed" : "failed"}`}>
                {flow.status}
              </span>
            </div>
            {flow.failedStep ? <span>Step: {flow.failedStep}</span> : null}
            {flow.reason ? <span style={{ color: "var(--ink-body)" }}>{flow.reason}</span> : null}
            {flow.deltas.map((delta) => (
              <div
                key={delta.key}
                style={{
                  padding: "0.35rem 0.5rem",
                  borderRadius: "6px",
                  background: "var(--console-bg)",
                  color: "#e4e1e6",
                  fontSize: "11px",
                }}
              >
                {delta.key}: {delta.baseline ?? "∅"} → {delta.candidate ?? "∅"} ({delta.verdict})
              </div>
            ))}
          </li>
        ))}
      </ul>
    </article>
  );
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json") && !ct.includes("+json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function Verified() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const json = await fetchJsonSafe<Payload>("/v1/verified");
      if (json && (json.live || json.blocked || json.verified)) {
        if (!cancelled) setData(json);
        return;
      }
      const [blocked, verified] = await Promise.all([
        fetchJsonSafe<VerifyReport>("/qa/blocked-run.json"),
        fetchJsonSafe<VerifyReport>("/qa/verified-run.json"),
      ]);
      if (!cancelled) {
        setData({
          live: json?.live ?? null,
          blocked: blocked ?? json?.blocked ?? null,
          verified: verified ?? json?.verified ?? null,
          baseline: json?.baseline ?? null,
          source: "snapshot",
        });
      }
    }
    void load().catch((caught) => {
      if (!cancelled) setErr(String(caught));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = data?.live ?? data?.verified ?? data?.blocked ?? null;

  return (
    <div className="page-verified">
      <section className="cobalt-hero-band">
        <div className="hero-band-inner">
          <div className="verified-hero">
            <div>
              <span className="sticker-pill sticker-pill--lime">
                <span className="status-led" aria-hidden />
                QA Guardrails / qa-gate
              </span>
              <h1 className="verified-title verified-title--white">
                Kane verified<span>.</span>
              </h1>
              <p className="hero-sub-white">
                Diff-to-TestMD regression verification. <code>qa-gate</code> runs real Chromium checks via Kane CLI before any release or deploy ships.
              </p>
            </div>
            <div className="terminal-chip">
              <Terminal className="h-4" style={{ color: "var(--lime)" }} />
              <span>npm run verify -- --all</span>
            </div>
          </div>
        </div>
      </section>
      <div className="clapper-stripe" aria-hidden />

      <div className="page-inner">
        {err ? <p className="error-banner">{err}</p> : null}
        {!data && !err ? <p className="verified-lead">Loading the last Kane report…</p> : null}

        {featured ? (
          <div className="verdict-banner">
            <div className="clapper-stripe clapper-stripe--tile" aria-hidden />
            <div className="verdict-banner-body">
              <div className="verdict-banner-left">
                <span className={`stamp-badge ${featured.verdict}`}>{verdictLabel(featured.verdict)}</span>
                <div>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "18px", display: "block" }}>
                    {featured.flows.length} flows checked · {featured.unexpectedCount} unexpected deltas
                  </strong>
                  <span className="field-hint">{featured.changeRequest}</span>
                </div>
              </div>
              <span className="mono-kicker">
                {data?.source === "live" ? "Live last-verify.json" : "Verified snapshot"}
                {data?.baseline?.commit ? ` · baseline ${data.baseline.commit}` : ""}
              </span>
            </div>
          </div>
        ) : data && !err ? (
          <div className="verdict-banner">
            <div className="verdict-banner-body">
              <div className="verdict-banner-left">
                <span className="stamp-badge">AWAITING RUN</span>
                <div>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "18px", display: "block" }}>
                    No verification run captured yet
                  </strong>
                  <span className="field-hint">Run npm run verify -- --all to check all PostReady flows in Chromium.</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="verified-grid">
          {data?.live ? <ReportCard title="Live verification run" report={data.live} /> : null}
          {data?.blocked ? <ReportCard title="Kane blocked regression" report={data.blocked} /> : null}
          {data?.verified ? <ReportCard title="Kane verified green" report={data.verified} /> : null}
        </div>

        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "22px" }}>How the verification loop works</h2>
            <span className="sticker-pill sticker-pill--lime" style={{ transform: "none" }}>
              4-STEP PIPELINE
            </span>
          </div>
          <div className="loop-grid">
            <article className="loop-step-card">
              <span className="mono-kicker">01</span>
              <strong>Diff-to-TestMD</strong>
              <p>Maps UI code edits to affected routes and selects committed TestMD assertions.</p>
            </article>
            <article className="loop-step-card">
              <span className="mono-kicker">02</span>
              <strong>Headless Chromium</strong>
              <p>Kane CLI exercises real clicks, form steps, validation errors, and gallery tiles.</p>
            </article>
            <article className="loop-step-card">
              <span className="mono-kicker">03</span>
              <strong>Observable Compare</strong>
              <p>Checks extracted page state and console/API health against the verified baseline.</p>
            </article>
            <article className="loop-step-card loop-step-card--highlight">
              <span className="mono-kicker">04</span>
              <strong>Stamp Verdict</strong>
              <p>Marks the build SAFE TO SHIP or locks release with BLOCKED when an assertion shifts.</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
