"use strict";
// Source images live outside the published game; only WebP files are written to assets/.
const fs = require("node:fs"), path = require("node:path");
const { createBrowser } = require("../tests/browser-helpers");
const project = path.join(__dirname, "..");
const args = process.argv.slice(2);
const sources = path.resolve(args.find(arg => !arg.startsWith("--")) || process.env.EREDITA_ASSET_SOURCES || path.join(project, ".asset-sources"));
const generated = ["buildings-atlas", "buildings-tier-atlas", "characters-atlas", "crops-atlas", "livestock-atlas", "terrain-littoral-bleu", "terrain-littoral-rouge", "terrain-montagne", "terrain-plaine"];

async function run() {
  const jobs = generated.map(id => ({ source: `generated/${id}.png`, output: `assets/generated/${id}.webp` }));
  for (const job of jobs) if (!fs.existsSync(path.join(sources, job.source))) throw new Error(`Source manquante : ${path.join(sources, job.source)}. Indique le dossier des sources PNG en argument.`);
  const browser = await createBrowser({ serverPort:8879, debugPort:9447 });
  let bytes = 0;
  try {
    for (const job of jobs) {
      const sourceUrl = `data:image/png;base64,${fs.readFileSync(path.join(sources, job.source)).toString("base64")}`;
      const result = await browser.send("Runtime.evaluate", {
        awaitPromise:true, returnByValue:true,
        expression:`(async () => {
          const image=new Image(); image.src=${JSON.stringify(sourceUrl)}; await image.decode();
          const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
          canvas.getContext('2d').drawImage(image,0,0);
          return canvas.toDataURL('image/webp',0.92);
        })()`
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      const url=result.result.value;
      if (!url?.startsWith("data:image/webp;base64,")) throw new Error(`Encodage WebP impossible : ${job.output}`);
      const data=Buffer.from(url.split(",")[1],"base64");
      fs.writeFileSync(path.join(project,job.output),data); bytes+=data.length;
    }
    console.log(`${jobs.length} images préparées : ${(bytes/1024/1024).toFixed(2)} Mio, sources PNG conservées dans ${sources}.`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode=1; });
