"use client";
import { PencilRuler } from "lucide-react";
import { PageBuilder } from "./page-builder";
import { Sheet } from "./sheet";
import { TemplatePicker } from "./template-picker";
import { buttonClass } from "./ui";

/** Ready-made pages by job, plus "Build my own page". Used at first sign-in (skip AI) and in Settings. */
export function PageAdders({ today, existing = [] }: { today: string; existing?: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <TemplatePicker today={today} existing={existing} />
      <Sheet title="Build my own page" trigger={<><PencilRuler size={15} /> Build my own page</>} triggerClassName={`${buttonClass("gray")} self-start`}>
        <PageBuilder today={today} />
      </Sheet>
    </div>
  );
}
