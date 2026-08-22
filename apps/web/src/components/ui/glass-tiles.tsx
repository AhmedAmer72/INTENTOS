/**
 * Glass Tiles — same public API as React Bits Pro (`@reactbits-starter/glass-tiles-tw`).
 * Official install needs REACTBITS_LICENSE_KEY in apps/web/.env.local, then:
 *   npx shadcn@latest add @reactbits-starter/glass-tiles-tw
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type GlassTilesProps = {
  width?: string | number;
  height?: string | number;
  className?: string;
  children?: ReactNode;
  speed?: number;
  tileDensity?: number;
  rippleLayers?: number;
  warpStrength?: number;
  bandSharpness?: number;
  chromaticSpread?: number;
  colorA?: string;
  colorB?: string;
  backgroundColor?: string;
  opacity?: number;
  dpr?: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [30 / 255, 0, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_density;
uniform float u_ripples;
uniform float u_warp;
uniform float u_sharp;
uniform float u_chroma;
uniform vec3 u_a;
uniform vec3 u_b;
uniform vec3 u_bg;
uniform float u_opacity;

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);

  float cells = max(u_density, 1.0) * 1.65;
  vec2 scaled = p * cells;
  vec2 id = floor(scaled);
  vec2 gv = fract(scaled) - 0.5;

  float dist = length(p);
  float ripple = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_ripples) break;
    float fi = float(i);
    float phase = u_time * (0.35 + fi * 0.12) - dist * (2.4 + fi * 0.55) + id.x * 0.15;
    ripple += sin(phase) / (1.15 + fi * 0.45);
  }

  vec2 warped = gv + gv * u_warp * ripple;
  float d = max(abs(warped.x), abs(warped.y));
  float tile = smoothstep(0.46, 0.34, d);
  float edge = smoothstep(0.30, 0.46, d) * tile;

  float t = 0.5 + 0.5 * sin(u_time * 0.9 + id.x * 0.37 - id.y * 0.29 + ripple * 3.2);
  float band = pow(clamp(t, 0.0, 1.0), max(u_sharp, 0.5));
  vec3 col = mix(u_a, u_b, band);
  col.r += u_chroma * band * 0.22;
  col.b -= u_chroma * (1.0 - band) * 0.16;

  float shine = pow(max(0.0, 0.42 - abs(warped.x + warped.y * 0.3 + sin(u_time + id.y) * 0.08)), 1.6) * 1.4;
  col += vec3(0.85, 0.72, 1.0) * shine * tile;

  vec3 glass = mix(u_bg, col, tile * 0.78);
  glass += vec3(0.42, 0.22, 0.72) * edge * 0.45;
  glass = mix(u_bg, glass, mix(0.55, 1.0, uv.y * 0.35 + 0.4));

  gl_FragColor = vec4(glass, u_opacity);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function GlassTiles({
  width = "100%",
  height = "100%",
  className,
  children,
  speed = 1,
  tileDensity = 4,
  rippleLayers = 6,
  warpStrength = 0.33,
  bandSharpness = 3,
  chromaticSpread = 0,
  colorA = "#1E00FF",
  colorB = "#D765E6",
  backgroundColor = "#FFFFFF",
  opacity = 1,
  dpr = 1.5,
}: GlassTilesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(program, "u_res"),
      time: gl.getUniformLocation(program, "u_time"),
      density: gl.getUniformLocation(program, "u_density"),
      ripples: gl.getUniformLocation(program, "u_ripples"),
      warp: gl.getUniformLocation(program, "u_warp"),
      sharp: gl.getUniformLocation(program, "u_sharp"),
      chroma: gl.getUniformLocation(program, "u_chroma"),
      a: gl.getUniformLocation(program, "u_a"),
      b: gl.getUniformLocation(program, "u_b"),
      bg: gl.getUniformLocation(program, "u_bg"),
      opacity: gl.getUniformLocation(program, "u_opacity"),
    };

    const rgbA = hexToRgb(colorA);
    const rgbB = hexToRgb(colorB);
    const rgbBg = hexToRgb(backgroundColor);

    let raf = 0;
    let start = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const pixel = Math.min(window.devicePixelRatio || 1, dpr);
      const w = Math.max(1, Math.floor(rect.width * pixel));
      const h = Math.max(1, Math.floor(rect.height * pixel));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const draw = (now: number) => {
      const t = reduced ? 0 : ((now - start) / 1000) * speed;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.density, tileDensity);
      gl.uniform1f(u.ripples, rippleLayers);
      gl.uniform1f(u.warp, warpStrength);
      gl.uniform1f(u.sharp, bandSharpness);
      gl.uniform1f(u.chroma, chromaticSpread);
      gl.uniform3f(u.a, rgbA[0], rgbA[1], rgbA[2]);
      gl.uniform3f(u.b, rgbB[0], rgbB[1], rgbB[2]);
      gl.uniform3f(u.bg, rgbBg[0], rgbBg[1], rgbBg[2]);
      gl.uniform1f(u.opacity, opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, [
    speed,
    tileDensity,
    rippleLayers,
    warpStrength,
    bandSharpness,
    chromaticSpread,
    colorA,
    colorB,
    backgroundColor,
    opacity,
    dpr,
  ]);

  const size: CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)} style={size}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
      {children ? <div className="relative z-10 h-full w-full">{children}</div> : null}
    </div>
  );
}

export default GlassTiles;
