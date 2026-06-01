import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

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

for (const size of [16, 32, 48]) {
  const out = path.join(publicDir, `favicon-${size}.png`);
  await sharp(Buffer.from(svgIcon(size))).png().toFile(out);
  console.log(`✓ favicon-${size}.png`);
}

const pngs = await Promise.all(
  [16, 32, 48].map(async (size) => {
    const buf = await sharp(Buffer.from(svgIcon(size))).png().toBuffer();
    return { size, buf };
  })
);

const ICONDIR_SIZE = 6;
const ENTRY_SIZE = 16;
const count = pngs.length;
const headerSize = ICONDIR_SIZE + ENTRY_SIZE * count;

let offset = headerSize;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(count, 4);

pngs.forEach(({ size, buf }, i) => {
  const base = ICONDIR_SIZE + i * ENTRY_SIZE;
  header.writeUInt8(size === 256 ? 0 : size, base + 0);
  header.writeUInt8(size === 256 ? 0 : size, base + 1);
  header.writeUInt8(0, base + 2);
  header.writeUInt8(0, base + 3);
  header.writeUInt16LE(1, base + 4);
  header.writeUInt16LE(32, base + 6);
  header.writeUInt32LE(buf.length, base + 8);
  header.writeUInt32LE(offset, base + 12);
  offset += buf.length;
});

const icoOut = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(icoOut, Buffer.concat([header, ...pngs.map((p) => p.buf)]));
console.log('✓ favicon.ico');
