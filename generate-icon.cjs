// Generate a simple app icon using pure Node.js
// Creates a 256x256 PNG with a space-themed design
const fs = require('fs');
const path = require('path');

// Minimal PNG encoder - creates a valid PNG file
function createPNG(width, height, pixels) {
    // PNG signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // color type (RGB)
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    // Raw image data with filter bytes
    const rawData = Buffer.alloc(height * (width * 3 + 1));
    for (let y = 0; y < height; y++) {
        rawData[y * (width * 3 + 1)] = 0; // No filter
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 3;
            const rawIdx = y * (width * 3 + 1) + 1 + x * 3;
            rawData[rawIdx] = pixels[idx];
            rawData[rawIdx + 1] = pixels[idx + 1];
            rawData[rawIdx + 2] = pixels[idx + 2];
        }
    }

    // Compress with zlib
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(rawData);

    // Build chunks
    const chunks = [];
    chunks.push(makeChunk('IHDR', ihdr));
    chunks.push(makeChunk('IDAT', compressed));
    chunks.push(makeChunk('IEND', Buffer.alloc(0)));

    return Buffer.concat([signature, ...chunks]);
}

function makeChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
    let table = [];
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

const SIZE = 256;
const pixels = Buffer.alloc(SIZE * SIZE * 3);

// Draw the icon
for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
        const idx = (y * SIZE + x) * 3;

        // Normalized coordinates
        const nx = x / SIZE;
        const ny = y / SIZE;

        // Dark space background with subtle gradient
        let r = Math.floor(5 + ny * 15);
        let g = Math.floor(5 + ny * 10);
        let b = Math.floor(15 + ny * 25);

        // Subtle grid lines
        if (x % 24 === 0 || y % 24 === 0) {
            r = Math.min(255, r + 12);
            g = Math.min(255, g + 12);
            b = Math.min(255, b + 15);
        }

        // White glowing sphere (center-left)
        const cx1 = SIZE * 0.38, cy1 = SIZE * 0.48;
        const radius1 = SIZE * 0.18;
        const dist1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2);
        if (dist1 < radius1) {
            const intensity = 1 - (dist1 / radius1) ** 1.5;
            r = Math.min(255, Math.floor(r + 255 * intensity));
            g = Math.min(255, Math.floor(g + 255 * intensity));
            b = Math.min(255, Math.floor(b + 255 * intensity));
        } else if (dist1 < radius1 * 2.5) {
            // Glow around the sphere
            const glow = Math.max(0, 1 - (dist1 - radius1) / (radius1 * 1.5));
            const glowI = glow ** 3;
            r = Math.min(255, Math.floor(r + 100 * glowI));
            g = Math.min(255, Math.floor(g + 100 * glowI));
            b = Math.min(255, Math.floor(b + 120 * glowI));
        }

        // Purple sphere (right side)
        const cx2 = SIZE * 0.7, cy2 = SIZE * 0.52;
        const radius2 = SIZE * 0.1;
        const dist2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
        if (dist2 < radius2) {
            const intensity = 1 - (dist2 / radius2) ** 1.5;
            r = Math.min(255, Math.floor(r + 160 * intensity));
            g = Math.min(255, Math.floor(g + 80 * intensity));
            b = Math.min(255, Math.floor(b + 255 * intensity));
        } else if (dist2 < radius2 * 2) {
            const glow = Math.max(0, 1 - (dist2 - radius2) / radius2);
            const glowI = glow ** 3;
            r = Math.min(255, Math.floor(r + 60 * glowI));
            g = Math.min(255, Math.floor(g + 20 * glowI));
            b = Math.min(255, Math.floor(b + 80 * glowI));
        }

        // Small red dots (top-left for health indicator feel)
        const dots = [
            [SIZE * 0.08, SIZE * 0.12],
            [SIZE * 0.08, SIZE * 0.18],
            [SIZE * 0.08, SIZE * 0.24],
            [SIZE * 0.08, SIZE * 0.30],
            [SIZE * 0.08, SIZE * 0.36],
        ];
        for (const [dx, dy] of dots) {
            const dd = Math.sqrt((x - dx) ** 2 + (y - dy) ** 2);
            if (dd < 4) {
                r = Math.min(255, 220);
                g = Math.min(255, 50);
                b = Math.min(255, 50);
            }
        }

        // Rounded corners (mask)
        const cornerRadius = SIZE * 0.18;
        const corners = [
            [cornerRadius, cornerRadius],
            [SIZE - cornerRadius, cornerRadius],
            [cornerRadius, SIZE - cornerRadius],
            [SIZE - cornerRadius, SIZE - cornerRadius],
        ];
        let inCorner = false;
        for (const [ccx, ccy] of corners) {
            if ((x < cornerRadius && y < cornerRadius) ||
                (x > SIZE - cornerRadius && y < cornerRadius) ||
                (x < cornerRadius && y > SIZE - cornerRadius) ||
                (x > SIZE - cornerRadius && y > SIZE - cornerRadius)) {
                const cd = Math.sqrt((x - ccx) ** 2 + (y - ccy) ** 2);
                if (cd > cornerRadius) {
                    inCorner = true;
                }
            }
        }
        if (inCorner) {
            r = 0; g = 0; b = 0;
        }

        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
    }
}

const png = createPNG(SIZE, SIZE, pixels);
const outputPath = path.join(__dirname, 'build', 'icon.png');
fs.writeFileSync(outputPath, png);
console.log(`Icon generated: ${outputPath} (${png.length} bytes)`);
