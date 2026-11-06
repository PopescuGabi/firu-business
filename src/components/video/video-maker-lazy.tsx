"use client";
// Loads the AI video maker (Remotion player + in-browser renderer) only in the browser, only on the reel page.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type VideoMakerType from "./video-maker";

const VideoMaker = dynamic(() => import("./video-maker"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded-[22px] bg-fill" />,
});

export function VideoMakerLazy(props: ComponentProps<typeof VideoMakerType>) {
  return <VideoMaker {...props} />;
}
