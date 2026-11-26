import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Captions, Clapperboard, Code2, FileText, Quote, SlidersHorizontal, Square } from "lucide-react";
import { ArtifactCard, StageChecklist, isProductShortJob, isWebsiteShortJob } from "../widgets/StageChecklist";
import { LiveTelemetry } from "../widgets/LiveTelemetry";
import type { Ev, Job } from "../models";

const TERMINAL = new Set(["completed", "failed", "aborted", "cancelled"]);

export default function JobPage() {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    fetch(`/v1/jobs/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancel) setJob(j);
      });
    fetch(`/v1/jobs/${id}/events`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancel && d.events) setEvents(d.events);
      });

    const es = new EventSource(`/v1/jobs/${id}/events`);
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as Ev;
      setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
      fetch(`/v1/jobs/${id}`)
        .then((r) => r.json())
        .then(setJob)
        .catch(() => {});
    };
    return () => {
      cancel = true;
      es.close();
    };
  }, [id]);

  async function cancel() {
    if (!id) return;
    setCancelling(true);
    await fetch(`/v1/jobs/${id}/cancel`, { method: "POST" }).catch(() => {});
    setCancelling(false);
  }

  if (!job) {
    return (
      <div className="page-job page-inner">
        <p className="pipeline-name">Loading run…</p>
      </div>
    );
  }

  const live = !TERMINAL.has(job.status);
  const isWebsite = isWebsiteShortJob(job);
  const isShort = isProductShortJob(job);
  const productEvent = [...events]
    .reverse()
    .find((e) => e.kind === "phase" && e.payload?.phase === "product_map")?.payload;
  const planEvent = [...events]
    .reverse()
    .find((e) => e.kind === "phase" && e.payload?.phase === "plan")?.payload;
  const extracted = (productEvent?.product ?? null) as {
    brand?: string;
    title?: string;
    price?: string | null;
    domain?: string;
  } | null;
  const hasComposition = job.artifacts.some((a) => a.type === "composition");
  const expectedAspect = isWebsite
    ? job.input.aspect_ratio ?? "16:9"
    : isShort
      ? job.input.aspect_ratio ?? "9:16"
      : "16:9";

  return (
    <div className="page-job page-inner">
      <div className="job-toolbar">
        <div className="job-toolbar-left">
          <Link to="/jobs" className="btn-ghost-pill">
            <ArrowLeft className="h-4" />
            Back to Render Library
          </Link>
          <span className="job-id-pill">JOB / {job.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="job-toolbar-right">
          {live ? (
            <button
              type="button"
              className="btn-ghost-pill"
              style={{ borderColor: "var(--red)", color: "var(--red)" }}
              onClick={() => void cancel()}
              disabled={cancelling}
            >
              <Square className="h-4" />
              {cancelling ? "Stopping…" : "Stop"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="inspector-grid">
        <div className="inspector-col">
          <StageChecklist
            job={job}
            title={
              extracted?.title ||
              job.input.product_name ||
              (isWebsite ? "Launch Video" : isShort ? "PostReady Short" : "Kane Walkthrough")
            }
          />

          {extracted || planEvent?.concept ? (
            <section className="lab-card">
              <div className="artifact-head">
                <span className="mono-kicker">Product &amp; Direction</span>
                <SlidersHorizontal className="h-4" />
              </div>
              <div className="summary-grid">
                {extracted?.brand ? (
                  <div className="summary-cell">
                    <span>Brand</span>
                    <strong>{extracted.brand}</strong>
                  </div>
                ) : null}
                {extracted?.price ? (
                  <div className="summary-cell">
                    <span>Price</span>
                    <strong>{extracted.price}</strong>
                  </div>
                ) : extracted?.domain ? (
                  <div className="summary-cell">
                    <span>Domain</span>
                    <strong>{extracted.domain}</strong>
                  </div>
                ) : null}
                {planEvent?.theme ? (
                  <div className="summary-cell">
                    <span>Theme</span>
                    <strong>{String(planEvent.theme)}</strong>
                  </div>
                ) : null}
                <div className="summary-cell">
                  <span>Style</span>
                  <strong>{job.input.ad_style ?? (isShort ? "director" : "walkthrough")}</strong>
                </div>
              </div>
              {planEvent?.concept ? (
                <p style={{ margin: 0, fontStyle: "italic", color: "var(--ink-body)", fontSize: "14px" }}>
                  “{String(planEvent.concept)}”
                </p>
              ) : null}
            </section>
          ) : null}

          {job.input.script ? (
            <section className="lab-card lab-card--brief">
              <div className="mono-kicker" style={{ color: "var(--coral-ink)" }}>
                <Quote className="h-4" />
                <span>{isShort ? "Creative brief" : "Brief"}</span>
              </div>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--ink)" }}>{job.input.script}</p>
            </section>
          ) : null}
        </div>

        <div className="inspector-col">
          {job.status === "completed" ? (
            <ArtifactCard
              jobId={job.id}
              title="Render Preview"
              kind="video"
              href={`/v1/jobs/${job.id}/artifacts/video`}
              aspectRatio={expectedAspect}
            />
          ) : (
            <section className="lab-card lab-card--featured">
              <div className="artifact-head">
                <div className="artifact-title-row">
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "17px" }}>Render Preview</strong>
                  <span className="artifact-pill">{expectedAspect}</span>
                </div>
                <span className={`status-chip ${job.status}`}>{job.status}</span>
              </div>
              <div className="artifact-stage" style={{ color: "#e4e1e6", flexDirection: "column", gap: "0.65rem" }}>
                <Clapperboard className="h-5" />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  {live ? `Executing ${job.step || "pipeline"} — video will appear here when ready…` : "No video artifact produced."}
                </span>
              </div>
            </section>
          )}

          <section className="console-panel">
            <header className="console-bar">
              <div className="console-title-group">
                <span className="console-dots" aria-hidden>
                  <i style={{ background: "#ff5f56" }} />
                  <i style={{ background: "#ffbd2e" }} />
                  <i style={{ background: "#27c93f" }} />
                </span>
                <span className="mono-kicker" style={{ color: "#ffffff" }}>
                  KANE CLI · LIVE RUN
                </span>
              </div>
              <div className="console-actions">
                {hasComposition ? (
                  <a
                    className="console-icon-btn"
                    href={`/v1/jobs/${job.id}/artifacts/composition`}
                    target="_blank"
                    rel="noreferrer"
                    title="HTML composition"
                  >
                    <Code2 className="h-4" />
                  </a>
                ) : null}
                <a className="console-icon-btn" href={`/v1/jobs/${job.id}/artifacts/kane-log`} title="Action log">
                  <FileText className="h-4" />
                </a>
                <a className="console-icon-btn" href={`/v1/jobs/${job.id}/artifacts/captions`} title="Captions">
                  <Captions className="h-4" />
                </a>
              </div>
            </header>
            <LiveTelemetry events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
