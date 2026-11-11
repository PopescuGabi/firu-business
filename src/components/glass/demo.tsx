"use client";
// The Liquid Glass showcase: every component over light, dark, photographic and moving backdrops.
import { useRef, useState } from "react";
import { Bell, CalendarDays, Copy, House, Mic, Search, Share2, Sparkles, SquarePen, Trash2, BarChart3, Globe } from "lucide-react";
import { GlassButton, GlassCard, GlassDock, GlassDropdown, GlassInput, GlassModal, GlassNavbar, GlassSurface, useGlass, type GlassMode } from "./index";

const SCENES = [
  { id: "light", label: "Light gradient" },
  { id: "dark", label: "Dark" },
  { id: "photo", label: "Photographic" },
  { id: "moving", label: "Moving content" },
] as const;

function Kit({ onOpenModal, originRef }: { onOpenModal: () => void; originRef: React.RefObject<HTMLButtonElement | null> }) {
  const [tab, setTab] = useState("#home");
  const [email, setEmail] = useState("not-an-email");
  return (
    <div className="lg-demo-kit">
      <GlassNavbar
        label="Demo navigation"
        activeHref={tab}
        onSelect={setTab}
        items={[
          { href: "#home", label: "Home", icon: <House size={18} /> },
          { href: "#analysis", label: "Analysis", icon: <BarChart3 size={18} /> },
          { href: "#calendar", label: "Calendar", icon: <CalendarDays size={18} /> },
          { href: "#portfolio", label: "Portfolio", icon: <Globe size={18} /> },
        ]}
      />
      <div className="lg-demo-row">
        <GlassButton variant="primary" icon={<Sparkles size={16} aria-hidden />}>Primary</GlassButton>
        <GlassButton>Secondary</GlassButton>
        <GlassButton shape="rounded">Rounded</GlassButton>
        <GlassButton aria-label="Notifications" icon={<Bell size={18} aria-hidden />} />
        <GlassButton loading>Saving</GlassButton>
        <GlassButton disabled>Disabled</GlassButton>
      </div>
      <div className="lg-demo-row">
        <GlassInput label="Search" placeholder="Search clients, reels, leads" icon={<Search size={18} />} />
        <GlassInput label="Quick search" placeholder="Search" icon={<Search size={18} />} expandable />
      </div>
      <GlassInput label="Email" value={email} onChange={(e) => setEmail(e.target.value)} error={/^\S+@\S+\.\S+$/.test(email) ? undefined : "Enter an email address such as name@example.com."} />
      <div className="lg-demo-row">
        <GlassDock
          label="Demo toolbar"
          actions={[
            { id: "mic", label: "Talk to Jarvis", icon: <Mic size={20} />, active: true },
            { id: "edit", label: "Edit", icon: <SquarePen size={20} /> },
            { id: "share", label: "Share", icon: <Share2 size={20} /> },
          ]}
          more={[
            { id: "copy", label: "Copy", icon: <Copy size={20} /> },
            { id: "delete", label: "Delete", icon: <Trash2 size={20} /> },
          ]}
        />
        <GlassDropdown
          label="Actions"
          items={[
            { id: "dup", label: "Duplicate", icon: <Copy size={16} />, onSelect: () => {} },
            { id: "share", label: "Share", icon: <Share2 size={16} />, onSelect: () => {} },
            { id: "del", label: "Delete", icon: <Trash2 size={16} />, onSelect: () => {}, danger: true },
          ]}
        />
        <GlassButton ref={originRef} variant="primary" onClick={onOpenModal}>Open modal</GlassButton>
      </div>
      <GlassCard interactive>
        <h3 className="lg-demo-h3">Interactive card</h3>
        <p className="lg-demo-p">Hover to lift it; the highlight follows the pointer. Text stays readable on every backdrop.</p>
      </GlassCard>
    </div>
  );
}

export function GlassDemo() {
  const { tier, reasons, mode, setMode } = useGlass();
  const [open, setOpen] = useState(false);
  const origin = useRef<HTMLButtonElement>(null);
  const [scene, setScene] = useState<(typeof SCENES)[number]["id"]>("light");
  return (
    <div className="lg-demo">
      <header className="lg-demo-head">
        <div>
          <h1 className="lg-demo-title">Liquid Glass</h1>
          <p className="lg-demo-p">
            Rendering tier {tier}: {reasons.join("; ")}. Add <code>?glassdebug=1</code> to the address for the debug panel.
          </p>
        </div>
        <GlassSurface shape="capsule" className="lg-demo-seg" role="group" aria-label="Intensity">
          {(["subtle", "balanced", "expressive"] as GlassMode[]).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </GlassSurface>
      </header>
      <div className="lg-demo-tabs" role="group" aria-label="Backdrop">
        {SCENES.map((s) => (
          <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => setScene(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <section className="lg-demo-scene" data-scene={scene} data-glass-scheme={scene === "dark" ? "dark" : "light"} aria-label={`Components over a ${scene} backdrop`}>
        <div className="lg-demo-art" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <Kit onOpenModal={() => setOpen(true)} originRef={origin} />
      </section>
      <GlassModal open={open} onClose={() => setOpen(false)} title="A glass modal" originRef={origin}>
        <p className="lg-demo-p">It grows out of the button that opened it and shrinks back into it. Escape, the close button or a click outside closes it, and focus returns to the button.</p>
        <div className="lg-demo-row" style={{ marginTop: 14 }}>
          <GlassButton variant="primary" onClick={() => setOpen(false)}>Done</GlassButton>
          <GlassButton onClick={() => setOpen(false)}>Cancel</GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
