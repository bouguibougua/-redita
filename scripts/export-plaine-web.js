'use strict';
// Blender et Chrome locaux uniquement ; aucune installation ou génération distante.
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { startBrowser } = require('./export-menu-gif');
const root = path.resolve(__dirname, '..');
const biome = process.argv[2] || 'plaine';

async function run() {
  if (!['plaine', 'montagne', 'littoral_rouge', 'littoral_bleu'].includes(biome)) throw new Error('Biome inconnu');
  const executable = process.env.EREDITA_BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
  await new Promise((resolve, reject) => {
    const blender = spawn(executable, ['--background', '--factory-startup', '--python-exit-code', '1',
      '--python', 'eredita3D/scripts/render_plaine_web.py', '--', biome], { cwd: root, stdio: 'inherit' });
    blender.once('error', reject);
    blender.once('exit', code => code === 0 ? resolve() : reject(new Error(`Blender : code ${code}`)));
  });
  const browser = await startBrowser();
  try {
    for (const [view, name] of [['top', `terrain-${biome}-v1`], ['card', `terrain-${biome}-card-v1`]]) {
      const source = fs.readFileSync(path.join(root, `eredita3D/previews/${biome}_web_${view}.png`));
      const data = await browser.page.evaluate(`(async () => {
        const image = new Image();image.src=${JSON.stringify('data:image/png;base64,' + source.toString('base64'))};
        await image.decode();const canvas=document.createElement('canvas');
        canvas.width=image.width;canvas.height=image.height;
        canvas.getContext('2d').drawImage(image,0,0);
        return canvas.toDataURL('image/webp',.9);
      })()`);
      if (!data.startsWith('data:image/webp;base64,')) throw new Error('Conversion WebP impossible');
      const file = path.join(root, `assets/generated/${name}.webp`);
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
      console.log(`${path.relative(root, file)} : ${Math.round(fs.statSync(file).size / 1024)} Kio`);
    }
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
