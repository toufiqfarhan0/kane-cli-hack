import { AlertTriangle, Check, Download } from "lucide-react";
import type { Job, PipelineStep } from "../models";

type StepState = "pending" | "active" | "done" | "failed";

const SHORT_STEPS: PipelineStep[] = [
  { key: "health", label: "Browser slot", detail: "Open a clean browser session for this run." },
  { key: "preflight", label: "Page check", detail: "Load the URL and verify it is open and reachable." },
  { key: "understand", label: "Kane capture", detail: "Dismiss popups, follow steps, and grab live visuals." },
  { key: "plan", label: "AI storyboard", detail: "Write scenes, captions, and voice script from captures." },
  { key: "tts", label: "Voice & music", detail: "Generate natural voiceover paired with stereo music." },
  { key: "render", label: "Video render", detail: "Animate scenes into crisp launch-ready video." },
  { key: "upload", label: "Save & ship", detail: "Finalize size, subtitles, and save your MP4." },
];

const WEBSITE_STEPS: PipelineStep[] = [
  { key: "health", label: "Browser slot", detail: "Open a clean browser session for this run." },
  { key: "preflight", label: "Page check", detail: "Load the site and check for walls or blockers." },
  { key: "understand", label: "Live capture", detail: "Run your steps on the site and capture screen views." },
  { key: "plan", label: "Launch script", detail: "Turn captured screens and brief into a crisp story." },
  { key: "tts", label: "Voice & music", detail: "Generate natural voiceover paired with stereo music." },
  { key: "render", label: "Video render", detail: "Animate widescreen browser screens cleanly into video." },
  { key: "upload", label: "Save & ship", detail: "Export finished launch video and subtitles." },
];

const WALK_STEPS: PipelineStep[] = [
  { key: "health", label: "Browser slot", detail: "Open a clean browser for this run." },
  { key: "preflight", label: "Page check", detail: "Open the URL and check for walls or blockers." },
  { key: "understand", label: "Read page", detail: "Read live labels, fields, and buttons." },
  { key: "plan", label: "Plan steps", detail: "Turn the brief into one action per beat." },
  { key: "tts", label: "Voiceover", detail: "Synthesize narration to each step length." },
  { key: "author", label: "Record flow", detail: "Kane clicks and types in one shared session." },
  { key: "upload", label: "Finish", detail: "Mix video with voice and save the MP4." },
];

export function isProductShortJob(job: Pick<Job, "input">): boolean {
  if (job.input.job_type) {
    return job.input.job_type === "product_short" || job.input.job_type === "website_short";
  }
  return !(job.input.walkthrough?.length || job.input.script?.trim());
}

export function isWebsiteShortJob(job: Pick<Job, "input">): boolean {
  return job.input.job_type === "website_short";
}

export function stepIndexForJob(steps: PipelineStep[], job: Pick<Job, "status" | "step">): number {
  if (job.status === "completed") return steps.length;
  if (!job.step) return 0;
  const i = steps.findIndex((s) => s.key === job.step);
  if (i >= 0) return i;
  if (job.step === "generate") return Math.max(0, steps.findIndex((s) => s.key === "plan"));
  return 0;
}

function StepRow({
  step,
  index,
  state,
}: {
  step: PipelineStep;
  index: number;
  state: StepState;
}) {
  const statusText =
    state === "pending" ? "Pending" : state === "active" ? "Active" : state === "failed" ? "Failed" : "Done";
  return (
    <li className={`pipeline-step pipeline-step--${state}`}>
      <div className="pipeline-step-main">
        <span className="pipeline-step-num">{String(index + 1).padStart(2, "0")}</span>
        <span className="pipeline-step-badge" aria-hidden>
          {state === "done" ? (
            <Check className="h-4" strokeWidth={2.5} />
          ) : state === "failed" ? (
            <AlertTriangle className="h-4" strokeWidth={2.5} />
          ) : state === "active" ? (
            <span className="coral-dot" style={{ background: "#fff" }} />
          ) : null}
        </span>
        <div>
          <p className="pipeline-step-label">{step.label}</p>
          <p className="pipeline-step-detail">{step.detail}</p>
        </div>
      </div>
      <span className="pipeline-step-status">{statusText}</span>
    </li>
  );
}

export function StageChecklist({ job, title }: { job: Job; title?: string }) {
  const isWebsite = isWebsiteShortJob(job);
  const isShort = isProductShortJob(job);
  const steps = isWebsite ? WEBSITE_STEPS : isShort ? SHORT_STEPS : WALK_STEPS;
  const done = job.status === "completed";
  const failed = job.status === "failed" || job.status === "cancelled" || job.status === "aborted";
  const stepIndex = stepIndexForJob(steps, job);
  const statusLabel = done ? "Completed" : failed ? job.status : "In progress";

  return (
    <section className="lab-card">
      <header className="pipeline-head">
        <div>
          <p className="pipeline-name">{title ?? job.input.product_name ?? "PostReady run"}</p>
          <p className="pipeline-url">{job.input.website_url}</p>
        </div>
        <span className={`status-chip ${job.status}`}>
          {!done && !failed ? <span className="coral-dot" aria-hidden /> : null}
          {statusLabel}
        </span>
      </header>
      <ol className="pipeline-steps">
        {steps.map((s, i) => {
          let state: StepState = "pending";
          if (failed && i === stepIndex) state = "failed";
          else if (done || i < stepIndex) state = "done";
          else if (i === stepIndex) state = "active";
          return <StepRow key={s.key} step={s} index={i} state={state} />;
        })}
      </ol>
      {failed ? (
        <div className="error-banner">
          <AlertTriangle className="h-4" />
          <span>{job.error ?? `Short can't be generated${job.abort_code ? `: ${job.abort_code}` : ""}`}</span>
        </div>
      ) : null}
    </section>
  );
}

export function ArtifactCard({
  jobId,
  title,
  kind,
  href,
  aspectRatio,
}: {
  jobId: string;
  title: string;
  kind: "video" | "file";
  href: string;
  aspectRatio?: string;
}) {
  const cls =
    aspectRatio === "9:16"
      ? "artifact-media artifact-media--vertical"
      : "artifact-media";
  return (
    <section className="lab-card lab-card--featured">
      <div className="artifact-head">
        <div className="artifact-title-row">
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "17px" }}>{title}</strong>
          <span className="artifact-pill">{aspectRatio ?? "Ready"}</span>
        </div>
        <a
          href={href}
          className="btn-ink-pill"
          style={{ borderRadius: "10px", padding: "0.45rem 0.9rem" }}
          title="Download MP4"
        >
          <Download className="h-4" />
          Download MP4
        </a>
      </div>
      {kind === "video" ? (
        <div className="artifact-stage">
          <div className={cls}>
            <video src={`/v1/jobs/${jobId}/artifacts/video`} controls playsInline preload="metadata" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
