import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const outDir = path.resolve('public/splash');
fs.mkdirSync(outDir, { recursive: true });

// Common iPhone/iPad splash screen sizes
const screens = [
  { w: 2048, h: 2732, name: 'splash-2048x2732.png' }, // iPad Pro 12.9
  { w: 1668, h: 2388, name: 'splash-1668x2388.png' }, // iPad Pro 11
  { w: 1536, h: 2048, name: 'splash-1536x2048.png' }, // iPad Air/Mini
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' }, // iPhone 15 Pro Max
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' }, // iPhone 15 Pro
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' }, // iPhone 14
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' }, // iPhone X/XS
  { w: 1080, h: 1920, name: 'splash-1080x1920.png' }, // iPhone 8+
  { w:  750, h: 1334, name: 'splash-750x1334.png'  }, // iPhone 8
];

const BG = { r: 1, g: 6, b: 3, alpha: 1 }; // #010603

// Snake emoji SVG centered on splash
const snakeSvg = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text
    x="50%" y="54%"
    dominant-baseline="middle" text-anchor="middle"
    font-size="${Math.round(size * 0.82)}"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >🐍</text>
</svg>`);

for (const { w, h, name } of screens) {
  const iconSize = Math.round(Math.min(w, h) * 0.22);
  const icon = await sharp(snakeSvg(iconSize)).png().toBuffer();

  await sharp({
    create: { width: w, height: h, channels: 4, background: BG },
  })
    .composite([{
      input: icon,
      gravity: 'center',
    }])
    .png()
    .toFile(path.join(outDir, name));

  console.log(`✓ ${name}`);
}

console.log('\nSplash screens generated in public/splash/');
