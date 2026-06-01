import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real Twemoji 🐍 SVG (unicode 1f40d) on dark background
const twemojiSnake = fs.readFileSync(
  path.resolve('node_modules/@twemoji/svg/1f40d.svg'), 'utf8'
);

// Wrap in a sized container with dark background and padding
const snakeSvg = (size, withBg = true) => {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${withBg ? `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#010603"/>` : ''}
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 36 36">
    ${twemojiSnake.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </svg>
</svg>`;
};

// ── PWA Icons ──────────────────────────────────────────────────────────────
const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const iconSizes = [
  { name: 'icon-72.png',           size: 72  },
  { name: 'icon-96.png',           size: 96  },
  { name: 'icon-128.png',          size: 128 },
  { name: 'icon-144.png',          size: 144 },
  { name: 'icon-152.png',          size: 152 },
  { name: 'icon-180.png',          size: 180 },
  { name: 'icon-192.png',          size: 192 },
  { name: 'icon-384.png',          size: 384 },
  { name: 'icon-512.png',          size: 512 },
  { name: 'icon-512-maskable.png', size: 512 },
];

for (const { name, size } of iconSizes) {
  await sharp(Buffer.from(snakeSvg(size, true)))
    .png()
    .toFile(path.join(iconsDir, name));
  console.log(`✓ icons/${name}`);
}

// ── Favicon ────────────────────────────────────────────────────────────────
const publicDir = path.resolve('public');

// SVG favicon (browser tab)
const faviconSvgContent = snakeSvg(32, true);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvgContent);
console.log('✓ favicon.svg');

const pngs = await Promise.all(
  [16, 32, 48].map(async (size) => {
    const buf = await sharp(Buffer.from(snakeSvg(size, true))).png().toBuffer();
    await sharp(Buffer.from(snakeSvg(size, true))).png().toFile(path.join(publicDir, `favicon-${size}.png`));
    console.log(`✓ favicon-${size}.png`);
    return { size, buf };
  })
);

// Build ICO
const ICONDIR_SIZE = 6, ENTRY_SIZE = 16, count = pngs.length;
const headerSize = ICONDIR_SIZE + ENTRY_SIZE * count;
let offset = headerSize;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
pngs.forEach(({ size, buf }, i) => {
  const b = ICONDIR_SIZE + i * ENTRY_SIZE;
  header.writeUInt8(size, b); header.writeUInt8(size, b+1);
  header.writeUInt8(0, b+2); header.writeUInt8(0, b+3);
  header.writeUInt16LE(1, b+4); header.writeUInt16LE(32, b+6);
  header.writeUInt32LE(buf.length, b+8); header.writeUInt32LE(offset, b+12);
  offset += buf.length;
});
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...pngs.map(p => p.buf)]));
console.log('✓ favicon.ico');

// ── Splash Screens ─────────────────────────────────────────────────────────
const splashDir = path.resolve('public/splash');
fs.mkdirSync(splashDir, { recursive: true });

const screens = [
  { w: 2048, h: 2732, name: 'splash-2048x2732.png' },
  { w: 1668, h: 2388, name: 'splash-1668x2388.png' },
  { w: 1536, h: 2048, name: 'splash-1536x2048.png' },
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' },
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' },
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' },
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' },
  { w: 1080, h: 1920, name: 'splash-1080x1920.png' },
  { w:  750, h: 1334, name: 'splash-750x1334.png'  },
];

for (const { w, h, name } of screens) {
  const iconSize = Math.round(Math.min(w, h) * 0.28);
  const icon = await sharp(Buffer.from(snakeSvg(iconSize, true))).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: { r:1, g:6, b:3, alpha:1 } } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(path.join(splashDir, name));
  console.log(`✓ splash/${name}`);
}

console.log('\nAll assets generated with real Twemoji 🐍');
