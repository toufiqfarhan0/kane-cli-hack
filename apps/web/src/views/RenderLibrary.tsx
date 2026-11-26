import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Clapperboard,
  Film,
  Loader2,
  Plus,
  Radio,
  RotateCcw,
  Search,
} from "lucide-react";
import { isProductShortJob, isWebsiteShortJob } from "../widgets/StageChecklist";
import type { Job } from "../models";

type StatusFilter = "all" | "completed" | "running" | "failed" | "aborted";

function relativeAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export default function Gallery() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/v1/jobs?limit=100")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []))
      .catch(() => setJobs([]));
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((j) => j.status === "running" || j.status === "queued").length,
    [jobs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const normalized = j.status === "queued" ? "running" : j.status;
      if (filter !== "all" && normalized !== filter) return false;
      if (!q) return true;
      const hay = [
        j.input.product_name ?? "",
        j.input.website_url ?? "",
        j.input.ad_style ?? "",
        j.input.job_type ?? "",
        j.input.aspect_ratio ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, filter, query]);

  const counts: Record<StatusFilter, number> = useMemo(
    () => ({
      all: jobs.length,
      completed: jobs.filter((j) => j.status === "completed").length,
      running: jobs.filter((j) => j.status === "running" || j.status === "queued").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      aborted: jobs.filter((j) => j.status === "aborted" || j.status === "cancelled").length,
    }),
    [jobs],
  );

  return (
    <div className="page-gallery">
      <div className="gallery-head">
        <div>
          <p className="mono-kicker">
            <span className="coral-dot" aria-hidden />
            Library
          </p>
          <h1 className="gallery-title">Render Library</h1>
        </div>

        <div className="metrics-strip">
          <div className="metric-cell">
            <span className="field-caption">Total renders</span>
            <strong>{String(jobs.length).padStart(2, "0")}</strong>
          </div>
          <span className="metric-divider" aria-hidden />
          <div className="metric-cell">
            <span className="field-caption">Active queue</span>
            <strong style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              {activeCount > 0 ? <span className="coral-dot" aria-hidden /> : null}
              {String(activeCount).padStart(2, "0")}
            </strong>
          </div>
          <span className="metric-divider" aria-hidden />
          <Link to="/" className="btn-ink-pill" style={{ borderRadius: "10px", padding: "0.55rem 1rem" }}>
            <Plus className="h-4" />
            New Short
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-pills" role="tablist" aria-label="Filter renders">
          {(["all", "completed", "running", "failed", "aborted"] as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`filter-pill ${filter === key ? "on" : ""}`}
              onClick={() => setFilter(key)}
            >
              {key === "all" ? `All (${counts.all})` : `${key} (${counts[key]})`}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <Search className="h-4 search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, URL, or style..."
            aria-label="Search renders"
          />
        </div>
      </div>

      {filtered.length ? (
        <div className="assets-grid">
          {filtered.map((j) => {
            const isWebsite = isWebsiteShortJob(j);
            const isShort = isProductShortJob(j);
            const meta = isWebsite
              ? `Website · ${j.input.ad_style ?? "director"} · ${j.input.aspect_ratio ?? "16:9"}`
              : isShort
                ? `Short · ${j.input.ad_style ?? "director"} · ${j.input.aspect_ratio ?? "9:16"}`
                : "Walkthrough · Kane";
            const isActive = j.status === "running" || j.status === "queued";
            const isFailed = j.status === "failed" || j.status === "aborted";

            return (
              <Link className="asset-tile" key={j.id} to={`/jobs/${j.id}`}>
                <div className="filmstrip-frame">
                  <div className="sprockets-left" aria-hidden>
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} />
                    ))}
                  </div>
                  <div className="sprockets-right" aria-hidden>
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} />
                    ))}
                  </div>

                  {j.status === "completed" ? (
                    <video src={`/v1/jobs/${j.id}/artifacts/video`} muted playsInline preload="metadata" />
                  ) : isActive ? (
                    <div className="media-placeholder">
                      <Loader2 className="h-5" />
                      <span>{j.step || j.status}</span>
                    </div>
                  ) : isFailed ? (
                    <div className="media-placeholder">
                      <AlertCircle className="h-5" />
                      <span>{j.abort_code || j.status}</span>
                    </div>
                  ) : (
                    <div className="media-placeholder">
                      <Clapperboard className="h-5" />
                      <span>{j.status}</span>
                    </div>
                  )}

                  {j.status === "completed" && isShort ? (
                    <span className="filmstrip-badge">00:15</span>
                  ) : null}
                </div>

                <div className="tile-body">
                  <div className="tile-top">
                    <h2 className="tile-title">{j.input.product_name || j.input.website_url}</h2>
                    <span className={`status-chip ${j.status}`}>
                      {isActive ? <span className="coral-dot" aria-hidden /> : null}
                      {j.status}
                    </span>
                  </div>
                  <span className="tile-meta">{meta}</span>
                  <span className="tile-url">{j.input.website_url}</span>
                </div>

                <div className="tile-foot">
                  <span>{relativeAgo(j.created_at)}</span>
                  {isActive ? (
                    <Radio className="h-4" />
                  ) : j.status === "failed" ? (
                    <RotateCcw className="h-4" />
                  ) : j.status === "aborted" ? (
                    <Ban className="h-4" />
                  ) : (
                    <ArrowRight className="h-4" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-sheet">
          <Film className="h-5" />
          <h2 className="panel-heading">{jobs.length ? "No matching renders" : "No shorts yet"}</h2>
          <p className="field-hint">
            {jobs.length
              ? "Try clearing the search query or switching status filter."
              : "Paste a store product or website URL in Short Studio to create your first video."}
          </p>
          <Link to="/" className="btn-ink-pill">
            <Plus className="h-4" />
            Create a short
          </Link>
        </div>
      )}
    </div>
  );
}
