/**
 * Tilted Tiles — same public API as React Bits Pro (`@reactbits-starter/tilted-tiles-tw`).
 * Official install needs REACTBITS_LICENSE_KEY in apps/web/.env.local, then:
 *   npx shadcn@latest add @reactbits-starter/tilted-tiles-tw
 */
import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";

import { cn } from "@/lib/utils";

export type TiltedTilesProps = {
  images?: string[];
  columns?: number;
  tilesPerColumn?: number;
  tileAspect?: number;
  rowGap?: number;
  columnGap?: number;
  borderRadius?: number;
  perspective?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  planeWidth?: number;
  planeHeight?: number;
  stagger?: number;
  duration?: number;
  alternate?: boolean;
  fadeTop?: number;
  fadeBottom?: number;
  parallax?: boolean;
  parallaxStrength?: number;
  pauseOnHover?: boolean;
  saturation?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
};

const FALLBACK_IMAGES = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8' fill='%23160822'/></svg>",
];

function size(value: number | string) {
  return typeof value === "number" ? `${value}px` : value;
}

export function TiltedTiles({
  images = FALLBACK_IMAGES,
  columns = 16,
  tilesPerColumn = 5,
  tileAspect = 1,
  rowGap = 8,
  columnGap = 8,
  borderRadius = 0,
  perspective = 1600,
  rotateX = 40,
  rotateY = 16,
  rotateZ = -20,
  offsetX = -40,
  offsetY = 0,
  offsetZ = 0,
  planeWidth = 280,
  planeHeight = 260,
  stagger = 20,
  duration = 25,
  alternate = true,
  fadeTop = 22,
  fadeBottom = 0,
  parallax = true,
  parallaxStrength = 8,
  pauseOnHover = false,
  saturation = 1,
  width = "100%",
  height = "100%",
  className,
}: TiltedTilesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [steer, setSteer] = useState({ x: 0, y: 0 });
  const [paused, setPaused] = useState(false);
  const sources = images.length ? images : FALLBACK_IMAGES;

  const cols = useMemo(() => {
    return Array.from({ length: Math.max(1, columns) }, (_, col) => {
      const tiles = Array.from({ length: Math.max(1, tilesPerColumn) }, (_, row) => {
        return sources[(col * tilesPerColumn + row) % sources.length];
      });
      return [...tiles, ...tiles];
    });
  }, [columns, sources, tilesPerColumn]);

  const onMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!parallax || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      setSteer({
        x: -ny * parallaxStrength,
        y: nx * parallaxStrength,
      });
    },
    [parallax, parallaxStrength],
  );

  const reset = useCallback(() => {
    setSteer({ x: 0, y: 0 });
    setPaused(false);
  }, []);

  const mask = `linear-gradient(to bottom, transparent 0%, #000 ${fadeTop}%, #000 ${100 - fadeBottom}%, transparent 100%)`;

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden", className)}
      style={{
        width: size(width),
        height: size(height),
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 40%",
      }}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onMouseEnter={() => {
        if (pauseOnHover) setPaused(true);
      }}
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 top-1/2 flex will-change-transform"
        style={{
          width: `${planeWidth}%`,
          height: `${planeHeight}%`,
          gap: columnGap,
          filter: `saturate(${saturation})`,
          transform: `translate(-50%, -50%) translate3d(${offsetX}px, ${offsetY}px, ${offsetZ}px) rotateX(${rotateX + steer.x}deg) rotateY(${rotateY + steer.y}deg) rotateZ(${rotateZ}deg)`,
          transformStyle: "preserve-3d",
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {cols.map((tiles, col) => {
          const reverse = alternate && col % 2 === 1;
          return (
            <div
              key={col}
              className="relative min-w-0 flex-1"
              style={{ transform: reverse ? `translateY(${stagger}px)` : undefined }}
            >
              <div
                className="flex flex-col"
                style={{
                  gap: rowGap,
                  animationName: reverse ? "tilted-tiles-down" : "tilted-tiles-up",
                  animationDuration: `${duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: paused ? "paused" : "running",
                }}
              >
                {tiles.map((src, row) => (
                  <div
                    key={`${col}-${row}`}
                    className="relative w-full overflow-hidden"
                    style={{
                      aspectRatio: String(tileAspect),
                      borderRadius,
                      flex: "0 0 auto",
                    }}
                  >
                    <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TiltedTiles;
