import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const SLIDE_TAGS = [
  "01 — INTRO",
  "02 — PROBLEM & NEED",
  "03 — WHO IT SERVES",
  "04 — POSTREADY",
  "05 — INPUT TO FILM",
  "06 — ARCHITECTURE",
  "07 — KANE CLI",
  "08 — QUALITY GATE",
  "09 — THANK YOU",
];

const FLOW = [
  { n: "01", title: "URL & Mode", body: "Paste a store item or website link + pick style & size.", kane: false },
  { n: "02", title: "PostReady", body: "Validates Brief & capture steps cleanly.", kane: false },
  { n: "03", title: "Kane Capture", body: "Headless Chromium dismisses popups & captures live views.", kane: true },
  { n: "04", title: "Gemini Vision", body: "Plans scenes, palette & voice script from captures.", kane: false },
  { n: "05", title: "Voice & Music", body: "Neural edge-tts narration mixed over stereo SFX.", kane: false },
  { n: "06", title: "Motion Engine", body: "Animates 9:16 shorts or 16:9 widescreen trailers to MP4.", kane: false },
];

function Stars() {
  return (
    <span className="deck-stars" aria-hidden>
      {["★", "✦", "★", "✧", "★", "✦", "✧", "★"].map((s, n) => (
        <span key={n} className={`deck-star n${n}`}>
          {s}
        </span>
      ))}
    </span>
  );
}

export default function Pitch() {
  const [i, setI] = useState(0);
  const slides = SLIDE_TAGS.length;

  const go = useCallback(
    (n: number) => {
      setI(Math.max(0, Math.min(slides - 1, n)));
    },
    [slides],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i]);

  return (
    <section className="cobalt-hero-band cobalt-deck-band">
      <div className="page-pitch hero-band-inner">
        <div className="pitch-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span className="sticker-pill sticker-pill--lime" style={{ transform: "none" }}>
              Product Deck
            </span>
            <span className="mono-kicker" style={{ color: "rgba(255,255,255,0.8)" }}>
              /pitch
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <span className="mono-kicker" style={{ color: "rgba(255,255,255,0.85)" }}>
              KEYS: [ PREV ] / [ NEXT ]
            </span>
            <span className="pitch-counter-pill">
              {String(i + 1).padStart(2, "0")} / {String(slides).padStart(2, "0")}
            </span>
          </div>
        </div>

        <section className="pitch-frame" key={i}>
          <header className="pitch-frame-bar">
            <span className="mono-kicker">
              <span className="console-dots" aria-hidden style={{ marginRight: "0.25rem" }}>
                <i style={{ background: "#f04438" }} />
                <i style={{ background: "#d8ff3e" }} />
                <i style={{ background: "#12b76a" }} />
              </span>
              POSTREADY STUDIO // CONTACT SHEET
            </span>
            <span className="mono-kicker" style={{ color: "var(--ink)" }}>
              {SLIDE_TAGS[i]}
            </span>
          </header>

        <div className="pitch-stage">
          {i === 0 && (
            <div className="slide slide-center">
              <p className="pixel-hero">PostReady</p>
              <p className="slide-lead">
                Turn any store product or website link into a launch-ready 15-second video.
              </p>
              <p className="powered-by">
                <span>Powered by</span>
                <img className="powered-testmu" src="/testmu-logo.svg" alt="TestMu AI" />
                <span className="powered-sep" aria-hidden>
                  ·
                </span>
                <span className="powered-kane">
                  <img src="/kane-cli.svg" alt="" />
                  Kane CLI
                </span>
              </p>
              <div className="pitch-gif-wrap">
                <img src="/deck-media/postready-hero.gif" alt="PostReady rendered short preview" />
              </div>
            </div>
          )}

          {i === 1 && (
            <div className="slide">
              <div className="deck-split">
                <article className="deck-half tilt-left">
                  <span className="mono-kicker">At launches</span>
                  <h2>The product is ready.</h2>
                  <p>
                    Then you still have to script, capture clean views, and cut clips so everyone else can see it.
                  </p>
                </article>
                <article className="deck-half tilt-right">
                  <span className="mono-kicker">Static scrapers break</span>
                  <h2>Popups &amp; dynamic flows block scrapers.</h2>
                  <p>
                    Real Chromium handles cookie banners, variants, pricing tabs, and live interactions effortlessly.
                  </p>
                </article>
              </div>
              <div className="pitch-gif-wrap" style={{ alignSelf: "center" }}>
                <img src="/deck-media/postready-flow.gif" alt="Live page turned into a 15-second PostReady video" />
              </div>
            </div>
          )}

          {i === 2 && (
            <div className="slide slide-center">
              <span className="mono-kicker">Why it matters</span>
              <h1 className="slide-h1">Thousands of builders and stores face the same problem too.</h1>
              <p className="slide-lead">
                One workflow powers both 9:16 vertical product ads and native 1920×1080 widescreen software launch trailers.
              </p>
            </div>
          )}

          {i === 3 && (
            <div className="slide slide-center">
              <p className="slide-lead">That’s why we built</p>
              <div className="deck-mark">
                <Stars />
                <h1 className="pixel-hero">PostReady</h1>
              </div>
              <p className="slide-lead">
                Kane CLI captures the live page. PostReady directs the launch video — and Kane verifies the whole app end to end.
              </p>
            </div>
          )}

          {i === 4 && (
            <div className="slide slide-center">
              <span className="mono-kicker">One link</span>
              <h1 className="slide-h1">Give a URL. Get a launch video.</h1>
              <div className="deck-giveget">
                <ul className="deck-pills">
                  <li>Store Product or Website URL</li>
                  <li>Style (Director AI / 3D / Reel / Classic)</li>
                  <li>Theme (Auto / Pop / Noir / Editorial / Neon)</li>
                  <li>Video Size (9:16 / 4:5 / 1:1 / 16:9)</li>
                </ul>
                <span className="deck-arrow" aria-hidden>
                  →
                </span>
                <div className="deck-box tilt-right deck-out">
                  <strong>Launch Film</strong>
                  <span>15s MP4 + Voice + Music + SRT</span>
                </div>
              </div>
            </div>
          )}

          {i === 5 && (
            <div className="slide">
              <span className="mono-kicker">Architecture</span>
              <h1 className="slide-h1">Six deterministic stages orchestrated by Temporal</h1>
              <ol className="wf">
                {FLOW.map((step, idx) => (
                  <li key={step.n}>
                    <div className={`wf-card${step.kane ? " kane" : ""}`}>
                      <header>
                        <span className="wf-num">{step.n}</span>
                        {step.kane ? <img className="wf-logo" src="/kane-cli.svg" alt="" /> : null}
                      </header>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                    {idx < FLOW.length - 1 ? (
                      <span className="wf-join" aria-hidden>
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {i === 6 && (
            <div className="slide">
              <span className="mono-kicker">Autonomous agent</span>
              <h1 className="slide-h1">Every place Kane drives the stack</h1>
              <ul className="pitch-list">
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>Health &amp; Credits</strong>
                    <p>
                      <code>whoami</code> · <code>balance</code> · Chromium preflight checks
                    </p>
                  </div>
                </li>
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>Preflight Guard</strong>
                    <p>
                      <code>run --agent</code> — detects CAPTCHAs, paywalls &amp; bot walls early
                    </p>
                  </div>
                </li>
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>Storefront Shopper</strong>
                    <p>
                      <code>run --agent</code> — closes modals, extracts prices, gallery photos &amp; stills
                    </p>
                  </div>
                </li>
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>Website Launch Capture</strong>
                    <p>
                      <code>run --agent</code> — executes multi-step flows for 16:9 product trailers
                    </p>
                  </div>
                </li>
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>NDJSON Telemetry</strong>
                    <p>Streams every browser action and artifact live into Production Inspector</p>
                  </div>
                </li>
                <li>
                  <img src="/kane-cli.svg" alt="" />
                  <div>
                    <strong>QA Guardrails</strong>
                    <p>
                      <code>testmd run qa-specs/*_test.md</code> — blocks UI regressions across all routes
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          )}

          {i === 7 && (
            <div className="slide">
              <span className="mono-kicker">Verification</span>
              <h1 className="slide-h1">Kane guards every code change with qa-gate.</h1>
              <ol className="wf">
                <li>
                  <div className="wf-card">
                    <header>
                      <span className="wf-num">01</span>
                    </header>
                    <strong>Code Edit</strong>
                    <p>Change lands in PostReady UI or workflow config.</p>
                  </div>
                  <span className="wf-join" aria-hidden>
                    →
                  </span>
                </li>
                <li>
                  <div className="wf-card kane">
                    <header>
                      <span className="wf-num">02</span>
                      <img className="wf-logo" src="/kane-cli.svg" alt="" />
                    </header>
                    <strong>qa-gate</strong>
                    <p>Maps diff to affected TestMD flows and replays in Chromium.</p>
                  </div>
                  <span className="wf-join" aria-hidden>
                    →
                  </span>
                </li>
                <li>
                  <div className="wf-card blocked">
                    <header>
                      <span className="wf-num">03</span>
                    </header>
                    <strong>Blocked</strong>
                    <p>Broken Continue or missing observable fails the gate.</p>
                  </div>
                  <span className="wf-join" aria-hidden>
                    →
                  </span>
                </li>
                <li>
                  <div className="wf-card out">
                    <header>
                      <span className="wf-num">04</span>
                    </header>
                    <strong>Safe to ship</strong>
                    <p>All observables match baseline cleanly.</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {i === 8 && (
            <div className="slide slide-center">
              <p className="pixel-hero">Thank you</p>
              <p className="slide-lead">
                Paste the product or website link.
                <br />
                Ship the launch video.
              </p>
              <p className="powered-by">
                <span>Powered by</span>
                <img className="powered-testmu" src="/testmu-logo.svg" alt="TestMu AI" />
                <span className="powered-sep" aria-hidden>
                  ·
                </span>
                <span className="powered-kane">
                  <img src="/kane-cli.svg" alt="" />
                  Kane CLI
                </span>
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="pitch-nav">
        <button type="button" className="btn-ghost-pill" disabled={i === 0} onClick={() => go(i - 1)}>
          <ArrowLeft className="h-4" />
          Back
        </button>
        <div className="pitch-dots" aria-label="Slides">
          {Array.from({ length: slides }, (_, n) => (
            <button
              key={n}
              type="button"
              className={`pitch-dot ${n === i ? "on" : ""}`}
              aria-label={`Slide ${n + 1}`}
              onClick={() => go(n)}
            />
          ))}
        </div>
        <button type="button" className="btn-coral-pill" disabled={i === slides - 1} onClick={() => go(i + 1)}>
          Continue
          <ArrowRight className="h-4" />
        </button>
      </footer>
      </div>
    </section>
  );
}
