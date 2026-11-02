"use client";
import { buttonClass, Empty } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-16">
      <Empty title="Something went wrong">
        <p>{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset} className={buttonClass("filled", "sm") + " mt-4"}>
          Try again
        </button>
      </Empty>
    </div>
  );
}
