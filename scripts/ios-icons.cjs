// Derive iOS icons from the project's existing logo; no new visual design.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const directory = path.join(root, 'ios/VirtusPlanner/Images.xcassets/AppIcon.appiconset');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'Contents.json'), 'utf8'));
  for (const image of manifest.images) {
    const pixels = Math.round(parseFloat(image.size) * parseFloat(image.scale));
    image.filename = `icon-${image.idiom}-${pixels}.png`;
    await sharp(path.join(root, 'src/assets/logo.png')).resize(pixels, pixels, {
      fit: 'contain', background: '#ffffff',
    }).flatten({ background: '#ffffff' }).png().toFile(path.join(directory, image.filename));
  }
  fs.writeFileSync(path.join(directory, 'Contents.json'), JSON.stringify(manifest, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exit(1); });
