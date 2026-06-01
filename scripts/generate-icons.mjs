import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/icons');
fs.mkdirSync(outDir, { recursive: true });

// Snake emoji on transparent background
const svgIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="${Math.round(size * 0.82)}"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >🐍</text>
</svg>`;

// Maskable icon — needs opaque background so OS doesn't clip to transparency
// Keep dark green for maskable so it looks good on adaptive icon shapes
const svgMaskable = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#010603"/>
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="${Math.round(size * 0.55)}"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >🐍</text>
</svg>`;

const sizes = [
  { name: 'icon-72.png',   size: 72,  maskable: false },
  { name: 'icon-96.png',   size: 96,  maskable: false },
  { name: 'icon-128.png',  size: 128, maskable: false },
  { name: 'icon-144.png',  size: 144, maskable: false },
  { name: 'icon-152.png',  size: 152, maskable: false },
  { name: 'icon-180.png',  size: 180, maskable: false }, // apple-touch-icon
  { name: 'icon-192.png',  size: 192, maskable: false },
  { name: 'icon-384.png',  size: 384, maskable: false },
  { name: 'icon-512.png',  size: 512, maskable: false },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
];

for (const { name, size, maskable } of sizes) {
  const svg = maskable ? svgMaskable(size) : svgIcon(size);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(outDir, name));
  console.log(`✓ ${name}`);
}

console.log('\nAll icons generated in public/icons/');
