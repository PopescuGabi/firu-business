import clsx from "clsx";
import type { CarouselTheme, Slide } from "@/lib/db/schema";

const FONTS = { sans: "var(--font-sans)", serif: "var(--font-serif)", rounded: "var(--font-rounded)" };

/** One 1080×1350 (4:5) slide. Text scales with the container, so it looks the same at any size and on export. */
export function SlidePreview({
  slide,
  theme,
  index,
  total,
  className,
}: {
  slide: Pick<Slide, "heading" | "body">;
  theme: CarouselTheme;
  index: number;
  total: number;
  className?: string;
}) {
  return (
    <div
      className={clsx("relative aspect-[4/5] w-full overflow-hidden [container-type:inline-size]", className)}
      style={{ background: theme.background, color: theme.foreground, fontFamily: FONTS[theme.font] }}
    >
      <div className={clsx("absolute inset-0 flex flex-col justify-center p-[8cqw]", theme.align === "center" ? "items-center text-center" : "items-start text-left")}>
        <span className="mb-[4cqw] block h-[0.8cqw] w-[12cqw] rounded-full" style={{ background: theme.accent }} />
        {slide.heading && (
          <h3 className="text-[8.5cqw] leading-[1.08] font-bold tracking-tight whitespace-pre-line">{slide.heading}</h3>
        )}
        {slide.body && <p className="mt-[4cqw] text-[4.4cqw] leading-[1.4] whitespace-pre-line opacity-85">{slide.body}</p>}
        {!slide.heading && !slide.body && <p className="text-[4cqw] opacity-40">Empty slide</p>}
      </div>
      <span className="absolute right-[6cqw] bottom-[5cqw] text-[3cqw] font-semibold tabular-nums opacity-50">
        {index + 1}/{total}
      </span>
    </div>
  );
}
