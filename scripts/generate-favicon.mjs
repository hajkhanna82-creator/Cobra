import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

const svgIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#010603"/>
  <text
    x="50%"
    y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-size="${Math.round(size * 0.62)}"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >🐍</text>
</svg>`;

// Generate favicon-16.png and favicon-32.png
for (const size of [16, 32, 48]) {
  const out = path.join(publicDir, `favicon-${size}.png`);
  await sharp(Buffer.from(svgIcon(size))).png().toFile(out);
  console.log(`✓ favicon-${size}.png`);
}

// Build a minimal ICO file: concatenate 16x16 and 32x32 PNGs inside ICO wrapper
// ICO format: ICONDIR + ICONDIRENTRY[] + image data
const pngs = await Promise.all(
  [16, 32, 48].map(async (size) => {
    const buf = await sharp(Buffer.from(svgIcon(size))).png().toBuffer();
    return { size, buf };
  })
);

const ICONDIR_SIZE = 6;          // WORD reserved, WORD type, WORD count
const ENTRY_SIZE = 16;           // per ICONDIRENTRY
const count = pngs.length;
const headerSize = ICONDIR_SIZE + ENTRY_SIZE * count;

let offset = headerSize;
const header = Buffer.alloc(headerSize);
// ICONDIR
header.writeUInt16LE(0, 0);      // reserved
header.writeUInt16LE(1, 2);      // type = 1 (ICO)
header.writeUInt16LE(count, 4);  // count

pngs.forEach(({ size, buf }, i) => {
  const base = ICONDIR_SIZE + i * ENTRY_SIZE;
  header.writeUInt8(size === 256 ? 0 : size, base + 0);  // width (0 = 256)
  header.writeUInt8(size === 256 ? 0 : size, base + 1);  // height
  header.writeUInt8(0, base + 2);   // color count
  header.writeUInt8(0, base + 3);   // reserved
  header.writeUInt16LE(1, base + 4); // planes
  header.writeUInt16LE(32, base + 6); // bit count
  header.writeUInt32LE(buf.length, base + 8);  // bytes in image
  header.writeUInt32LE(offset, base + 12);     // offset of image data
  offset += buf.length;
});

const icoOut = path.join(publicDir, 'favicon.ico');
fs.writeFileSync(icoOut, Buffer.concat([header, ...pngs.map((p) => p.buf)]));
console.log('✓ favicon.ico');
