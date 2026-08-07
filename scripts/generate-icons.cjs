// Simple script to generate Tauri icons using Node.js
// This creates minimal valid PNG files with a solid color

const fs = require('fs');
const path = require('path');

function createMinimalPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdr = createChunk('IHDR', ihdrData);
  
  // Create raw image data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return crc ^ 0xFFFFFFFF;
}

const iconsDir = path.join(__dirname, '../src-tauri/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons with dark blue color (#1a1a2e)
const sizes = [32, 128, 256];
for (const size of sizes) {
  const png = createMinimalPNG(size, size, 26, 26, 46);
  fs.writeFileSync(path.join(iconsDir, `${size}x${size}.png`), png);
  console.log(`Created ${size}x${size}.png`);
}

// Create 128x128@2x (256x256)
const png2x = createMinimalPNG(256, 256, 26, 26, 46);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), png2x);
console.log('Created 128x128@2x.png');

// Generate ICO file (Windows)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type (1 = ICO)
icoHeader.writeUInt16LE(1, 4); // count

const icoEntry = Buffer.alloc(16);
icoEntry[0] = 128; // width
icoEntry[1] = 128; // height
icoEntry[2] = 0; // colors
icoEntry[3] = 0; // reserved
icoEntry.writeUInt16LE(1, 4); // planes
icoEntry.writeUInt16LE(32, 6); // bits per pixel
icoEntry.writeUInt32LE(png2x.length, 8); // size
icoEntry.writeUInt32LE(22, 12); // offset

const ico = Buffer.concat([icoHeader, icoEntry, png2x]);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
console.log('Created icon.ico');

console.log('\nAll icons generated successfully!');
