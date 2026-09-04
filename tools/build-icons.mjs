#!/usr/bin/env node
// Regenerates every PNG in icons/ from the single source icons/icon.svg.
//
// The shipped app never runs this — the PNGs are committed. Run it only after
// editing icon.svg:   node tools/build-icons.mjs
//
// macOS-only: rasterising uses qlmanage (QuickLook), which renders SVG without
// pulling a rendering library into a repo that deliberately has no build step.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'icons');
const SRC = join(ICONS, 'icon.svg');

// Android crops maskable icons to a circle/squircle, keeping only the central
// 80%. Scale the art to 72% and recentre it so nothing important is cropped.
// The art's own bounding box is centred on y=249, not 256, hence the offset.
const MASKABLE_SCALE = 0.72;
const ART_CENTRE_Y = 249;

const svg = readFileSync(SRC, 'utf8');

// qlmanage renders an *error page* for malformed SVG rather than failing, and
// that page is still the requested pixel size -- so the dimension check below
// would happily pass. Parse first. (A stray "--" inside an XML comment is the
// easy way to trip this.)
const problems = [];
try {
  new DOMParser({
    onError: (level, msg) => { if (level !== 'warning') problems.push(`${level}: ${msg}`); },
  }).parseFromString(svg, 'image/svg+xml');
} catch (err) {
  problems.push(err.message); // xmldom throws on fatal errors rather than reporting them
}
if (problems.length) {
  console.error(`icons/icon.svg is not valid XML:\n  ${problems.join('\n  ')}`);
  console.error('\n(A stray "--" inside an XML comment is the usual cause.)');
  process.exit(1);
}
// Anchor to the group's own line. The header comment also mentions <g id="art">,
// and it comes first in the file -- an unanchored replace patches the comment and
// silently leaves the art untransformed.
const OPEN_TAG = /^([ \t]*)<g id="art">[ \t]*$/m;
if (!OPEN_TAG.test(svg)) {
  console.error('icons/icon.svg: no line containing only <g id="art">; cannot derive the maskable icon.');
  process.exit(1);
}

const maskable = svg.replace(
  OPEN_TAG,
  `$1<g id="art" transform="translate(256,256) scale(${MASKABLE_SCALE}) translate(-256,-${ART_CENTRE_Y})">`,
);
if (maskable === svg) {
  console.error('icons/icon.svg: maskable transform did not apply; it would be a copy of the plain icon.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'sr6-icons-'));
const maskableSrc = join(work, 'maskable.svg');
writeFileSync(maskableSrc, maskable);

// [source svg, output filename, pixel size]
const TARGETS = [
  [SRC, 'icon-192.png', 192],
  [SRC, 'icon-512.png', 512],
  [SRC, 'apple-touch-icon.png', 180], // iOS home screen; iOS rounds the corners itself
  [SRC, 'favicon-32.png', 32],
  [maskableSrc, 'icon-maskable-512.png', 512],
];

for (const [src, out, size] of TARGETS) {
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', work, src], { stdio: 'ignore' });
  const produced = join(work, `${src.split('/').pop()}.png`);
  const dest = join(ICONS, out);
  renameSync(produced, dest);
  const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', dest], { encoding: 'utf8' });
  const w = +dims.match(/pixelWidth: (\d+)/)[1];
  const h = +dims.match(/pixelHeight: (\d+)/)[1];
  if (w !== size || h !== size) throw new Error(`${out}: expected ${size}x${size}, got ${w}x${h}`);
  console.log(`${out.padEnd(24)} ${w}x${h}`);
}

rmSync(work, { recursive: true, force: true });
console.log('\nDone. Remember to bump CACHE in sw.js if you added or renamed a file.');
