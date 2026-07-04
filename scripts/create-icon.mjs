import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const size = 256;
const pixels = new Uint8ClampedArray(size * size * 4);

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (y * size + x) * 4;
  pixels[index] = color.r;
  pixels[index + 1] = color.g;
  pixels[index + 2] = color.b;
  pixels[index + 3] = color.a;
}

function fillRoundedRect(x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const cx = px < x + radius ? x + radius : px >= x + width - radius ? x + width - radius - 1 : px;
      const cy = py < y + radius ? y + radius : py >= y + height - radius ? y + height - radius - 1 : py;
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(px, py, color);
      }
    }
  }
}

function fillCircle(cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(x, y, color);
      }
    }
  }
}

function line(x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    fillCircle(x, y, Math.floor(width / 2), color);
  }
}

const white = { r: 255, g: 255, b: 255, a: 255 };
const border = { r: 232, g: 234, b: 237, a: 255 };
const page = { r: 248, g: 250, b: 252, a: 255 };
const cover = { r: 66, g: 133, b: 244, a: 255 };
const spine = { r: 32, g: 94, b: 197, a: 255 };
const bookmark = { r: 234, g: 67, b: 53, a: 255 };
const bookmarkShade = { r: 197, g: 42, b: 30, a: 255 };
const ink = { r: 32, g: 33, b: 36, a: 255 };

fillRoundedRect(24, 24, 208, 208, 52, white);
fillRoundedRect(27, 27, 202, 202, 48, border);
fillRoundedRect(31, 31, 194, 194, 45, white);

fillRoundedRect(62, 55, 132, 151, 20, cover);
fillRoundedRect(76, 68, 103, 125, 14, page);
fillRoundedRect(62, 55, 28, 151, 18, spine);
fillRoundedRect(145, 68, 26, 94, 6, bookmark);
fillCircle(151, 163, 6, bookmark);
fillCircle(165, 163, 6, bookmark);
fillRoundedRect(148, 68, 8, 93, 4, bookmarkShade);

line(103, 102, 134, 102, 7, border);
line(103, 126, 134, 126, 7, border);
line(103, 150, 128, 150, 7, border);
fillRoundedRect(92, 183, 84, 10, 5, ink);

mkdirSync("resources", { recursive: true });
writeFileSync(join("resources", "icon.svg"), renderSvg());
writeFileSync(join("resources", "icon.ico"), renderIco());

function renderSvg() {
  return `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="24" y="24" width="208" height="208" rx="52" fill="#ffffff"/>
  <rect x="27" y="27" width="202" height="202" rx="48" fill="#e8eaed"/>
  <rect x="31" y="31" width="194" height="194" rx="45" fill="#ffffff"/>
  <rect x="62" y="55" width="132" height="151" rx="20" fill="#4285f4"/>
  <rect x="76" y="68" width="103" height="125" rx="14" fill="#f8fafc"/>
  <rect x="62" y="55" width="28" height="151" rx="18" fill="#205ec5"/>
  <path d="M145 68h26v96l-13-12-13 12V68Z" fill="#ea4335"/>
  <path d="M149 68h8v88l-8 8V68Z" fill="#c52a1e"/>
  <path d="M103 102h31M103 126h31M103 150h25" stroke="#e8eaed" stroke-width="7" stroke-linecap="round"/>
  <rect x="92" y="183" width="84" height="10" rx="5" fill="#202124"/>
</svg>
`;
}

function renderIco() {
  const bitmapHeaderSize = 40;
  const xorSize = size * size * 4;
  const maskRowSize = Math.ceil(size / 32) * 4;
  const maskSize = maskRowSize * size;
  const imageSize = bitmapHeaderSize + xorSize + maskSize;
  const buffer = Buffer.alloc(6 + 16 + imageSize);
  let offset = 0;

  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(32, offset); offset += 2;
  buffer.writeUInt32LE(imageSize, offset); offset += 4;
  buffer.writeUInt32LE(22, offset); offset += 4;

  buffer.writeUInt32LE(bitmapHeaderSize, offset); offset += 4;
  buffer.writeInt32LE(size, offset); offset += 4;
  buffer.writeInt32LE(size * 2, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(32, offset); offset += 2;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(xorSize, offset); offset += 4;
  buffer.writeInt32LE(0, offset); offset += 4;
  buffer.writeInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;

  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const source = (y * size + x) * 4;
      buffer[offset] = pixels[source + 2];
      buffer[offset + 1] = pixels[source + 1];
      buffer[offset + 2] = pixels[source];
      buffer[offset + 3] = pixels[source + 3];
      offset += 4;
    }
  }

  return buffer;
}
