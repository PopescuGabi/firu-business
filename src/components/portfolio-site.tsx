import { ArrowUpRight, Globe } from "lucide-react";
import { PORTFOLIO_SITE } from "@/lib/brand";
import { GlassCard } from "./glass";

/** The live portfolio website: a scaled, non-interactive preview and a link to open it. */
export function PortfolioSite() {
  return (
    <GlassCard as="div" className="mb-6 grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-label-2">
          <Globe size={14} aria-hidden /> Your website
        </p>
        <h2 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{PORTFOLIO_SITE.label}</h2>
        <p className="text-[14px] text-label-2">The public portfolio clients see. Pieces you mark public below also appear on your shareable portfolio page.</p>
        <a
          href={PORTFOLIO_SITE.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-white"
        >
          Open the site <ArrowUpRight size={15} aria-hidden />
        </a>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[18px] bg-fill shadow-[inset_0_0_0_1px_var(--separator)]">
        {/* Rendered at desktop width and scaled down, so the preview shows the real layout. */}
        <iframe
          src={PORTFOLIO_SITE.url}
          title="Preview of your portfolio website"
          tabIndex={-1}
          aria-hidden
          sandbox="allow-scripts allow-same-origin"
          className="pointer-events-none absolute top-0 left-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
        />
      </div>
    </GlassCard>
  );
}
