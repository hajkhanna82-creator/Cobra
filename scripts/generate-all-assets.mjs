import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Vector snake SVG — no emoji font needed, works on any server
const snakeSvg = (size, rounded = true) => {
  const r = rounded ? Math.round(size * 0.22) : 0;
  const s = size;
  const c = s / 2;
  const scale = s / 100;

  // Snake body as a coiled path, scaled to icon size
  // Drawn in a 100x100 coordinate space then scaled via viewBox
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 100 100">
  ${rounded ? `<rect width="100" height="100" rx="${Math.round(22)}" fill="#010603"/>` : `<rect width="100" height="100" fill="#010603"/>`}

  <!-- Snake body - coiled green snake -->
  <!-- Main coil -->
  <ellipse cx="50" cy="58" rx="28" ry="20" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>

  <!-- Tail coming off coil -->
  <path d="M22 58 Q10 58 10 46 Q10 36 20 36" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>

  <!-- Neck going up to head -->
  <path d="M78 58 Q90 58 90 46 Q90 34 78 30 Q70 27 62 30" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>

  <!-- Head -->
  <ellipse cx="54" cy="28" rx="14" ry="10" fill="#22c55e"/>

  <!-- Eye -->
  <circle cx="60" cy="25" r="3" fill="#010603"/>
  <circle cx="61" cy="24" r="1" fill="#fbbf24"/>

  <!-- Forked tongue -->
  <path d="M40 30 L32 28" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M32 28 L27 25" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 28 L27 31" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
</svg>`;
};

// ── PWA Icons ──────────────────────────────────────────────────────────────
const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [
  { name: 'icon-72.png',           size: 72,  maskable: false },
  { name: 'icon-96.png',           size: 96,  maskable: false },
  { name: 'icon-128.png',          size: 128, maskable: false },
  { name: 'icon-144.png',          size: 144, maskable: false },
  { name: 'icon-152.png',          size: 152, maskable: false },
  { name: 'icon-180.png',          size: 180, maskable: false },
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-384.png',          size: 384, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true  },
];

for (const { name, size, maskable } of sizes) {
  await sharp(Buffer.from(snakeSvg(size, !maskable)))
    .png()
    .toFile(path.join(iconsDir, name));
  console.log(`✓ icons/${name}`);
}

// ── Favicon ────────────────────────────────────────────────────────────────
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#010603"/>
  <ellipse cx="50" cy="58" rx="28" ry="20" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>
  <path d="M22 58 Q10 58 10 46 Q10 36 20 36" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>
  <path d="M78 58 Q90 58 90 46 Q90 34 78 30 Q70 27 62 30" fill="none" stroke="#4ade80" stroke-width="10" stroke-linecap="round"/>
  <ellipse cx="54" cy="28" rx="14" ry="10" fill="#22c55e"/>
  <circle cx="60" cy="25" r="3" fill="#010603"/>
  <circle cx="61" cy="24" r="1" fill="#fbbf24"/>
  <path d="M40 30 L32 28" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M32 28 L27 25" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 28 L27 31" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.resolve('public/favicon.svg'), faviconSvg);
console.log('✓ favicon.svg');

const publicDir = path.resolve('public');
const pngs = await Promise.all(
  [16, 32, 48].map(async (size) => {
    const buf = await sharp(Buffer.from(snakeSvg(size))).png().toBuffer();
    await sharp(Buffer.from(snakeSvg(size))).png().toFile(path.join(publicDir, `favicon-${size}.png`));
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

console.log('\nAll assets generated.');
