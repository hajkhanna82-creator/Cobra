import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const applePng = path.resolve('node_modules/emoji-datasource-apple/img/apple/64/1f40d.png');

// Snake on dark rounded background
const makeIcon = async (size, rounded = true) => {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  const rx = rounded ? Math.round(size * 0.22) : 0;

  const bg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="#010603"/></svg>`
  );
  const snake = await sharp(applePng).resize(inner, inner).png().toBuffer();

  return sharp(bg)
    .composite([{ input: snake, left: pad, top: pad }])
    .png()
    .toBuffer();
};

// ── PWA Icons ──────────────────────────────────────────────────────────────
const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const iconSizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
for (const size of iconSizes) {
  const buf = await makeIcon(size);
  await sharp(buf).toFile(path.join(iconsDir, `icon-${size}.png`));
  console.log(`✓ icons/icon-${size}.png`);
}
// maskable — no rounding
const maskable = await makeIcon(512, false);
await sharp(maskable).toFile(path.join(iconsDir, 'icon-512-maskable.png'));
console.log('✓ icons/icon-512-maskable.png');

// ── Favicon ────────────────────────────────────────────────────────────────
const publicDir = path.resolve('public');

const pngs = await Promise.all(
  [16, 32, 48].map(async (size) => {
    const buf = await makeIcon(size);
    await sharp(buf).toFile(path.join(publicDir, `favicon-${size}.png`));
    console.log(`✓ favicon-${size}.png`);
    return { size, buf };
  })
);

// ICO
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

// SVG favicon just references the 32px png as base64
const b64 = (await makeIcon(32)).toString('base64');
fs.writeFileSync(path.join(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32"><image width="32" height="32" xlink:href="data:image/png;base64,${b64}"/></svg>`
);
console.log('✓ favicon.svg');

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
  const icon = await makeIcon(iconSize);
  await sharp({ create: { width: w, height: h, channels: 4, background: { r:1, g:6, b:3, alpha:1 } } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(path.join(splashDir, name));
  console.log(`✓ splash/${name}`);
}

console.log('\nAll assets generated with Apple 🐍');
