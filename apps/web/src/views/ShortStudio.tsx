import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Check,
  Clapperboard,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

type JobType = "product_short" | "website_short";
type AdStyle = "director" | "depth" | "reel" | "classic";
type AdTheme = "auto" | "pop" | "noir" | "editorial" | "neon";
type AspectRatio = "9:16" | "1:1" | "4:5" | "16:9";

const STORE_STEPS = [
  { key: "product", label: "Product" },
  { key: "brief", label: "Brief" },
  { key: "style", label: "Style" },
  { key: "launch", label: "Launch" },
] as const;

const WEBSITE_STEPS = [
  { key: "website", label: "Website" },
  { key: "brief", label: "Brief" },
  { key: "style", label: "Style" },
  { key: "launch", label: "Launch" },
] as const;

const STYLE_OPTIONS: Array<{ id: AdStyle; title: string; desc: string }> = [
  { id: "director", title: "Director AI", desc: "Dynamic cuts, AI storyboard timing & voiceover." },
  { id: "depth", title: "3D Showcase", desc: "Layered 3D motion cards with studio lighting." },
  { id: "reel", title: "Story Reel", desc: "Social progress bars with snappy narrative cuts." },
  { id: "classic", title: "Classic Cards", desc: "Clean editorial cards with spec callouts." },
];

const THEME_OPTIONS: Array<{ id: AdTheme; label: string; dot: string }> = [
  { id: "auto", label: "Auto", dot: "#dadad8" },
  { id: "pop", label: "Pop", dot: "#fe563a" },
  { id: "noir", label: "Noir", dot: "#1b1b1e" },
  { id: "editorial", label: "Editorial", dot: "#e5d7c3" },
  { id: "neon", label: "Neon", dot: "#12a150" },
];

const RATIO_OPTIONS: Array<{ id: AspectRatio; label: string; note: string }> = [
  { id: "9:16", label: "9:16", note: "Reels / Shorts" },
  { id: "4:5", label: "4:5", note: "Feed Post" },
  { id: "1:1", label: "1:1", note: "Square" },
  { id: "16:9", label: "16:9", note: "Widescreen" },
];

const DEFAULT_STORE_ACTIONS = [
  "Dismiss any popup modal or cookie banner on landing",
  "Capture the hero product photo, current price, and highlights",
  "Inspect the key specs and benefits on the page",
];

const DEFAULT_WEBSITE_ACTIONS = [
  "Dismiss any cookie banner and capture the hero screen",
  "Scroll down to show the key features and workflow",
  "Open Pricing to capture plans and options",
];

function styleIcon(id: AdStyle) {
  if (id === "director") return <Clapperboard className="h-5" strokeWidth={1.6} />;
  if (id === "depth") return <Box className="h-5" strokeWidth={1.6} />;
  if (id === "reel") return <BookOpen className="h-5" strokeWidth={1.6} />;
  return <Layers className="h-5" strokeWidth={1.6} />;
}

function composeScript(args: {
  isWebsite: boolean;
  goal: string;
  audience: string;
  outcome: string;
  actions: string[];
}): string {
  const actions = args.actions.map((a) => a.trim()).filter(Boolean);
  const steps = actions.map((a, i) => `Step ${i + 1}: ${a}`).join(". ");
  const parts = [
    args.goal.trim() &&
      (args.isWebsite
        ? `This launch video highlights how to ${args.goal.trim()}.`
        : `This short video pitches how to ${args.goal.trim().replace(/^this short is to\s+/i, "")}.`),
    args.audience.trim() && `Made for ${args.audience.trim()}.`,
    args.outcome.trim() && `Key message: ${args.outcome.trim()}.`,
    steps && `Capture steps — ${steps}`,
  ].filter(Boolean);
  return parts.join(" ");
}

export default function Home() {
  const nav = useNavigate();
  const [stage, setStage] = useState(0);
  const [job_type, setJobType] = useState<JobType>("product_short");

  const [storeUrl, setStoreUrl] = useState("https://drinkolipop.com/products/vintage-cola");
  const [storeName, setStoreName] = useState("OLIPOP Vintage Cola");
  const [siteUrl, setSiteUrl] = useState("https://cal.com");
  const [siteName, setSiteName] = useState("Cal.com");

  const [shortGoal, setShortGoal] = useState("enjoy classic cola flavor with real gut-friendly fiber");
  const [shortAudience, setShortAudience] = useState("soda drinkers on Reels & Shorts looking for a smarter swap");
  const [shortOutcome, setShortOutcome] = useState("9g plant fiber per can, real taste, ready to order");
  const [shortActions, setShortActions] = useState<string[]>(DEFAULT_STORE_ACTIONS);

  const [siteGoal, setSiteGoal] = useState("schedule meetings fast without endless email threads");
  const [siteAudience, setSiteAudience] = useState("founders, teams, and makers launching online tools");
  const [siteOutcome, setSiteOutcome] = useState("share one clean booking link and get booked in 30 seconds");
  const [siteActions, setSiteActions] = useState<string[]>(DEFAULT_WEBSITE_ACTIONS);

  const [ad_style, setAdStyle] = useState<AdStyle>("director");
  const [ad_theme, setAdTheme] = useState<AdTheme>("auto");
  const [aspect_ratio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [voiceover_enabled, setVoiceoverEnabled] = useState(true);

  const [attest, setAttest] = useState(true);
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isWebsite = job_type === "website_short";
  const STEPS = isWebsite ? WEBSITE_STEPS : STORE_STEPS;
  const website_url = isWebsite ? siteUrl : storeUrl;
  const setWebsiteUrl = isWebsite ? setSiteUrl : setStoreUrl;
  const product_name = isWebsite ? siteName : storeName;
  const setProductName = isWebsite ? setSiteName : setStoreName;

  const goal = isWebsite ? siteGoal : shortGoal;
  const audience = isWebsite ? siteAudience : shortAudience;
  const outcome = isWebsite ? siteOutcome : shortOutcome;
  const actions = isWebsite ? siteActions : shortActions;
  const setGoal = isWebsite ? setSiteGoal : setShortGoal;
  const setAudience = isWebsite ? setSiteAudience : setShortAudience;
  const setOutcome = isWebsite ? setSiteOutcome : setShortOutcome;
  const setActions = isWebsite ? setSiteActions : setShortActions;

  const filledActions = actions.map((a) => a.trim()).filter(Boolean);
  const script = composeScript({ isWebsite, goal, audience, outcome, actions });

  function setAction(i: number, value: string) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  }

  function switchMode(nextType: JobType) {
    setJobType(nextType);
    setAspectRatio(nextType === "website_short" ? "16:9" : "9:16");
    setErr(null);
    setStage(0);
  }

  function next() {
    setErr(null);
    if (stage === 0 && !website_url.trim()) {
      setErr(isWebsite ? "Please enter a website or app link." : "Please enter a product link.");
      return;
    }
    if (stage === 1) {
      if (!goal.trim()) {
        setErr("Tell Kane what this video is about.");
        return;
      }
      if (filledActions.length < 1) {
        setErr("Add at least one step for Kane to capture.");
        return;
      }
    }
    if (stage === 3 && !attest) {
      setErr("ERR_ATTESTATION_REQUIRED: Confirm URL recording rights before launching Kane CLI.");
      return;
    }
    if (stage < STEPS.length - 1) setStage(stage + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (stage !== STEPS.length - 1) {
      next();
      return;
    }
    if (!attest) {
      setErr("ERR_ATTESTATION_REQUIRED: Confirm URL recording rights before launching Kane CLI.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = {
        mode: "kane",
        input: {
          website_url,
          job_type,
          product_name: product_name.trim() || undefined,
          ad_style,
          ad_theme,
          aspect_ratio,
          voiceover_enabled,
          walkthrough: filledActions,
          script,
          i_have_right_to_record: attest,
          credentials: username || password ? { username, password } : undefined,
        },
      };

      const res = await fetch("/v1/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error ?? data));
      nav(`/jobs/${data.id}`);
    } catch (caught) {
      setErr(String(caught));
    } finally {
      setBusy(false);
    }
  }

  const chosenStyleLabel = STYLE_OPTIONS.find((s) => s.id === ad_style)?.title ?? ad_style;

  return (
    <div className="page-generate">
      <section className="cobalt-hero-band">
        <svg className="hero-target-watermark" viewBox="0 0 100 100" fill="none" aria-hidden>
          <circle cx="50" cy="50" r="46" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" />
          <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="18" stroke="currentColor" strokeDasharray="1 1.5" strokeWidth="1" />
          <line stroke="currentColor" strokeWidth="1" x1="50" x2="50" y1="0" y2="100" />
          <line stroke="currentColor" strokeWidth="1" x1="0" x2="100" y1="50" y2="50" />
          <text fill="currentColor" fontFamily="var(--font-mono)" fontSize="6" fontWeight="700" x="53" y="47">
            REC:15S
          </text>
        </svg>

        <div className="hero-band-inner">
          <div className="clapper-stripe clapper-stripe--hero" aria-hidden />

          <div className="pop-hero-split">
            <div className="pop-hero-left">
              <div className="pop-title-cluster">
                <h1 className="pixel-hero">PostReady</h1>
                <span className="sticker-pill sticker-pill--lime">
                  <span className="status-led" aria-hidden />
                  15S LAUNCH ENGINE
                </span>
              </div>

              <p className="hero-lead-pop">
                Paste a store product or website link. Kane opens the real page, captures live visuals, and creates a ready-to-post 15s launch video.
              </p>

              <div className="powered-pop-badge">
                <span className="powered-pop-label">Powered by</span>
                <img className="powered-testmu" src="/testmu-logo.svg" alt="TestMu AI" />
                <span className="powered-sep" aria-hidden>
                  ·
                </span>
                <span className="powered-kane">
                  <img src="/kane-cli.svg" alt="" />
                  Kane CLI
                </span>
              </div>
            </div>

            <div className="pop-hero-right">
              <form
                className="wizard-card"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="clapper-stripe clapper-stripe--card" aria-hidden />
                <ol className="wizard-rail" aria-label="Form steps">
                  {STEPS.map((s, i) => {
                    const done = i < stage;
                    const on = i === stage;
                    return (
                      <li key={s.key} className={`wizard-rail-item ${on ? "on" : done ? "done" : ""}`}>
                        <button type="button" className="wizard-rail-btn" onClick={() => i <= stage && setStage(i)}>
                          <span className="wizard-rail-num">
                            {done ? <Check className="h-4" strokeWidth={2.5} /> : String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{s.label}</span>
                        </button>
                        {i < STEPS.length - 1 ? <span className="wizard-rail-line" aria-hidden /> : null}
                      </li>
                    );
                  })}
                </ol>

        {stage === 0 && (
          <div className="wizard-body">
            <div className="field-label">
              <span className="field-caption">Format mode</span>
              <div className="mode-tabs" role="tablist" aria-label="Video type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isWebsite}
                  className={`mode-tab ${!isWebsite ? "on" : ""}`}
                  onClick={() => switchMode("product_short")}
                >
                  Store Product
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isWebsite}
                  className={`mode-tab ${isWebsite ? "on" : ""}`}
                  onClick={() => switchMode("website_short")}
                >
                  Website &amp; App
                </button>
              </div>
            </div>

            <h2 className="panel-heading">
              {isWebsite ? "Paste your website or app URL" : "Paste any storefront product URL"}
            </h2>

            <label className="field-label">
              <span className="field-caption">{isWebsite ? "Website URL" : "Product URL"}</span>
              <input
                type="url"
                value={website_url}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                required
                placeholder={isWebsite ? "https://yourapp.com" : "https://store.com/products/..."}
              />
            </label>

            <label className="field-label">
              <span className="field-caption">{isWebsite ? "Brand or app name" : "Product name"}</span>
              <input
                type="text"
                value={product_name}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Shown on your launch video"
              />
            </label>
          </div>
        )}

        {stage === 1 && (
          <div className="wizard-body">
            <p className="mono-kicker">
              <span className="coral-sq" aria-hidden />
              Brief
            </p>
            <h2 className="panel-heading">
              {isWebsite ? "What should this launch video show?" : "What should this product video show?"}
            </h2>

            <label className="field-label">
              <span className="field-caption">What is this video about?</span>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
                placeholder={isWebsite ? "main problem solved or workflow" : "main hook and standout benefit"}
              />
            </label>

            <label className="field-label">
              <span className="field-caption">Who is watching?</span>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={isWebsite ? "founders, teams, or buyers" : "shoppers scrolling Reels & Shorts"}
              />
            </label>

            <label className="field-label">
              <span className="field-caption">Main result to highlight</span>
              <input
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="key takeaway before the final call to action"
              />
            </label>

            <div className="field-label">
              <span className="field-caption">Steps for Kane to capture</span>
              <p className="field-hint">
                {isWebsite
                  ? "One action per row (scroll, click Pricing, open tab). Kane captures live screenshots of each step."
                  : "One shopper step per row (dismiss popup, pick flavor, check price). Kane grabs real visuals before building."}
              </p>
              <ol className="action-list">
                {actions.map((action, i) => (
                  <li key={i} className="action-row">
                    <span className="action-num">{String(i + 1).padStart(2, "0")}</span>
                    <input
                      type="text"
                      value={action}
                      onChange={(e) => setAction(i, e.target.value)}
                      placeholder={
                        isWebsite
                          ? "Scroll down or open Pricing tab"
                          : "Click a size or flavor option"
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove step ${i + 1}`}
                      disabled={actions.length <= 1}
                      onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4" />
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn-ghost-pill add-action"
                disabled={actions.length >= 12}
                onClick={() => setActions((prev) => [...prev, ""])}
              >
                <Plus className="h-4" />
                Add step
              </button>
            </div>
          </div>
        )}

        {stage === 2 && (
          <div className="wizard-body">
            <p className="mono-kicker">
              <span className="coral-sq" aria-hidden />
              Style &amp; Framing
            </p>
            <h2 className="panel-heading">Choose format, look, and voice</h2>

            <div className="field-label">
              <span className="field-caption">Ad style</span>
              <div className="style-grid">
                {STYLE_OPTIONS.map((opt) => {
                  const selected = ad_style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`style-option ${selected ? "on" : ""}`}
                      onClick={() => setAdStyle(opt.id)}
                    >
                      {selected ? (
                        <span className="style-check" aria-hidden>
                          <Check className="h-4" strokeWidth={2.5} />
                        </span>
                      ) : null}
                      <span className="style-icon-box" aria-hidden>
                        {styleIcon(opt.id)}
                      </span>
                      <div className="style-option-copy">
                        <strong>{opt.title}</strong>
                        <span>{opt.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-label">
              <span className="field-caption">Visual theme</span>
              <div className="pill-row">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`pill-btn ${ad_theme === t.id ? "on" : ""}`}
                    onClick={() => setAdTheme(t.id)}
                  >
                    <span className="theme-dot" style={{ background: t.dot }} aria-hidden />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-label">
              <span className="field-caption">Video size</span>
              <div className="pill-row">
                {RATIO_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`pill-btn ${aspect_ratio === r.id ? "on" : ""}`}
                    onClick={() => setAspectRatio(r.id)}
                  >
                    {r.label} · {r.note}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={`choice-row ${voiceover_enabled ? "on" : ""}`}
              onClick={() => setVoiceoverEnabled(!voiceover_enabled)}
            >
              <span className="choice-box" aria-hidden>
                {voiceover_enabled ? <Check className="h-4" strokeWidth={2.5} /> : null}
              </span>
              <span>AI voiceover + auto-ducked background music</span>
            </button>

            <div className="two-col">
              <label className="field-label">
                <span className="field-caption">
                  {isWebsite ? "Site username (optional)" : "Store username (optional)"}
                </span>
                <input type="text" value={username} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
              </label>
              <label className="field-label">
                <span className="field-caption">Password (optional)</span>
                <input type="password" value={password} onChange={(e) => setPass(e.target.value)} />
              </label>
            </div>
            <p className="field-hint">Leave blank for public links. Credentials are never written to job logs.</p>
          </div>
        )}

        {stage === 3 && (
          <div className="wizard-body">
            <p className="mono-kicker">
              <span className="coral-sq" aria-hidden />
              Launch &amp; Attestation
            </p>
            <h2 className="panel-heading">Ready to create {product_name.trim() || "your video"}</h2>

            <div className="launch-mono-box">
              {`${isWebsite ? "Website & App" : "Store Product"} · ${chosenStyleLabel} · ${ad_theme} · ${aspect_ratio} · ${filledActions.length} steps · ${
                voiceover_enabled ? "Voice + Music" : "Music only"
              } · ${website_url}`}
            </div>

            {script ? <blockquote className="launch-brief-quote">{script}</blockquote> : null}

            <button
              type="button"
              className={`choice-row ${attest ? "on" : ""}`}
              onClick={() => setAttest(!attest)}
            >
              <span className="choice-box" aria-hidden>
                {attest ? <Check className="h-4" strokeWidth={2.5} /> : null}
              </span>
              <span>I have the right to record this URL</span>
            </button>
          </div>
        )}

        {err ? (
          <div style={{ padding: "0 2rem 1.25rem" }}>
            <p className="error-banner">
              <AlertCircle className="h-4" />
              <span>{err}</span>
            </p>
          </div>
        ) : null}

        <div className="ticket-divider" aria-hidden>
          <span className="ticket-notch ticket-notch--left" />
          <span className="ticket-rule" />
          <span className="ticket-notch ticket-notch--right" />
        </div>

        <div className="wizard-actions">
          <button
            type="button"
            className="btn-ghost-pill"
            disabled={stage === 0}
            onClick={() => setStage(stage - 1)}
          >
            <ArrowLeft className="h-4" />
            Back
          </button>
          {stage < STEPS.length - 1 ? (
            <button type="button" className="btn-ink-pill" onClick={next}>
              Continue
              <ArrowRight className="h-4" />
            </button>
          ) : (
            <button className="btn-coral-pill" disabled={busy} type="button" onClick={(e) => void submit(e)}>
              <Sparkles className="h-4" />
              {busy ? "Starting…" : isWebsite ? "Create launch video" : "Create product short"}
            </button>
          )}
        </div>
      </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
