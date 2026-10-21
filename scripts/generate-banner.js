#!/usr/bin/env node
// Generates an abstract geometric SVG banner (overlapping translucent hexagons,
// trapezoids, triangles and parallelograms with 60° edges) from a pastel palette.
//
// Writes both an .svg and a rendered .png (same base name) so the result can be previewed.
//
// Usage: node scripts/generate-banner.js [--seed 1] [--out src/images/banner] ...
// Run with --help for all parameters.

const { writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { Resvg } = require('@resvg/resvg-js');

// ---- Palette ---------------------------
const PALETTE = [
  '#96A797', // sage
  '#C7CDBF', // light sage
  '#EBD1C3', // peach
  '#525E66', // slate
  '#B08A81', // dusty rose
  '#6E8175', // deep sage
  '#C7A491', // clay
  '#EECFCA', // blush
  '#919683', // olive grey
  '#595E48', // forest
];
const BACKGROUND = '#ECE4D9'; // cream

// ---- Parameters ------------------------------------------------------------
const DEFAULTS = {
  seed: 22,
  width: 2000,
  height: 288,
  shapes: 32, // number of translucent shapes
  midEdges: 0.2, // fraction of shapes (0-1) free-placed, i.e. allowed to show horizontal edges mid-banner
  grid: 60, // lattice spacing (px) shapes snap to; keeps edges aligned. 0 = off (fully random)
  minSize: 200, // shape width range (px)
  maxSize: 560,
  minOpacity: 0.35,
  maxOpacity: 0.75,
  cutouts: 1, // opaque background-colored shapes biting into the top/bottom edges
  blend: 'multiply', // multiply | normal -> multiply darkens overlaps like the reference
  background: 'transparent', // 'transparent' or a color, e.g. '#ECE4D9' (cream)
  out: 'src/images/banner', // base path; .svg and .png are appended
};

const HELP = `Parameters (--name value):
${Object.entries(DEFAULTS).map(([k, v]) => `  --${k.padEnd(11)} default: ${v}`).join('\n')}
  --colors      comma-separated hex list to override the palette`;

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const val = argv[++i];
    if (key === 'colors') opts.colors = val.split(',').map((c) => c.trim());
    else if (key in DEFAULTS) opts[key] = typeof DEFAULTS[key] === 'number' ? Number(val) : val;
    else throw new Error(`Unknown parameter: --${key}`);
  }
  return opts;
}

// ---- Seeded RNG (mulberry32) -----------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Shape builders (all edges are horizontal or ±60°) ---------------------
const TAN60 = Math.sqrt(3);

// Each returns points relative to top-left of bounding box (w x h).
const SHAPES = {
  // flat-top hexagon
  hexagon: (w, h) => {
    const inset = h / TAN60;
    return [[inset, 0], [w - inset, 0], [w, h / 2], [w - inset, h], [inset, h], [0, h / 2]];
  },
  // trapezoid, wide base at bottom
  trapezoid: (w, h) => {
    const inset = h / TAN60;
    return [[inset, 0], [w - inset, 0], [w, h], [0, h]];
  },
  // upside-down trapezoid
  trapezoidFlipped: (w, h) => {
    const inset = h / TAN60;
    return [[0, 0], [w, 0], [w - inset, h], [inset, h]];
  },
  // parallelogram leaning right
  parallelogram: (w, h) => {
    const skew = h / TAN60;
    return [[skew, 0], [w, 0], [w - skew, h], [0, h]];
  },
  // triangle pointing up
  triangle: (w, h) => [[w / 2, 0], [w, h], [0, h]],
  // triangle pointing down
  triangleFlipped: (w, h) => [[0, 0], [w, 0], [w / 2, h]],
};
const SHAPE_NAMES = Object.keys(SHAPES);
// hexagons and trapezoids dominate, like the reference
const SHAPE_WEIGHTS = { hexagon: 4, trapezoid: 2, trapezoidFlipped: 2, parallelogram: 2, triangle: 1, triangleFlipped: 1 };

function generate(opts) {
  const rand = rng(opts.seed);
  const colors = opts.colors ?? PALETTE;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const weighted = SHAPE_NAMES.flatMap((n) => Array(SHAPE_WEIGHTS[n]).fill(n));

  const { width, height } = opts;
  const polygon = (name, x, y, w, h, fill, opacity) => {
    const pts = SHAPES[name](w, h).map(([px, py]) => `${(x + px).toFixed(1)},${(y + py).toFixed(1)}`).join(' ');
    return `<polygon points="${pts}" fill="${fill}" fill-opacity="${opacity.toFixed(2)}"/>`;
  };

  const body = [];

  // Translucent shapes, spread left-to-right so coverage is even.
  for (let i = 0; i < opts.shapes; i++) {
    const name = pick(weighted);
    // Most shapes "span" the full height so their top/bottom edges are off-canvas and only the
    // slanted edges show. A `midEdges` fraction is free-placed and may show horizontal edges.
    const spans = rand() >= opts.midEdges;
    const minW = spans ? Math.max(opts.minSize, (height * 1.1) / (TAN60 / 2)) : opts.minSize;
    let w = between(minW, Math.max(minW, opts.maxSize));
    // Height is capped at a regular-hexagon aspect (h <= w*0.866) so the 60° edges never collapse
    // into diamonds; triangles are exactly equilateral.
    const maxH = w * (TAN60 / 2);
    let h = Math.min(spans ? between(height * 1.05, height * 1.4) : between(height * 0.4, height * 1.4), maxH);
    if (name.startsWith('triangle')) h = maxH;
    let x = ((i + rand()) / opts.shapes) * (width + w) - w;
    let y = spans ? between(Math.min(0, height - h), 0) : between(-h * 0.5, height - h * 0.5);

    if (opts.grid > 0) {
      // Snap onto a triangular lattice (columns `grid` px apart, rows grid*0.866 apart, odd rows
      // offset by half a column). All 60° edges then lie on lattice lines, so edges either coincide
      // exactly or are at least grid/2 px apart: no hairline slivers between neighbours.
      const s = opts.grid;
      const rowH = (s * TAN60) / 2;
      let n = Math.max(2, Math.round(w / s));
      let k = Math.max(1, Math.round(h / rowH));
      if (spans) k = Math.max(k, Math.ceil((height * 1.02) / rowH));
      if (name.startsWith('triangle')) k = n;
      n = Math.max(n, k); // keeps hexagon/trapezoid insets within the width
      w = n * s;
      h = k * rowH;
      const j = spans
        ? Math.ceil((height - h) / rowH) + Math.floor(rand() * (1 - Math.ceil((height - h) / rowH)))
        : Math.round(y / rowH);
      y = j * rowH;
      const half = (((j % 2) + 2) % 2) * (s / 2);
      x = Math.round((x - half) / s) * s + half;
    }
    body.push(polygon(name, x, y, w, h, pick(colors), between(opts.minOpacity, opts.maxOpacity)));
  }

  // Opaque background-colored cutouts along the top or bottom edge.
  const cutouts = [];
  for (let i = 0; i < opts.cutouts; i++) {
    const w = between(opts.minSize, opts.maxSize * 0.9);
    const h = between(height * 0.1, height * 0.28);
    const x = between(-w * 0.3, width - w * 0.7);
    const top = rand() < 0.5;
    // wide side sits on the canvas edge
    cutouts.push(polygon(top ? 'trapezoidFlipped' : 'trapezoid', x, top ? -1 : height - h + 1, w, h, '#000', 1));
  }

  // Cutouts erase the shapes via a mask (black = hidden), so they're truly transparent when there's
  // no background rect, and show the background color when there is one.
  const style = opts.blend === 'multiply' ? ' style="mix-blend-mode:multiply"' : '';
  const bgRect = opts.background === 'transparent' ? '' : `\n  <rect width="${width}" height="${height}" fill="${opts.background}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice">
  <!-- generated by scripts/generate-banner.js (seed ${opts.seed}) -->
  <defs>
    <mask id="cutouts" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#fff"/>
      ${cutouts.join('\n      ')}
    </mask>
  </defs>${bgRect}
  <g mask="url(#cutouts)">
    <g${style}>
      ${body.join('\n      ')}
    </g>
  </g>
</svg>
`;
}

const opts = parseArgs(process.argv.slice(2));
const svg = generate(opts);
const png = new Resvg(svg, { fitTo: { mode: 'width', value: opts.width } }).render().asPng();
mkdirSync(dirname(opts.out), { recursive: true });
writeFileSync(`${opts.out}.svg`, svg);
writeFileSync(`${opts.out}.png`, png);
console.log(`Wrote ${opts.out}.svg and ${opts.out}.png (seed ${opts.seed}, ${opts.shapes} shapes, ${opts.cutouts} cutouts)`);
