// Gera as artes dos NFTs de forma determinística (seed fixa) em WebP.
// Substitui os assets do Figma, que não estavam acessíveis durante a implementação.
// Uso: node scripts/generate-artwork.mjs
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "nft");
mkdirSync(outDir, { recursive: true });

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const palettes = [
  ["#140D0A", "#2E5E4E", "#7FB685", "#E89B55", "#F5F1EB"],
  ["#1B1020", "#4B2D6B", "#9D6BC9", "#E89B55", "#F7F3EC"],
  ["#0E1620", "#1F4E79", "#4FA3D1", "#D28A4C", "#F5F1EB"],
  ["#140D0A", "#6B2E1F", "#C8553D", "#F2C14E", "#F7F3EC"],
  ["#101410", "#33503A", "#A3C585", "#CFB28C", "#FBFBFB"],
  ["#1A0F14", "#7A2E4A", "#E26D8D", "#F2B880", "#F7F3EC"],
  ["#0F1418", "#264653", "#2A9D8F", "#E9C46A", "#F4A261"],
  ["#140D0A", "#38220F", "#B39463", "#E89B55", "#F5F1EB"],
];

function artwork(index, size = 800) {
  const rand = mulberry32(index * 9973 + 17);
  const pal = palettes[index % palettes.length];
  const pick = () => pal[1 + Math.floor(rand() * (pal.length - 1))];
  const parts = [];
  const variant = index % 4;

  parts.push(`<defs>
    <radialGradient id="bg" cx="${30 + rand() * 40}%" cy="${20 + rand() * 40}%" r="90%">
      <stop offset="0%" stop-color="${pal[1]}"/>
      <stop offset="100%" stop-color="${pal[0]}"/>
    </radialGradient>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pal[3]}"/>
      <stop offset="100%" stop-color="${pal[2]}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${index}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.08"/></feComponentTransfer>
      <feBlend in2="SourceGraphic" mode="overlay"/></filter>
    <filter id="blur"><feGaussianBlur stdDeviation="${18 + rand() * 20}"/></filter>
  </defs>`);
  parts.push(`<rect width="${size}" height="${size}" fill="url(#bg)"/>`);

  // Blobs desfocados de fundo
  for (let i = 0; i < 4; i++) {
    parts.push(
      `<circle cx="${rand() * size}" cy="${rand() * size}" r="${80 + rand() * 180}" fill="${pick()}" opacity="${0.25 + rand() * 0.35}" filter="url(#blur)"/>`,
    );
  }

  const cx = size / 2 + (rand() - 0.5) * 120;
  const cy = size / 2 + (rand() - 0.5) * 120;

  if (variant === 0) {
    // Sol com anéis concêntricos
    for (let r = 300; r > 40; r -= 26 + rand() * 18) {
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${pick()}" stroke-width="${3 + rand() * 9}" opacity="${0.5 + rand() * 0.5}"/>`,
      );
    }
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${60 + rand() * 40}" fill="url(#g1)"/>`,
    );
  } else if (variant === 1) {
    // Montanhas em camadas
    for (let layer = 0; layer < 5; layer++) {
      const baseY = size * (0.45 + layer * 0.11);
      let d = `M0 ${size} L0 ${baseY}`;
      for (let x = 0; x <= size; x += size / 8) {
        d += ` L${x} ${baseY - rand() * 140 + layer * 6}`;
      }
      d += ` L${size} ${size} Z`;
      parts.push(
        `<path d="${d}" fill="${pal[(layer % (pal.length - 1)) + 1]}" opacity="${0.55 + layer * 0.09}"/>`,
      );
    }
    parts.push(
      `<circle cx="${cx}" cy="${size * 0.28}" r="${50 + rand() * 30}" fill="${pal[4]}" opacity="0.9"/>`,
    );
  } else if (variant === 2) {
    // Grade de formas geométricas
    const cells = 5;
    const step = size / cells;
    for (let gx = 0; gx < cells; gx++) {
      for (let gy = 0; gy < cells; gy++) {
        const x = gx * step;
        const y = gy * step;
        const c = pick();
        const kind = Math.floor(rand() * 3);
        if (kind === 0)
          parts.push(
            `<circle cx="${x + step / 2}" cy="${y + step / 2}" r="${step * (0.2 + rand() * 0.25)}" fill="${c}"/>`,
          );
        else if (kind === 1)
          parts.push(
            `<path d="M${x} ${y + step} A${step} ${step} 0 0 1 ${x + step} ${y}" fill="none" stroke="${c}" stroke-width="${6 + rand() * 10}"/>`,
          );
        else
          parts.push(
            `<rect x="${x + step * 0.2}" y="${y + step * 0.2}" width="${step * 0.6}" height="${step * 0.6}" rx="${rand() * 20}" fill="${c}" opacity="0.85" transform="rotate(${rand() * 45} ${x + step / 2} ${y + step / 2})"/>`,
          );
      }
    }
  } else {
    // Retrato abstrato (cabeça + olhos), lembrando as coleções de avatares
    const headR = 200 + rand() * 40;
    parts.push(
      `<ellipse cx="${cx}" cy="${cy + 40}" rx="${headR}" ry="${headR * 1.08}" fill="url(#g1)"/>`,
    );
    parts.push(
      `<rect x="${cx - headR * 0.8}" y="${cy - 30}" width="${headR * 1.6}" height="${46}" rx="23" fill="${pal[0]}" opacity="0.85"/>`,
    );
    parts.push(
      `<circle cx="${cx - headR * 0.35}" cy="${cy - 7}" r="14" fill="${pal[4]}"/>`,
    );
    parts.push(
      `<circle cx="${cx + headR * 0.35}" cy="${cy - 7}" r="14" fill="${pal[4]}"/>`,
    );
    parts.push(
      `<path d="M${cx - 60} ${cy + 120} Q${cx} ${cy + 160 + rand() * 30} ${cx + 60} ${cy + 120}" stroke="${pal[0]}" stroke-width="12" fill="none" stroke-linecap="round"/>`,
    );
    for (let i = 0; i < 7; i++) {
      parts.push(
        `<path d="M${cx - headR + i * headR * 0.33} ${cy - headR * 0.95} l${-20 + rand() * 40} ${-60 - rand() * 60}" stroke="${pick()}" stroke-width="16" stroke-linecap="round"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g filter="url(#grain)">${parts.join("")}</g></svg>`;
}

const COUNT = 24;
for (let i = 1; i <= COUNT; i++) {
  const svg = Buffer.from(artwork(i));
  const name = `art-${String(i).padStart(2, "0")}`;
  await sharp(svg)
    .resize(640, 640)
    .webp({ quality: 74 })
    .toFile(join(outDir, `${name}.webp`));
  await sharp(svg)
    .resize(320, 320)
    .webp({ quality: 70 })
    .toFile(join(outDir, `${name}-sm.webp`));
}

// Arte do hero (proporção larga)
const heroSvg = Buffer.from(artwork(7, 800));
await sharp(heroSvg)
  .resize(560, 560)
  .webp({ quality: 76 })
  .toFile(join(outDir, "hero.webp"));
await sharp(Buffer.from(artwork(11, 800)))
  .resize(560, 560)
  .webp({ quality: 76 })
  .toFile(join(outDir, "hero-2.webp"));

console.log(`Geradas ${COUNT} artes em ${outDir}`);
