'use strict';
// Version PC : plateau sans socle, paysage décoratif, caméra de stratégie à angle fixe ; VR/MR inchangée.
const assert = require('node:assert/strict');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');

async function run() {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: (process.env.EREDITA_TEST_URL || site.url) + '?intro=0&quality=medium' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.PlainTerrain?.ready && Eredita.MountainTerrain?.ready && Eredita.CoastTerrain?.ready', 30000);
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]');
    await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");
    await page.evaluate(`(() => {
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
      const E = Eredita, s = E.GameView.getState();
      s.players.red.villages.forEach((v, i) => { v.biome = ['plaine', 'littoral'][i]; v.slots = E.Biomes.createSlots(v.biome); });
      s.players.blue.villages.forEach((v, i) => { v.biome = ['montagne', 'plaine'][i]; v.slots = E.Biomes.createSlots(v.biome); });
      E.UI.render(s); E.Board3D.setMode(true); E.Board3D.update(s, true);
    })()`);
    await page.waitFor('Eredita.Board3D.environment && Eredita.Board3D.strategyCamera', 20000);
    await delay(800);

    // Plateau : plus de socle, de rebord ni d'épaisseur de tuile ; liseré d'équipe posé au sol.
    const board = await page.evaluate(`(() => {
      const c = Eredita.Board3D.getXRContext(), boxes = c.world.children.filter(o => o.isMesh && o.geometry.type === 'BoxGeometry');
      let bases = 0, visibleBases = 0, frames = 0, visibleFrames = 0, decorativeInTerrain = 0;
      c.terrainGroup.traverse(o => {
        if (o.userData.terrainRole === 'base') { bases++; if (o.visible) visibleBases++; }
        if (o.userData.boardOnly && o.visible) visibleBases++;
        if (o.name === 'team-frame') { frames++; if (o.visible) visibleFrames++; }
        if (o.userData.decorative) decorativeInTerrain++;
      });
      return { mode: Eredita.Board3D.renderMode, boxes: boxes.length, boxesVisible: boxes.filter(b => b.visible).length, bases, visibleBases, frames, visibleFrames, decorativeInTerrain,
        sceneFog: Boolean(c.scene.fog), tone: c.renderer.toneMapping };
    })()`);
    assert.equal(board.mode, 'strategy');
    assert.ok(board.boxes >= 2 && board.boxesVisible === 0, 'socle et rebord du plateau masqués en version PC');
    assert.ok(board.bases >= 4 && board.visibleBases === 0, 'volumes de base des régions masqués');
    assert.equal(board.frames, 4); assert.equal(board.visibleFrames, 4);
    assert.equal(board.decorativeInTerrain, 0, 'aucun décor dans le groupe sélectionnable');
    assert.ok(board.sceneFog, 'brume atmosphérique');

    // Paysage : généré, borné en triangles, jamais sélectionnable, avec eau et végétation instanciée.
    const env = await page.evaluate(`(() => {
      const e = Eredita.Board3D.environment, d = e.diagnostics;
      let pickable = 0; e.group.traverse(o => { if (o.isMesh && o.raycast !== undefined && o.raycast.toString() !== '() => {}') pickable++; });
      return { d, pickable, children: e.group.children.map(c => c.name), seed: d.seed };
    })()`);
    assert.ok(env.d.chunks > 30 && env.d.triangles < 450000, `environnement borné (${env.d.triangles} triangles)`);
    assert.ok(env.d.vegetation.instances > 300 && env.d.vegetation.draws < 400);
    assert.equal(env.pickable, 0, 'le paysage ne répond jamais au raycast de sélection');
    assert.ok(env.children.includes('mer') && env.children.includes('vegetation'));
    assert.match(env.seed, /eredita-corse-1:2:/);

    // Modèles Tripo du décor : chargés après coup, substitués aux formes procédurales, toujours non sélectionnables.
    await page.waitFor('Eredita.Board3D.environment?.diagnostics.vegetation?.models >= 10', 60000);
    const withModels = await page.evaluate(`(() => {
      const e = Eredita.Board3D.environment, d = e.diagnostics;
      let pickable = 0, shared = 0; e.group.traverse(o => {
        if (o.isMesh && o.raycast.toString() !== '() => {}') pickable++;
        if (o.isInstancedMesh && o.geometry.userData.sharedModel) shared++;
      });
      return { triangles: d.triangles, instances: d.vegetation.instances, pickable, shared, seed: d.seed };
    })()`);
    assert.equal(withModels.pickable, 0, 'les modèles Tripo ne sont jamais sélectionnables');
    assert.ok(withModels.shared > 10, `modèles Tripo utilisés (${withModels.shared} groupes)`);
    assert.ok(withModels.triangles < 1600000, `budget de triangles tenu (${withModels.triangles})`);
    assert.equal(withModels.seed, env.seed, 'même paysage après l’arrivée des modèles');

    // Caméra : angle fixe quoi que fasse le joueur.
    const probe = `(() => {
      const cam = Eredita.Board3D.camera, d = cam.getWorldDirection(new (cam.position.constructor)());
      const sc = Eredita.Board3D.strategyCamera;
      return { pitch: Math.asin(-d.y) * 180 / Math.PI, heading: Math.atan2(d.z, d.x) * 180 / Math.PI, target: sc.target, zoom: sc.zoom, desired: sc.desiredZoom, fit: sc.fit };
    })()`;
    const start = await page.evaluate(probe);
    assert.ok(Math.abs(start.pitch - 55) < 0.6, `inclinaison initiale ${start.pitch}`);
    assert.ok(Math.abs(start.heading) < 0.6, 'cap horizontal fixe');
    const send = (type, init, target = 'window') => page.evaluate(`${target}.dispatchEvent(new ${type.startsWith('wheel') ? 'WheelEvent' : type.startsWith('pointer') ? 'PointerEvent' : 'KeyboardEvent'}(${JSON.stringify(type.toLowerCase())}, ${JSON.stringify({ bubbles: true, cancelable: true, ...init })}))`);
    const canvas = 'Eredita.Board3D.getXRContext().renderer.domElement';
    // Molette : zoom borné, angle inchangé.
    for (let i = 0; i < 30; i++) await send('wheel', { deltaY: 240, clientX: 700, clientY: 400 }, canvas);
    await page.waitFor('Math.abs(Eredita.Board3D.strategyCamera.zoom - 1.75) < 0.01', 30000);
    const farthest = await page.evaluate(probe);
    assert.ok(Math.abs(farthest.zoom - 1.75) < 0.02, `zoom max ${JSON.stringify(farthest)}`);
    assert.ok(Math.abs(farthest.pitch - 55) < 0.6 && Math.abs(farthest.heading) < 0.6);
    for (let i = 0; i < 60; i++) await send('wheel', { deltaY: -240, clientX: 700, clientY: 400 }, canvas);
    await page.waitFor('Math.abs(Eredita.Board3D.strategyCamera.zoom - 0.17) < 0.01', 30000);
    const closest = await page.evaluate(probe);
    assert.ok(Math.abs(closest.zoom - 0.17) < 0.01, `zoom min (${closest.zoom})`);
    assert.ok(Math.abs(closest.pitch - 55) < 0.6, 'le zoom conserve exactement le même angle');
    // Le zoom reste centré sur le curseur : le point du sol visé ne bouge presque pas.
    await page.evaluate(`Eredita.Board3D.strategyCamera.setDesired(0, 0, 1)`); await page.waitFor('Math.abs(Eredita.Board3D.strategyCamera.zoom - 1) < 0.01', 30000);
    const groundUnder = `(() => {
      const cam = Eredita.Board3D.camera, T = cam.position.constructor, r = Eredita.Board3D.getXRContext().renderer.domElement.getBoundingClientRect();
      const x = (900 - r.left) / r.width * 2 - 1, y = -(300 - r.top) / r.height * 2 + 1;
      const v = new T(x, y, 0.5).unproject(cam), dir = v.sub(cam.position).normalize(), t = -cam.position.y / dir.y;
      return [cam.position.x + dir.x * t, cam.position.z + dir.z * t];
    })()`;
    const before = await page.evaluate(groundUnder);
    for (let i = 0; i < 8; i++) await send('wheel', { deltaY: -120, clientX: 900, clientY: 300 }, canvas);
    await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const after = await page.evaluate(groundUnder);
    assert.ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < 0.35, `zoom centré sur le curseur (${before} → ${after})`);

    // Clavier : AZERTY (ZQSD = KeyW/KeyA/KeyS/KeyD) et QWERTY (WASD) partagent les touches physiques ; flèches aussi.
    await page.evaluate(`Eredita.Board3D.strategyCamera.setDesired(0, 0, 1)`); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const centre = await page.evaluate(probe);
    await send('keydown', { code: 'KeyD', key: 'd' }); await page.waitFor(`Eredita.Board3D.strategyCamera.target.z > ${centre.target.z + 0.5}`, 40000); await send('keyup', { code: 'KeyD', key: 'd' }); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const right = await page.evaluate(probe);
    assert.ok(right.target.z > centre.target.z + 0.4, 'D / flèche droite déplacent vers la droite');
    await send('keydown', { code: 'ArrowUp', key: 'ArrowUp' }); await page.waitFor(`Eredita.Board3D.strategyCamera.target.x > ${right.target.x + 0.5}`, 40000); await send('keyup', { code: 'ArrowUp', key: 'ArrowUp' }); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const up = await page.evaluate(probe);
    assert.ok(up.target.x > right.target.x + 0.4, 'W / Z / flèche haut avancent');
    assert.ok(Math.abs(up.pitch - 55) < 0.6 && Math.abs(up.heading) < 0.6, 'le déplacement ne tourne jamais la caméra');
    // Champ de saisie : aucune interprétation des touches.
    const typed = await page.evaluate(`(() => {
      const select = document.querySelector('#graphics-quality'); select.focus();
      const before = Eredita.Board3D.strategyCamera.target.x;
      select.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp', bubbles: true, cancelable: true }));
      return { before, keys: Eredita.Board3D.strategyCamera.keysDown, prevented: false };
    })()`);
    assert.deepEqual(typed.keys, [], 'les touches de caméra sont ignorées dans un champ de saisie');
    await page.evaluate(`document.activeElement.blur()`);
    // Limites : maintenir la touche longtemps ne sort jamais de la zone autorisée.
    const bounds0 = await page.evaluate(`Eredita.Board3D.playableBounds()`), limit0 = await page.evaluate(`Eredita.Config.strategyCamera.panMargin`);
    await send('keydown', { code: 'KeyW', key: 'w', shiftKey: true }); await send('keydown', { code: 'ShiftLeft', key: 'Shift' }); await page.waitFor(`Eredita.Board3D.strategyCamera.target.x > ${bounds0.maxX + limit0 - 0.2}`, 60000);
    await send('keyup', { code: 'KeyW', key: 'w' }); await send('keyup', { code: 'ShiftLeft', key: 'Shift' });
    const bounds = await page.evaluate(`Eredita.Board3D.playableBounds()`), limit = await page.evaluate(`Eredita.Config.strategyCamera.panMargin`);
    const edge = await page.evaluate(probe);
    assert.ok(edge.target.x <= bounds.maxX + limit + 0.05, `limite avant respectée (${edge.target.x})`);
    // Espace : recentre sur le champ de bataille.
    await send('keydown', { code: 'Space', key: ' ' }); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const home = await page.evaluate(probe);
    assert.ok(Math.abs(home.target.x - (bounds.minX + bounds.maxX) / 2) < 0.15 && Math.abs(home.target.z) < 0.15, 'Espace recentre');
    // Clic molette : le point saisi suit le curseur.
    await page.evaluate(`Eredita.Board3D.strategyCamera.setDesired(0, 0, 0.6)`); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const panStart = await page.evaluate(probe);
    await send('pointerdown', { button: 1, buttons: 4, pointerId: 7, clientX: 700, clientY: 400 }, canvas);
    await send('pointermove', { button: -1, buttons: 4, pointerId: 7, clientX: 600, clientY: 360 }, canvas);
    await send('pointerup', { button: 1, buttons: 0, pointerId: 7, clientX: 600, clientY: 360 }, canvas);
    await delay(300);
    const panEnd = await page.evaluate(probe);
    assert.ok(Math.hypot(panEnd.target.x - panStart.target.x, panEnd.target.z - panStart.target.z) > 0.3, 'clic molette déplace la caméra');
    assert.ok(Math.abs(panEnd.pitch - 55) < 0.6 && Math.abs(panEnd.heading) < 0.6);
    // Un glissement du bouton gauche ne fait plus tourner ni basculer la caméra.
    await send('pointerdown', { button: 0, buttons: 1, pointerId: 8, clientX: 700, clientY: 400 }, canvas);
    await send('pointermove', { button: -1, buttons: 1, pointerId: 8, clientX: 500, clientY: 250 }, canvas);
    await send('pointerup', { button: 0, buttons: 0, pointerId: 8, clientX: 500, clientY: 250 }, canvas);
    await delay(300);
    const afterLeft = await page.evaluate(probe);
    assert.ok(Math.abs(afterLeft.pitch - 55) < 0.6 && Math.abs(afterLeft.heading) < 0.6 && Math.abs(afterLeft.zoom - panEnd.zoom) < 0.01);

    // Double-clic sur un village de l'interface : centrage.
    await page.evaluate(`Eredita.Board3D.strategyCamera.setDesired(-3, 0, 0.9)`); await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    await page.evaluate(`document.querySelector('[data-village-select][data-player="red"][data-lane="1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await page.waitFor('Eredita.Board3D.strategyCamera.settled', 40000);
    const focused = await page.evaluate(probe), blue1 = await page.evaluate(`Eredita.Board3D.regionLayout().find(r => r.owner === 'red' && r.lane === 1)`);
    assert.ok(Math.hypot(focused.target.x - blue1.cx, focused.target.z - blue1.cz) < 0.3, 'double-clic centre la caméra sur le village');
    assert.ok(Math.abs(focused.pitch - 55) < 0.6);

    // Aucun vide : coins de l'écran toujours sur le paysage, au dézoom maximal et aux limites de déplacement.
    const voids = await page.evaluate(`(() => {
      const sc = Eredita.Board3D.strategyCamera, cam = Eredita.Board3D.camera, env = Eredita.Board3D.environment.extent, T = cam.position.constructor;
      const b = Eredita.Board3D.playableBounds(), m = Eredita.Config.strategyCamera.panMargin, bad = [];
      const spots = [[b.minX - m, b.minZ - m], [b.minX - m, b.maxZ + m], [b.maxX + m, b.minZ - m], [b.maxX + m, b.maxZ + m], [0, 0]];
      return new Promise(resolve => {
        let i = 0;
        const step = () => {
          if (i >= spots.length) return resolve(bad);
          sc.setDesired(spots[i][0], spots[i][1], Eredita.Config.strategyCamera.zoomMax);
          const ready = () => {
            if (!sc.settled) return setTimeout(ready, 100);
            cam.updateMatrixWorld(true);
            for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]]) {
              const dir = new T(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
              if (dir.y >= -0.05) { bad.push(['ciel', i, nx, ny]); continue; }
              const t = -cam.position.y / dir.y, x = cam.position.x + dir.x * t, z = cam.position.z + dir.z * t;
              if (x < env.minX || x > env.maxX || z < env.minZ || z > env.maxZ) bad.push(['hors-monde', i, nx, ny, x, z]);
            }
            i++; step();
          }; ready();
        };
        step();
      });
    })()`);
    assert.deepEqual(voids, [], 'aucun bord du monde ni ciel visible, même au dézoom maximal');

    // Qualités graphiques : quatre niveaux, paysage reconstruit, ressources libérées.
    const quality = await page.evaluate(`(async () => {
      const E = Eredita, out = {}, memory = () => E.Board3D.getXRContext().renderer.info.memory.geometries;
      for (const level of ['low', 'medium', 'high', 'ultra']) {
        E.GraphicsSettings.set(level, false);
        await new Promise(r => setTimeout(r, 1200));
        const d = E.Board3D.environment.diagnostics;
        out[level] = { instances: d.vegetation.instances, triangles: d.triangles, buildMs: d.buildMs, geometries: memory() };
      }
      E.GraphicsSettings.set('medium', false); await new Promise(r => setTimeout(r, 1200));
      const withEnv = memory(); E.Board3D.releaseEnvironment();
      const released = memory(); const gone = !E.Board3D.environment;
      await new Promise(r => setTimeout(r, 400));
      return { out, withEnv, released, gone, rebuilt: Boolean(E.Board3D.environment) };
    })()`);
    assert.ok(quality.out.low.instances < quality.out.medium.instances && quality.out.medium.instances < quality.out.high.instances && quality.out.high.instances < quality.out.ultra.instances, JSON.stringify(quality.out));
    assert.ok(quality.out.ultra.triangles < 1500000, 'ultra reste borné');
    assert.ok(quality.gone && quality.released < quality.withEnv - 10, `géométries libérées (${quality.withEnv} → ${quality.released})`);
    assert.ok(quality.rebuilt, 'le paysage se reconstruit à la demande');

    // VR/MR : plateau d'origine, sans paysage, éclairage et brume d'origine ; retour PC propre.
    const xr = await page.evaluate(`(async () => {
      const E = Eredita, c = E.Board3D.getXRContext();
      const sunBefore = c.scene.children.find(o => o.isDirectionalLight).intensity;
      Object.defineProperty(E.XR, 'active', { get: () => true, configurable: true });
      await new Promise(r => setTimeout(r, 500));
      const boxes = c.world.children.filter(o => o.isMesh && o.geometry.type === 'BoxGeometry');
      let bases = 0, visibleBases = 0, frames = 0;
      c.terrainGroup.traverse(o => { if (o.userData.terrainRole === 'base') { bases++; if (o.visible) visibleBases++; } if (o.name === 'team-frame' && o.visible) frames++; });
      const inXr = { mode: E.Board3D.renderMode, boxesVisible: boxes.filter(b => b.visible).length, bases, visibleBases, frames, envVisible: E.Board3D.environment?.group.visible,
        sun: c.scene.children.find(o => o.isDirectionalLight).intensity, tone: c.renderer.toneMapping, width: E.Board3D.getBoardWidth() };
      delete E.XR.active; Object.defineProperty(E.XR, 'active', { get() { return false; }, configurable: true });
      await new Promise(r => setTimeout(r, 600));
      return { sunBefore, inXr, back: { mode: E.Board3D.renderMode, boxesVisible: boxes.filter(b => b.visible).length, envVisible: E.Board3D.environment?.group.visible, tone: c.renderer.toneMapping } };
    })()`);
    assert.equal(xr.inXr.mode, 'board'); assert.ok(xr.inXr.boxesVisible >= 2, 'socle conservé en VR/MR');
    assert.equal(xr.inXr.visibleBases, xr.inXr.bases, 'bases de région conservées en VR/MR'); assert.equal(xr.inXr.frames, 0);
    assert.equal(xr.inXr.envVisible, false, 'aucun paysage imposé en VR/MR'); assert.equal(xr.inXr.tone, 0, 'rendu VR/MR sans tone mapping ajouté');
    assert.equal(xr.inXr.sun, 2.8, 'éclairage de plateau d\'origine en VR/MR');
    assert.equal(xr.back.mode, 'strategy'); assert.equal(xr.back.boxesVisible, 0); assert.equal(xr.back.envVisible, true);
    assert.ok(Math.abs(xr.inXr.width - (2 * 3 * 1.15 + 1.65)) < 0.01, 'dimensions du plateau inchangées');

    // Sélection inchangée : un clic sur un habitant/emplacement garde son comportement.
    const picked = await page.evaluate(`(() => {
      const E = Eredita, c = E.Board3D.getXRContext(); E.Board3D.strategyCamera.setDesired(-2, -2.5, 0.5);
      return new Promise(resolve => { const go = () => { if (!E.Board3D.strategyCamera.settled) return setTimeout(go, 100);
        const cam = c.camera, T = cam.position.constructor, r = c.renderer.domElement.getBoundingClientRect(), hits = new Set();
        for (let sx = 0.1; sx < 0.95; sx += 0.05) for (let sy = 0.1; sy < 0.95; sy += 0.05) {
          const t = E.Board3D.targetAt(r.left + r.width * sx, r.top + r.height * sy); if (t) hits.add(t.kind);
        }
        resolve([...hits]); }; go(); });
    })()`);
    assert.ok(picked.length >= 1, `cibles sélectionnables toujours détectées (${picked})`);
    console.log('Version PC : plateau sans socle, paysage procédural, caméra à angle fixe, limites, qualités et VR/MR validés.');
  } finally { await browser?.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exit(1); });
