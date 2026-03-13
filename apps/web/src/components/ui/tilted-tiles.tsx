/**
 * Tilted Tiles — same public API as React Bits Pro (`@reactbits-starter/tilted-tiles-tw`).
 * Official install needs REACTBITS_LICENSE_KEY in apps/web/.env.local, then:
 *   npx shadcn@latest add @reactbits-starter/tilted-tiles-tw
 */
import { useEffect, useMemo, useRef, useState } from "react";

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

const rasterCache = new Map<string, string>();

function rasterizeTile(src: string, px = 896): Promise<string> {
  const hit = rasterCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rasterCache.set(src, src);
        resolve(src);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, px, px);
      try {
        const url = canvas.toDataURL("image/png");
        rasterCache.set(src, url);
        resolve(url);
      } catch {
        rasterCache.set(src, src);
        resolve(src);
      }
    };
    img.onerror = () => {
      rasterCache.set(src, src);
      resolve(src);
    };
    img.src = src;
  });
}

function useRasterTiles(sources: string[]) {
  const key = sources.join("\0");
  const [tiles, setTiles] = useState(sources);
  useEffect(() => {
    let live = true;
    Promise.all(sources.map((src) => rasterizeTile(src))).then((next) => {
      if (live) setTiles(next);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return tiles;
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
  const planeRef = useRef<HTMLDivElement>(null);
  const rawSources = images.length ? images : FALLBACK_IMAGES;
  const sources = useRasterTiles(rawSources);
  const [inView, setInView] = useState(true);
  const [compact, setCompact] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setInView(entry.isIntersecting && entry.intersectionRatio > 0.04);
      },
      { threshold: [0, 0.04, 0.2] },
    );
    io.observe(wrap);

    const compactMq = window.matchMedia("(max-width: 768px)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCompact(compactMq.matches || motionMq.matches);
    sync();
    compactMq.addEventListener("change", sync);
    motionMq.addEventListener("change", sync);

    const onVis = () => {
      if (document.hidden) setInView(false);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      compactMq.removeEventListener("change", sync);
      motionMq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!parallax || compact) return;
    const wrap = wrapRef.current;
    const plane = planeRef.current;
    if (!wrap || !plane) return;

    let raf = 0;
    const onMove = (event: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = wrap.getBoundingClientRect();
        const nx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
        const ny = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
        plane.style.setProperty("--steer-x", `${(-ny * parallaxStrength).toFixed(2)}deg`);
        plane.style.setProperty("--steer-y", `${(nx * parallaxStrength).toFixed(2)}deg`);
      });
    };
    const reset = () => {
      plane.style.setProperty("--steer-x", "0deg");
      plane.style.setProperty("--steer-y", "0deg");
    };

    wrap.addEventListener("mousemove", onMove, { passive: true });
    wrap.addEventListener("mouseleave", reset);
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", reset);
    };
  }, [compact, parallax, parallaxStrength]);

  const colCount = compact ? Math.min(columns, 4) : columns;
  const loop = inView && !compact && !paused;
  const cols = useMemo(() => {
    return Array.from({ length: Math.max(1, colCount) }, (_, col) => {
      const tiles = Array.from({ length: Math.max(1, tilesPerColumn) }, (_, row) => {
        return sources[(col * tilesPerColumn + row) % sources.length];
      });
      return loop ? [...tiles, ...tiles] : tiles;
    });
  }, [colCount, loop, sources, tilesPerColumn]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden", className)}
      style={{
        width: size(width),
        height: size(height),
        perspective: `${perspective}px`,
        perspectiveOrigin: "50% 40%",
        contain: "layout paint",
      }}
      onMouseEnter={() => {
        if (pauseOnHover) setPaused(true);
      }}
      onMouseLeave={() => {
        if (pauseOnHover) setPaused(false);
      }}
      aria-hidden="true"
    >
      <div
        ref={planeRef}
        className="absolute left-1/2 top-1/2 flex"
        style={{
          width: `${planeWidth}%`,
          height: `${planeHeight}%`,
          gap: columnGap,
          filter: saturation === 1 ? undefined : `saturate(${saturation})`,
          transform: `translate(-50%, -50%) translate3d(${offsetX}px, ${offsetY}px, ${offsetZ}px) rotateX(calc(${rotateX}deg + var(--steer-x, 0deg))) rotateY(calc(${rotateY}deg + var(--steer-y, 0deg))) rotateZ(${rotateZ}deg)`,
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
                className="tilted-tiles-col flex flex-col"
                style={{
                  gap: rowGap,
                  animationName: loop ? (reverse ? "tilted-tiles-down" : "tilted-tiles-up") : "none",
                  animationDuration: `${duration}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
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
                      boxShadow: "inset 0 0 0 1px rgba(244, 223, 255, 0.16)",
                    }}
                  >
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      decoding="async"
                      className="h-full w-full object-cover"
                      style={{ borderRadius }}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, #0C0414 0%, transparent ${fadeTop}%, transparent ${100 - fadeBottom}%, #0C0414 100%)`,
        }}
      />
    </div>
  );
}

export default TiltedTiles;
