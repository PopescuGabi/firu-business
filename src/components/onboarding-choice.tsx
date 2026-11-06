"use client";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { AiSetup } from "./ai-setup";
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
      <SectionsForm initial={current} onboarding name={name} timezone={timezone} />
    </div>
  );
}
