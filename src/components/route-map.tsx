import { Clock, Footprints, Route as RouteIcon } from "lucide-react";
import type { DayRoute } from "@/lib/route";
import { MAP_SIZE } from "@/lib/google/maps";
import { fmtMin } from "./day-timeline";
import { Chip } from "./ui";

const km = (m: number) => (m >= 10_000 ? `${Math.round(m / 1000)} km` : `${(m / 1000).toFixed(1)} km`);

/**
 * The day's route over a night (or porcelain, in light mode) map: the line draws itself in,
 * stops glow, and chips show total travel, distance and time away from home.
 */
export function RouteMap({ route, className }: { route: DayRoute; className?: string }) {
  const { view } = route;
  const src = (t: "dark" | "light") => `/api/maps/static?lat=${view.center.lat.toFixed(6)}&lng=${view.center.lng.toFixed(6)}&z=${view.zoom}&t=${t}`;
  return (
    <div className={className}>
      <div className="route-map">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own proxied map picture */}
        <img src={src("light")} alt="" className="map-light" />
        {/* eslint-disable-next-line @next/next/no-img-element -- our own proxied map picture */}
        <img src={src("dark")} alt="" className="map-dark" />
        <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} className="absolute inset-0 size-full" aria-hidden>
          {route.legs.map((l, i) => (
            <g key={i}>
              <path d={l.path} className="route-glow" />
              <path d={l.path} className="route-line" pathLength={1} style={{ animationDelay: `${i * 0.35}s` }} />
            </g>
          ))}
          {route.stops.map((s, i) => (
            <g key={i} transform={`translate(${s.x} ${s.y})`}>
              <circle r={i === 0 || i === route.stops.length - 1 ? 9 : 7} className="route-pin" />
              <circle r={3} fill="#fff" />
            </g>
          ))}
        </svg>
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1.5">
          <Chip icon={<RouteIcon size={13} />} className="map-chip">
            {fmtMin(route.minutes)}
          </Chip>
          <Chip icon={<Footprints size={13} />} className="map-chip">
            {km(route.meters)}
          </Chip>
          <Chip icon={<Clock size={13} />} className="map-chip">
            {fmtMin(route.awayMinutes)} out
          </Chip>
        </div>
      </div>
      <span className="sr-only">
        Route today: {route.stops.map((s) => s.title).join(" → ")}, {fmtMin(route.minutes)} of travel, {km(route.meters)}.
      </span>
    </div>
  );
}
