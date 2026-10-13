"use strict";
const fs = require("node:fs"), path = require("node:path");
const { createBrowser } = require("../tests/browser-helpers");
const folder = path.join(__dirname, "..", "assets", "cards", "fantasy");
const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));

async function run() {
  const browser = await createBrowser({ serverPort: 8879, debugPort: 9447 });
  let bytes = 0;
  try {
    const entries = [...manifest.cards, ...manifest.generated.map(id => ({ id }))];
    for (const entry of entries) {
      const src = `assets/cards/fantasy/${entry.rect ? manifest.reference : `${entry.id}.png`}`;
      const result = await browser.send("Runtime.evaluate", {
        awaitPromise: true, returnByValue: true,
        expression: `(async () => {
          const image = new Image(); image.src = ${JSON.stringify(src)}; await image.decode();
          const rect = ${JSON.stringify(entry.rect || null)} || { x:0, y:0, width:image.naturalWidth, height:image.naturalHeight };
          const original = document.createElement('canvas'); original.width=rect.width; original.height=rect.height;
          original.getContext('2d').drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
          const small = document.createElement('canvas'), scale = Math.min(1,768/Math.max(rect.width,rect.height));
          small.width=Math.round(rect.width*scale); small.height=Math.round(rect.height*scale);
          small.getContext('2d').drawImage(original,0,0,small.width,small.height);
          return { png:${Boolean(entry.rect)} ? original.toDataURL('image/png') : null, webp:small.toDataURL('image/webp',0.92) };
        })()`
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      const output = result.result.value;
      if (!output?.webp?.startsWith("data:image/webp;base64,")) throw new Error(`WebP failed: ${entry.id}`);
      if (output.png) fs.writeFileSync(path.join(folder, `${entry.id}.png`), Buffer.from(output.png.split(",")[1], "base64"));
      const data = Buffer.from(output.webp.split(",")[1], "base64");
      fs.writeFileSync(path.join(folder, `${entry.id}.webp`), data); bytes += data.length;
    }
    console.log(`Fantasy cards: ${manifest.cards.length} supplied cards + ${manifest.generated.length} matching cards, ${(bytes/1024/1024).toFixed(1)} MiB in game.`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode=1; });
