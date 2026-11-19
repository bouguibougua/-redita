(function () {
  "use strict";
  // Éclairage et atmosphère de la version PC : soleil doux avec ombres suivant la caméra,
  // hémisphère naturel, brume de distance, tone mapping. En VR/MR, les réglages d'origine sont rétablis.
  const E = window.Eredita = window.Eredita || {};

  function create(THREE, { renderer, scene, sun, hemi }) {
    const cfg = E.Config.environment3d;
    const saved = {
      sunColor: sun.color.clone(), sunIntensity: sun.intensity, sunPosition: sun.position.clone(), sunShadow: { l: sun.shadow.camera.left, r: sun.shadow.camera.right, t: sun.shadow.camera.top, b: sun.shadow.camera.bottom, w: sun.shadow.mapSize.x, bias: sun.shadow.bias, normalBias: sun.shadow.normalBias, far: sun.shadow.camera.far },
      hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), hemiIntensity: hemi.intensity,
      toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadowType: renderer.shadowMap.type,
      background: scene.background, fog: scene.fog
    };
    const fogColor = new THREE.Color(cfg.fogColor);
    const direction = new THREE.Vector3(...(cfg.sunDirection || [-0.36, 0.64, 0.56])).normalize();
    let mode = "board", shadowExtent = 0, appliedMap = 0;
    const target = new THREE.Vector3();

    function applyStrategy(profile) {
      mode = "strategy";
      sun.color.setHex(cfg.sunColor); sun.intensity = cfg.sunIntensity;
      hemi.color.setHex(cfg.hemiSky); hemi.groundColor.setHex(cfg.hemiGround); hemi.intensity = cfg.hemiIntensity;
      renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = cfg.exposure;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene.background = fogColor;
      if (!scene.fog?.isFog) scene.fog = new THREE.Fog(fogColor, 30, 120);
      scene.fog.color.copy(fogColor);
      sun.castShadow = profile.shadows;
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
      if (appliedMap !== profile.shadowMap) {
        sun.shadow.mapSize.set(profile.shadowMap, profile.shadowMap);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        appliedMap = profile.shadowMap;
      }
      shadowExtent = 0;
    }

    function applyBoard() {
      mode = "board";
      sun.color.copy(saved.sunColor); sun.intensity = saved.sunIntensity; sun.position.copy(saved.sunPosition);
      const s = saved.sunShadow;
      Object.assign(sun.shadow.camera, { left: s.l, right: s.r, top: s.t, bottom: s.b, far: s.far }); sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = s.bias; sun.shadow.normalBias = s.normalBias; sun.castShadow = true;
      if (appliedMap !== s.w) { sun.shadow.mapSize.set(s.w, s.w); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } appliedMap = s.w; }
      sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
      hemi.color.copy(saved.hemiSky); hemi.groundColor.copy(saved.hemiGround); hemi.intensity = saved.hemiIntensity;
      renderer.toneMapping = saved.toneMapping; renderer.toneMappingExposure = saved.exposure; renderer.shadowMap.type = saved.shadowType;
      scene.background = saved.background; scene.fog = saved.fog;
    }

    // Suit la cible de la caméra : l'ombre reste nette là où le joueur regarde.
    function update(targetPoint, distance) {
      if (mode !== "strategy") return;
      const wanted = Math.max(9, Math.min(46, distance * 0.82));
      const extent = Math.ceil(wanted / 3) * 3;
      const snap = Math.max(0.5, extent * 2 / (appliedMap || 2048)) * 8;
      target.set(Math.round(targetPoint.x / snap) * snap, 0, Math.round(targetPoint.z / snap) * snap);
      sun.target.position.copy(target); sun.target.updateMatrixWorld();
      sun.position.copy(target).addScaledVector(direction, 70);
      if (extent !== shadowExtent) {
        shadowExtent = extent;
        const c = sun.shadow.camera; c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 5; c.far = 160; c.updateProjectionMatrix();
      }
      if (scene.fog?.isFog) { scene.fog.near = distance * 1.05; scene.fog.far = distance * 2.7 + 36; }
    }

    function dispose() { applyBoard(); }
    return { applyStrategy, applyBoard, update, dispose, get mode() { return mode; }, get sunDirection() { return direction; } };
  }

  E.LightingManager = { create };
}());
