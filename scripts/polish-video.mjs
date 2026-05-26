#!/usr/bin/env node
// polish-video.mjs — turn a raw Playwright .webm into a polished .mp4 with a
// soft, "Screen Studio / OpenAI"–style gradient background.
//
// Playwright records a clean, chrome-free viewport capture (VFR WebM). This
// does the polish in pure ffmpeg, all config-driven so the treatment lives in
// version control and is reproducible:
//
//   - generate a low-saturation gradient background (a base diagonal gradient
//     plus a few big, blurry color blobs in the corners)
//   - normalize variable -> constant frame rate (fixes duration drift)
//   - round the recording's corners + drop a soft shadow behind it
//   - composite the recording onto the background with generous padding
//   - optional, sparing timed zoom-ins
//   - encode H.264 / yuv420p mp4 that plays everywhere
//
// Usage:
//   node scripts/polish-video.mjs <input.webm> [--out file.mp4] [--config polish.json]
//
// Config (all optional; these are the defaults):
//   {
//     "fps": 30,
//     "padding": 120,            // gradient margin around the recording (px)
//     "cornerRadius": 26,
//     "saturation": 0.92,        // <1 = softer, AI-ish palette
//     "blobBlur": 64,            // how soft the gradient blobs are
//     "shadow": { "sigma": 24, "opacity": 0.45, "dy": 16 },
//     "background": {            // the soft gradient palette
//       "base0": "#F7F7F5", "base1": "#EEF3FF",
//       "blobs": [
//         { "color": "#D7F3F1", "cx": 0.10, "cy": 0.12, "size": 0.72 },
//         { "color": "#F4D8FF", "cx": 0.90, "cy": 0.15, "size": 0.72 },
//         { "color": "#FFE6C7", "cx": 0.50, "cy": 0.95, "size": 0.82 }
//       ]
//     },
//     "zoomEvents": [ { "start": 3, "end": 5, "x": 640, "y": 360, "scale": 1.5 } ]
//   }
//
// Pass `"background": "#0f172a"` (a hex string) or a path to an image to skip
// the generated gradient and use a solid color / custom backdrop instead.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULTS = {
  fps: 30,
  // Margin around the screen as a fraction of the recording width, so the
  // screen-to-frame ratio stays consistent regardless of recording size.
  // ~0.08 keeps the screen filling ~86% of the frame (set `padding` for an
  // absolute px override instead).
  paddingRatio: 0.08,
  cornerRadius: 28,
  saturation: 1.0,
  blobBlur: 46,
  shadow: { sigma: 26, opacity: 0.5, dy: 18 },
  background: {
    base0: "#F4F6FA",
    base1: "#E6EEFF",
    blobs: [
      { color: "#A9DED7", cx: 0.07, cy: 0.08, size: 1.05 },
      { color: "#DCB2FF", cx: 0.94, cy: 0.12, size: 1.05 },
      { color: "#FFCD92", cx: 0.5, cy: 1.0, size: 1.2 },
      { color: "#B6CCFF", cx: 0.88, cy: 0.95, size: 0.9 },
    ],
  },
  zoomEvents: [],
};

function parseArgs(argv) {
  const args = { input: undefined, out: undefined, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--config") args.config = argv[++i];
    else if (!a.startsWith("--") && !args.input) args.input = a;
  }
  return args;
}

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)),
    );
  });
}

async function probeSize(input) {
  const out = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x",
    input,
  ]);
  const [w, h] = out.split("x").map((n) => parseInt(n, 10));
  return { w, h };
}

/** ffmpeg color literal: "#RRGGBB" -> "0xRRGGBB", with optional alpha byte. */
function hex(color, alpha) {
  const base = "0x" + color.replace(/^#/, "");
  return alpha === undefined ? base : base + alpha;
}

// Standard rounded-rectangle alpha: a pixel is cut only when it lies in a
// corner box AND outside that corner's quarter-circle.
function roundedAlphaExpr(w, h, rad) {
  if (rad <= 0) return null;
  const cx = `${w}/2`;
  const cy = `${h}/2`;
  const ix = `${w}/2-${rad}`;
  const iy = `${h}/2-${rad}`;
  const inCorner = `gt(abs(X-(${cx})),${ix})*gt(abs(Y-(${cy})),${iy})`;
  const dist = `pow(abs(X-(${cx}))-(${ix}),2)+pow(abs(Y-(${cy}))-(${iy}),2)`;
  return `if(${inCorner},if(lte(${dist},pow(${rad},2)),255,0),255)`;
}

function zoomFilter(events, w, h, fps) {
  if (!events?.length) return null;
  const z = events.reduce(
    (acc, e) => `if(between(time,${e.start},${e.end}),${e.scale},${acc})`,
    "1",
  );
  const x = events.reduce(
    (acc, e) => `if(between(time,${e.start},${e.end}),${e.x}-(iw/zoom/2),${acc})`,
    "iw/2-(iw/zoom/2)",
  );
  const y = events.reduce(
    (acc, e) => `if(between(time,${e.start},${e.end}),${e.y}-(ih/zoom/2),${acc})`,
    "ih/2-(ih/zoom/2)",
  );
  return `zoompan=z='${z}':x='${x}':y='${y}':d=1:fps=${fps}:s=${w}x${h}`;
}

// Render the soft gradient (base diagonal + blurry color blobs) once to a PNG.
async function renderGradientPng(bg, outW, outH, cfg, outPath) {
  const inputs = [];
  let idx = 0;
  inputs.push("-f", "lavfi", "-i",
    `gradients=s=${outW}x${outH}:c0=${hex(bg.base0)}:c1=${hex(bg.base1)}:x0=0:y0=0:x1=${outW}:y1=${outH}:type=linear:d=1:r=1`);
  const baseIdx = idx++;
  const blobs = [];
  for (const b of bg.blobs) {
    const size = Math.round(Math.min(outW, outH) * b.size);
    inputs.push("-f", "lavfi", "-i",
      `gradients=s=${size}x${size}:c0=${hex(b.color)}:c1=${hex(b.color, "00")}:type=radial:d=1:r=1`);
    blobs.push({ idx: idx++, size, b });
  }
  const chain = [`[${baseIdx}:v]format=rgba[acc0]`];
  blobs.forEach(({ idx: bi, size, b }, i) => {
    const ox = Math.round(b.cx * outW - size / 2);
    const oy = Math.round(b.cy * outH - size / 2);
    chain.push(`[acc${i}][${bi}:v]overlay=${ox}:${oy}[acc${i + 1}]`);
  });
  chain.push(
    `[acc${blobs.length}]gblur=sigma=${cfg.blobBlur},eq=saturation=${cfg.saturation},format=rgb24[bg]`,
  );
  await run("ffmpeg", [
    "-y", ...inputs,
    "-filter_complex", chain.join(";"),
    "-map", "[bg]", "-frames:v", "1", outPath,
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Usage: node scripts/polish-video.mjs <input.webm> [--out file.mp4] [--config polish.json]");
    process.exit(1);
  }
  if (!existsSync(args.input)) {
    console.error(`Input not found: ${args.input}`);
    process.exit(1);
  }

  const cfg = { ...DEFAULTS };
  if (args.config) {
    if (!existsSync(args.config)) {
      console.error(`Config not found: ${args.config}`);
      process.exit(1);
    }
    Object.assign(cfg, JSON.parse(readFileSync(args.config, "utf8")));
  }

  const out = args.out ?? args.input.replace(/\.[^.]+$/, "") + ".polished.mp4";
  const { w, h } = await probeSize(args.input);
  const padding = cfg.padding ?? Math.round(w * cfg.paddingRatio);
  const outW = w + padding * 2;
  const outH = h + padding * 2;
  const cx = padding; // recording's top-left on the canvas
  const cy = padding;

  // ---- background: resolve to a still image we can loop -------------------
  // Rendering the gradient once to a PNG (then looping it) is both correct
  // (lavfi sources don't get exhausted mid-clip) and fast (no per-frame blur).
  const bgIsImage = typeof cfg.background === "string" && /\.(png|jpe?g|webp)$/i.test(cfg.background);
  const bgIsColor = typeof cfg.background === "string" && !bgIsImage;
  let bgPng = bgIsImage ? cfg.background : null;
  let tempBg = null;
  if (!bgIsImage && !bgIsColor) {
    tempBg = join(tmpdir(), `glow-bg-${process.pid}.png`);
    await renderGradientPng(cfg.background, outW, outH, cfg, tempBg);
    bgPng = tempBg;
  }

  // ---- inputs --------------------------------------------------------------
  const inputs = ["-i", args.input];
  let nextIdx = 1;
  const bgFilters = [];
  if (bgIsColor) {
    inputs.push("-f", "lavfi", "-i", `color=c=${cfg.background}:s=${outW}x${outH}`);
    bgFilters.push(`[${nextIdx}:v]format=rgb24[bg]`);
  } else {
    inputs.push("-loop", "1", "-i", bgPng);
    bgFilters.push(`[${nextIdx}:v]scale=${outW}:${outH},format=rgb24[bg]`);
  }
  nextIdx++;

  // ---- recording stage -----------------------------------------------------
  const stage1 = [`fps=${cfg.fps}`, "setpts=PTS-STARTPTS"];
  const zoom = zoomFilter(cfg.zoomEvents, w, h, cfg.fps);
  if (zoom) stage1.push(zoom);

  const alpha = roundedAlphaExpr(w, h, cfg.cornerRadius);
  const roundChain = alpha
    ? `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alpha}'`
    : "format=rgba";

  const s = cfg.shadow;
  const filter = [
    ...bgFilters,
    `[0:v]${stage1.join(",")},${roundChain},split[clip][clipsil]`,
    // drop shadow: a black, alpha-dimmed silhouette of the rounded clip,
    // padded onto a transparent canvas at the clip's position, then blurred
    // so it softly extends past the edges.
    `[clipsil]format=rgba,colorchannelmixer=rr=0:gg=0:bb=0:aa=${s.opacity},pad=${outW}:${outH}:${cx}:${cy + s.dy}:color=0x00000000,gblur=sigma=${s.sigma}[shadow]`,
    // composite: shadow under the clip, both on the gradient
    `[bg][shadow]overlay=0:0[bgsh]`,
    `[bgsh][clip]overlay=${cx}:${cy}:shortest=1,format=yuv420p[out]`,
  ].join(";");

  const ffArgs = [
    "-y",
    ...inputs,
    "-filter_complex", filter,
    "-map", "[out]",
    "-r", String(cfg.fps),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    out,
  ];

  console.log(`polishing ${args.input} -> ${out}  (${w}x${h} on ${outW}x${outH})`);
  await run("ffmpeg", ffArgs);
  if (tempBg && !process.env["KEEP_BG"]) rmSync(tempBg, { force: true });
  else if (tempBg) console.log(`kept bg: ${tempBg}`);
  console.log(`done: ${out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
