// Gera os ícones PNG do PWA (sem dependências externas).
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "icons");

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, y * w * 4 + w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function roundRect(x, y, x0, x1, y0, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  if (x < x0 + r && y < y0 + r) return (x - (x0 + r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r;
  if (x > x1 - r && y < y0 + r) return (x - (x1 - r)) ** 2 + (y - (y0 + r)) ** 2 <= r * r;
  if (x < x0 + r && y > y1 - r) return (x - (x0 + r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r;
  if (x > x1 - r && y > y1 - r) return (x - (x1 - r)) ** 2 + (y - (y1 - r)) ** 2 <= r * r;
  return true;
}

function makeIcon(N) {
  const buf = Buffer.alloc(N * N * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  const accent = [224, 112, 60];
  const white = [255, 255, 255];
  const coffee = [127, 75, 57];
  const steam = [255, 224, 200];

  // fundo cheio (maskable-friendly)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) set(x, y, accent);

  const bx0 = 0.3 * N,
    bx1 = 0.63 * N,
    by0 = 0.4 * N,
    by1 = 0.68 * N,
    br = 0.05 * N;
  const hx = bx1 + 0.01 * N,
    hy = (by0 + by1) / 2,
    hOuter = 0.11 * N,
    hInner = 0.062 * N;

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dh = Math.hypot(x - hx, y - hy);
      if (dh <= hOuter && dh >= hInner && x >= hx - 0.02 * N) set(x, y, white);
      if (roundRect(x, y, bx0, bx1, by0, by1, br)) set(x, y, white);
    }

  // superfície do café
  const ex = (bx0 + bx1) / 2,
    ey = by0 + 0.045 * N,
    erx = (bx1 - bx0) / 2 - 0.02 * N,
    ery = 0.03 * N;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2 <= 1) set(x, y, coffee);
    }

  // pires
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (roundRect(x, y, 0.24 * N, 0.69 * N, 0.71 * N, 0.76 * N, 0.025 * N)) set(x, y, white);
    }

  // vapor
  for (const f of [0.4, 0.465, 0.53]) {
    const sxc = f * N;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (roundRect(x, y, sxc - 0.014 * N, sxc + 0.014 * N, 0.22 * N, 0.36 * N, 0.014 * N))
          set(x, y, steam);
      }
  }

  return encodePNG(N, N, buf);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), makeIcon(size));
  console.log(`gerado icon-${size}.png`);
}
