"use client";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { AiSetup } from "./ai-setup";
import { PageAdders } from "./page-adders";
import { SectionsForm } from "./sections-form";
import { buttonClass } from "./ui";

/** First sign-in: the AI setup, or (skip) the plain section picker. */
export function OnboardingChoice({ ai, current, name, timezone, today }: { ai: boolean; current: string[]; name: string; timezone: string; today: string }) {
  const [manual, setManual] = useState(!ai);
  if (!manual) return <AiSetup onboarding current={current} name={name} today={today} onSkip={() => setManual(true)} />;
  return (
    <div className="flex flex-col gap-4">
      {ai && (
        <button type="button" onClick={() => setManual(false)} className={`${buttonClass("tinted", "sm")} self-start`}>
          <Wand2 size={14} /> Set up with AI instead
        </button>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-label-2 uppercase">1 · Pages for your work</h2>
        <p className="px-1 text-[13px] text-label-2">Add ready-made pages for your kind of job, or build your own. You can change or delete them any time.</p>
        <PageAdders today={today} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-label-2 uppercase">2 · Sections</h2>
        <SectionsForm initial={current} onboarding name={name} timezone={timezone} />
      </section>
    </div>
  );
}
