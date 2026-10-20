'use strict';
// Encodage des sorties image_gen en WebP avec le navigateur de test déjà utilisé.
// Aucun recadrage ni changement de composition ; les originaux restent dans generated_images.
const fs = require('node:fs'), path = require('node:path');
const { startBrowser } = require('./export-menu-gif');
async function run() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage : node scripts/prepare-mythology-art.js <dossier-png>');
  const output = path.join(__dirname, '..', 'assets', 'mythology');
  fs.mkdirSync(output, { recursive: true });
  const browser = await startBrowser();
  try {
    for (const file of fs.readdirSync(input).filter(name => /^[a-z0-9-]+\.png$/.test(name))) {
      const source = 'data:image/png;base64,' + fs.readFileSync(path.join(input, file)).toString('base64');
      const result = await browser.page.evaluate(`new Promise((resolve,reject)=>{
        const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
          c.getContext('2d').drawImage(image,0,0);resolve(c.toDataURL('image/webp',.88));};image.onerror=reject;image.src=${JSON.stringify(source)};
      })`);
      if (!result.startsWith('data:image/webp;')) throw new Error('Encodeur WebP absent');
      const data = Buffer.from(result.split(',')[1], 'base64');
      fs.writeFileSync(path.join(output, file.replace('.png', '.webp')), data);
      console.log(file.replace('.png', '.webp'), Math.round(data.length / 1024) + ' Ko');
    }
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
