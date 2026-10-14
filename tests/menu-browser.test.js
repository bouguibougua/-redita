"use strict";
// Vrai WebGL + navigation réelle, déploiement statique simulé sous /-redita/.
// Ce test sans casque ne valide pas le suivi physique ou le confort sur Quest 3.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startStaticServer, startBrowser, delay } = require("../scripts/export-menu-gif.js");

async function run() {
  const staticSite = await startStaticServer();
  let browser;
  try {
    browser = await startBrowser();
    const page = browser.page;
    const loadMenu = async () => {
      await page.send("Page.navigate", { url: staticSite.url });
      await page.waitFor("document.readyState === 'complete' && window.Eredita?.MenuScene?.diagnostics.ready && Eredita.MenuScene.diagnostics.textureLoaded");
    };
    await loadMenu();
    assert.equal(await page.evaluate("location.pathname"), "/-redita/");
    assert.equal(await page.evaluate("Eredita.MenuScene.diagnostics.mode"), "cinematic");
    assert.equal(await page.evaluate("Eredita.MenuScene.diagnostics.environmentAsset"), "assets/menu-360.png", "L’accueil conserve son illustration originale");
    assert.equal(await page.evaluate("Eredita.MenuScene.diagnostics.immersive"), false);
    assert.equal(await page.evaluate("Eredita.MenuScene.diagnostics.active"), true);
    await page.waitFor("document.querySelector('#menu-status').textContent.trim().length > 0");
    assert.equal(await page.evaluate("document.querySelector('#menu-enter-vr').disabled"), true, "Sans périphérique immersif, le menu VR reste indisponible");
    assert.deepEqual(await page.evaluate("Array.from(document.querySelectorAll('#main-menu .main-menu-actions button'), b=>b.textContent.trim())"), ["JOUER", "DECKS", "TUTORIEL", "RÉALITÉ MIXTE · QUEST 3"]);
    assert.equal(await page.evaluate("Array.from(document.querySelectorAll('#main-menu img')).some(i=>i.src.endsWith('/-redita/assets/eredita-logo.png') && i.complete && i.naturalWidth>0)"), true);
    assert.ok(await page.evaluate("document.querySelector('.menu-logo').naturalWidth >= 2048"), "Le nouveau logo reste net à la taille du menu");
    const panorama = await fetch(new URL("assets/menu-360.png", staticSite.url));
    assert.equal(panorama.status, 200);
    const png = Buffer.from(await panorama.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20) * 2, "Panorama equirectangulaire au ratio 2:1");
    assert.ok(await page.evaluate("Eredita.MenuScene.getContext().renderer.info.programs.length > 0"), "Le vrai shader WebGL doit avoir été compilé");
    assert.equal(page.consoleErrors.some((error) => /shader|WebGL|GL_INVALID/i.test(error)), false, `Erreurs WebGL : ${page.consoleErrors.join('\n')}`);

    await page.click("#menu-motion");
    assert.equal(await page.evaluate("document.querySelector('#menu-motion').getAttribute('aria-pressed')"), "true");
    await page.click("#menu-motion");
    await page.click("#menu-sound");
    assert.equal(await page.evaluate("typeof document.querySelector('#menu-sound').getAttribute('aria-pressed')"), "string");
    const initial = await page.evaluate("({...Eredita.MenuScene.diagnostics})");
    // Un glissement commence hors des boutons ; un clic simple conserve la navigation.
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 1240, y: 250, button: "left", buttons: 1, clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1050, y: 330, buttons: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1050, y: 330, button: "left", clickCount: 1 });
    await page.waitFor("Eredita.MenuScene.diagnostics.mode === 'panorama'");
    await delay(150);
    const rotated = await page.evaluate("({...Eredita.MenuScene.diagnostics})");
    assert.equal(rotated.environmentAsset, "assets/panorama-360.png", "Le décor avec sol est réservé au panorama");
    assert.equal(rotated.altarVisible, true, "L’autel est présent dans l’exploration panoramique");
    assert.ok(Math.abs(rotated.yaw - initial.yaw) > 0.01 || Math.abs(rotated.pitch - initial.pitch) > 0.01, "La souris doit orienter le panorama");
    await page.click("#menu-look");
    await page.waitFor("Eredita.MenuScene.diagnostics.mode === 'cinematic'");
    assert.equal(await page.evaluate("Eredita.MenuScene.diagnostics.environmentAsset"), "assets/menu-360.png");
    await page.waitFor("!Eredita.MenuScene.diagnostics.altarVisible");

    await page.click('[data-menu-screen="decks"]');
    await page.waitFor("!!document.querySelector('.deck-builder')");
    assert.equal(await page.evaluate("document.querySelectorAll('.deck-collection-card').length"), 34);
    await page.click('[data-open-card="habitant"]');
    await page.waitFor("!!document.querySelector('.deck-modal-backdrop')");
    await page.waitFor("document.querySelector('.deck-modal-backdrop').getAnimations({subtree:true}).every(animation => animation.playState === 'finished')");
    await page.click(".deck-modal-close");
    await page.waitFor("!document.querySelector('.deck-modal-backdrop')");
    await page.click("#menu-back");
    await page.waitFor("!document.querySelector('#main-menu').hidden");

    await page.click('#main-menu [data-open-xr]');
    await page.waitFor("document.querySelector('#xr-dialog').open");
    assert.equal(await page.evaluate("document.querySelector('#xr-start').disabled"), true, "Le test sans casque doit annoncer l'absence de session AR");
    await page.click("#xr-close");
    await page.waitFor("!document.querySelector('#xr-dialog').open");
    assert.equal(await page.evaluate("document.querySelector('#main-menu').hidden"), false);

    await page.click('[data-menu-screen="play"]');
    await page.waitFor("!!document.querySelector('#training-button')");
    await page.click('#menu-subcontent [data-match-format="classic"]');
    assert.equal(await page.evaluate("Eredita.Network.format"), "classic");
    await page.click("#open-multiplayer");
    await page.waitFor("!document.querySelector('#connection-screen').hidden");
    assert.equal(await page.evaluate("!!document.querySelector('#create-online') && !!document.querySelector('#join-online')"), true);
    await page.click("#connection-back");
    await page.click('[data-menu-screen="play"]');
    await page.click('#menu-subcontent [data-match-format="simplified"]');
    await page.click("#training-button");
    await page.waitFor("!document.querySelector('#setup-screen').hidden && document.querySelector('#main-menu').hidden");
    assert.equal(await page.evaluate("Eredita.Network.mode"), "solo");
    assert.equal(await page.evaluate("Eredita.Network.format"), "simplified");
    assert.equal(await page.evaluate("Eredita.Tutorial.active"), false);
    await page.waitFor("!Eredita.MenuScene.diagnostics.active");

    await loadMenu();
    await page.click('[data-menu-screen="tutorial"]');
    await page.waitFor("Eredita.Tutorial.active && Eredita.Tutorial.dialogueActive");
    assert.equal(await page.evaluate("Eredita.Network.mode"), "tutorial");
    assert.equal(await page.evaluate("document.querySelector('#main-menu').hidden"), true);

    await loadMenu();
    await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await delay(200);
    assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true, "Pas de débordement horizontal mobile");
    if (process.env.EREDITA_MENU_PREVIEW_DIR) {
      await delay(1300);
      fs.mkdirSync(process.env.EREDITA_MENU_PREVIEW_DIR, { recursive: true });
      const { data } = await page.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(process.env.EREDITA_MENU_PREVIEW_DIR, "menu-mobile.png"), Buffer.from(data, "base64"));
    }
    const mobileButtons = await page.evaluate("Array.from(document.querySelectorAll('#main-menu .main-menu-actions button'),b=>{const r=b.getBoundingClientRect();return {text:b.textContent.trim(),x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:innerWidth,height:innerHeight};})");
    assert.ok(mobileButtons.every((r) => r.x >= 0 && r.right <= r.width && r.y >= 0 && r.bottom <= r.height), `Les quatre entrées doivent rester visibles sur mobile : ${JSON.stringify(mobileButtons)}`);
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await loadMenu();
    assert.equal(await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), true);
    assert.equal(await page.evaluate("document.querySelector('#menu-motion').getAttribute('aria-pressed')"), "true", "Le mouvement réduit suspend les animations");

    assert.deepEqual(page.errors, [], `Exceptions navigateur : ${JSON.stringify(page.errors)}`);
    assert.deepEqual(page.badResponses, [], `Ressources manquantes sous /-redita/ : ${page.badResponses.join(', ')}`);
    if (process.env.EREDITA_MENU_PREVIEW_DIR) {
      fs.mkdirSync(process.env.EREDITA_MENU_PREVIEW_DIR, { recursive: true });
      const { data } = await page.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(process.env.EREDITA_MENU_PREVIEW_DIR, "menu-desktop.png"), Buffer.from(data, "base64"));
    }
    const fallback = await startBrowser(["--disable-webgl", "--disable-webgl2"]);
    try {
      await fallback.page.send("Page.navigate", { url: staticSite.url });
      await fallback.page.waitFor("document.readyState === 'complete' && !!window.Eredita?.MenuScene");
      await fallback.page.click('[data-menu-screen="play"]');
      await fallback.page.waitFor("!!document.querySelector('#training-button')");
      await fallback.page.click("#menu-back");
      assert.equal(await fallback.page.evaluate("document.querySelector('#main-menu').hidden"), false, "Le repli sans WebGL garde les routes accessibles");
      assert.deepEqual(fallback.page.errors, [], `Exceptions du repli : ${JSON.stringify(fallback.page.errors)}`);
    } finally { await fallback.close(); }
    console.log("Menu navigateur : vrai WebGL, souris, mouvement réduit, mobile et routes préservées sous /-redita/ validés. Aucun casque utilisé.");
  } finally { await browser?.close(); await new Promise((resolve) => staticSite.server.close(resolve)); }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
