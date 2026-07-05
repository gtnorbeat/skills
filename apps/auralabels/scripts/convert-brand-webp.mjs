import sharp from "sharp";
import { join, dirname } from "path";
import { renameSync } from "node:fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "..", "public", "brand-assets", "AURA.png");
const outDir = join(__dirname, "..", "public", "brand-assets");

// Dark background matching the app theme (--color-zinc-950 / bg-black).
const BG = { r: 9, g: 9, b: 11, alpha: 1 };

// ── PNG source (flatten onto dark background) ─────────────────────
// Regenerate the source PNG in-place so it matches the WebP variants.
// The original with transparency was ~976 KB; flattened is ~124 KB.
await sharp(src)
  .flatten({ background: BG })
  .png()
  .toFile(src + ".tmp");
renameSync(src + ".tmp", src);
console.log(`Regenerated AURA.png with dark background`);

// ── Responsive WebP variants (landscape, for in-app use) ──────────
const responsive = [
  { width: 256, name: "AURA-256w.webp" },
  { width: 512, name: "AURA-512w.webp" },
  { width: 960, name: "AURA-960w.webp" },
];

for (const { width, name } of responsive) {
  const out = join(outDir, name);
  await sharp({ create: { width, height: Math.round(width / (1137 / 637)), channels: 4, background: BG } })
    .composite([{ input: await sharp(src).resize({ width, withoutEnlargement: true }).toBuffer(), top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toFile(out);
  console.log(`Created ${name} (${width}w, dark bg)`);
}

// ── Square PWA icons (for manifest + favicon + apple-touch-icon) ───
// Center-crops the landscape source into a square with dark background
// so the orbital mark stays centred and the wordmark on either side
// falls outside the 1:1 frame — exactly the composition we want for
// a home-screen app icon.
const icons = [
  { size: 192, name: "AURA-icon-192.webp" },
  { size: 512, name: "AURA-icon-512.webp" },
];

for (const { size, name } of icons) {
  const out = join(outDir, name);
  // Calculate the crop region: take the centre square from the source.
  // Source is 1137×637 landscape — vertical crop at full height,
  // horizontal crop centred.
  const srcHeight = 637;
  const cropSize = srcHeight; // 637 px square from the centre
  const cropLeft = Math.round((1137 - cropSize) / 2); // ~250 px from left

  await sharp(src)
    .extract({ left: cropLeft, top: 0, width: cropSize, height: cropSize })
    .resize({ width: size, height: size, fit: "cover" })
    .flatten({ background: BG })
    .webp({ quality: 90 })
    .toFile(out);
  console.log(`Created ${name} (${size}×${size}, dark bg, centre-cropped)`);
}

console.log("Done — all WebP variants regenerated with dark background.");
