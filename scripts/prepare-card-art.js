"use strict";
// Development asset preparation: keep generated PNG originals and create small WebP copies.
const fs = require("node:fs");
const path = require("node:path");
const { createBrowser } = require("../tests/browser-helpers");

async function run() {
  const browser = await createBrowser({ serverPort: 8879, debugPort: 9447 });
  const folder = path.join(__dirname, "..", "assets", "cards");
  let originalBytes = 0, webBytes = 0;
  try {
    for (const filename of fs.readdirSync(folder).filter(name => name.endsWith(".png"))) {
      const result = await browser.send("Runtime.evaluate", {
        awaitPromise: true, returnByValue: true,
        expression: `(async () => {
          const image = new Image();
          image.src = ${JSON.stringify(`assets/cards/${filename}`)};
          await image.decode();
          const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.naturalWidth * scale);
          canvas.height = Math.round(image.naturalHeight * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/webp', 0.88);
        })()`
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      const dataUrl = result.result.value;
      if (!dataUrl?.startsWith("data:image/webp;base64,")) throw new Error(`WebP encoding failed: ${filename}`);
      const data = Buffer.from(dataUrl.split(",")[1], "base64");
      fs.writeFileSync(path.join(folder, filename.replace(/\.png$/, ".webp")), data);
      originalBytes += fs.statSync(path.join(folder, filename)).size;
      webBytes += data.length;
    }
    console.log(`Card art: ${(originalBytes / 1024 / 1024).toFixed(1)} MiB of originals → ${(webBytes / 1024 / 1024).toFixed(1)} MiB of WebP assets.`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
