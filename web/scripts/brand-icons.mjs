// Renders every raster brand icon from app/icon.svg (the single source of
// truth). Run after changing the mark:  node scripts/brand-icons.mjs
// Uses sharp, which ships with Next.js.
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "app/icon.svg"));
const pub = join(root, "public");
mkdirSync(join(pub, "icons"), { recursive: true });

// Maskable icons are cropped to a circle/squircle by the launcher: full-bleed
// tile, with the mark scaled into the 80% safe zone.
function maskableSvg(src) {
  const text = src.toString();
  const a = text.indexOf("<!-- mark:start -->");
  const b = text.indexOf("<!-- mark:end -->");
  const mark = text.slice(a, b);
  return Buffer.from(
    text
      .replace(mark, `<g transform="translate(51.2 51.2) scale(0.8)">${mark}</g>`)
      .replaceAll('rx="116"', 'rx="0"'),
  );
}

async function png(size, out, { maskable = false } = {}) {
  const src = maskable ? maskableSvg(svg) : svg;
  await sharp(src, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(pub, out));
  console.log("wrote", out);
}

// ICO container holding PNG-encoded 16/32/48 images (supported by every
// current browser and by Windows).
async function ico(sizes, out) {
  const imgs = [];
  for (const s of sizes) imgs.push({ s, buf: await sharp(svg, { density: 384 }).resize(s, s).png().toBuffer() });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
  const dir = [];
  let offset = 6 + 16 * imgs.length;
  for (const { s, buf } of imgs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(s >= 256 ? 0 : s, 0); e.writeUInt8(s >= 256 ? 0 : s, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    offset += buf.length; dir.push(e);
  }
  writeFileSync(join(pub, out), Buffer.concat([header, ...dir, ...imgs.map((i) => i.buf)]));
  console.log("wrote", out);
}

await png(192, "icons/icon-192.png");
await png(512, "icons/icon-512.png");
await png(512, "icons/icon-maskable-512.png", { maskable: true });
await png(180, "apple-touch-icon.png");
await png(192, "push-icon.png");
await ico([16, 32, 48], "favicon.ico");
