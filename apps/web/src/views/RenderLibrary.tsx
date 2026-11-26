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
      <section className="cobalt-hero-band">
        <div className="hero-band-inner">
          <div className="gallery-head">
            <div>
              <span className="sticker-pill sticker-pill--lime">
                <span className="status-led" aria-hidden />
                VAULT_INDEX · LIBRARY
              </span>
              <h1 className="gallery-title gallery-title--white">Render Library</h1>
              <p className="hero-sub-white">
                Automated multi-ratio storefront shorts &amp; widescreen launch films captured by Kane CLI.
              </p>
            </div>

            <div className="pop-stat-cluster">
              <div className="pop-stat-card">
                <span className="field-caption">Total renders</span>
                <strong>{String(jobs.length).padStart(2, "0")}</strong>
              </div>
              <div className="pop-stat-card">
                <span className="field-caption">Active queue</span>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  {activeCount > 0 ? <span className="coral-dot" aria-hidden /> : null}
                  {String(activeCount).padStart(2, "0")}
                </strong>
              </div>
              <Link to="/" className="btn-coral-pill" style={{ borderRadius: "999px", padding: "0.75rem 1.35rem" }}>
                <Plus className="h-4" />
                New Short
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="clapper-stripe" aria-hidden />

      <div className="page-inner">
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
              const ratio = j.input.aspect_ratio ?? (isWebsite ? "16:9" : "9:16");
              const meta = isWebsite
                ? `Website · ${j.input.ad_style ?? "director"} · ${ratio}`
                : isShort
                  ? `Short · ${j.input.ad_style ?? "director"} · ${ratio}`
                  : "Walkthrough · Kane";
              const isActive = j.status === "running" || j.status === "queued";
              const isFailed = j.status === "failed" || j.status === "aborted";

              return (
                <Link className="asset-tile" key={j.id} to={`/jobs/${j.id}`}>
                  <div className="clapper-stripe clapper-stripe--tile" aria-hidden />
                  <div className="filmstrip-frame">
                    <span className={`ratio-sticker ${ratio === "16:9" ? "ratio-sticker--wide" : ""}`}>
                      {ratio === "16:9" ? "16:9 WIDE" : `${ratio} VERTICAL`}
                    </span>

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

                    {j.status === "completed" ? <span className="filmstrip-badge">00:15</span> : null}
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
            <svg width="88" height="88" viewBox="0 0 100 100" fill="none" aria-hidden>
              <circle cx="50" cy="50" r="44" stroke="#0A0F2C" strokeWidth="2.5" />
              <circle cx="50" cy="50" r="30" stroke="#0A0F2C" strokeDasharray="3 3" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#0A0F2C" strokeWidth="1.5" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#0A0F2C" strokeWidth="1.5" />
              <rect x="34" y="34" width="32" height="32" rx="6" fill="#D8FF3E" stroke="#0A0F2C" strokeWidth="2.5" />
              <text x="50" y="55" textAnchor="middle" fill="#0A0F2C" fontFamily="var(--font-mono)" fontWeight="700" fontSize="14">
                00
              </text>
            </svg>
            <h2 className="panel-heading">{jobs.length ? "No matching renders" : "No shorts yet"}</h2>
            <p className="field-hint">
              {jobs.length
                ? "Try clearing the search query or switching status filter."
                : "Paste a store product or website URL in Short Studio to create your first video."}
            </p>
            <Link to="/" className="btn-coral-pill">
              <Plus className="h-4" />
              Create a short
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
