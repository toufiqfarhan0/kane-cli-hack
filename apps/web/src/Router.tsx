import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { BadgeCheck, Clapperboard, Presentation, Sparkles } from "lucide-react";
import Home from "./views/ShortStudio";
import Job from "./views/ProductionInspector";
import Gallery from "./views/RenderLibrary";
import Pitch from "./views/ProductDeck";
import Verified from "./views/QaGuardrails";

function Header() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancel) setOnline(Boolean(d && d.ok));
      })
      .catch(() => {
        if (!cancel) setOnline(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <NavLink to="/" className="brand-lockup" aria-label="PostReady home">
          <span className="brand-mark-dot" aria-hidden />
          <span className="brand-pixel">postready</span>
        </NavLink>
        <nav className="center-nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `btn-nav ${isActive ? "on" : ""}`}>
            <Sparkles className="h-4" strokeWidth={1.6} />
            Short Studio
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => `btn-nav ${isActive ? "on" : ""}`}>
            <Clapperboard className="h-4" strokeWidth={1.6} />
            Render Library
          </NavLink>
          <NavLink to="/verified" className={({ isActive }) => `btn-nav ${isActive ? "on" : ""}`}>
            <BadgeCheck className="h-4" strokeWidth={1.6} />
            QA Guardrails
          </NavLink>
          <NavLink to="/pitch" className={({ isActive }) => `btn-nav ${isActive ? "on" : ""}`}>
            <Presentation className="h-4" strokeWidth={1.6} />
            Product Deck
          </NavLink>
        </nav>
        <div className="header-status">
          <span className={`status-led ${online === false ? "status-led--offline" : ""}`} aria-hidden />
          <span>{online === false ? "Kane offline" : "Kane online"}</span>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main className="workspace">
        <span className="crop-mark crop-mark--tl" aria-hidden />
        <span className="crop-mark crop-mark--tr" aria-hidden />
        <span className="crop-mark crop-mark--bl" aria-hidden />
        <span className="crop-mark crop-mark--br" aria-hidden />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pitch" element={<Pitch />} />
          <Route path="/verified" element={<Verified />} />
          <Route path="/jobs" element={<Gallery />} />
          <Route path="/jobs/:id" element={<Job />} />
        </Routes>
      </main>
      <footer className="sheet-footer">
        <div className="sheet-footer-inner">
          <span>POSTREADY AI STUDIO</span>
          <span>POWERED BY TESTMU AI · KANE CLI</span>
        </div>
      </footer>
    </div>
  );
}
