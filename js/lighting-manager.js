(function () {
  "use strict";
  // Éclairage et atmosphère de la version PC : soleil doré avec ombres suivant la caméra,
  // ciel en carte d'environnement (lumière d'ambiance et reflets), brume. En VR/MR, les réglages
  // d'origine sont rétablis à l'identique (pas de ciel, pas de brume, tone mapping d'origine).
  const E = window.Eredita = window.Eredita || {};

  // Ciel procédural (zénith, horizon, sol, halo du soleil) converti en carte PMREM.
  function buildSky(THREE, renderer, cfg, direction) {
    const scene = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(10, 48, 24);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(cfg.envZenith) }, uHorizon: { value: new THREE.Color(cfg.envHorizon) },
        uGround: { value: new THREE.Color(cfg.envGround) }, uSun: { value: new THREE.Color(cfg.envSunColor) }, uDir: { value: direction.clone() }
      },
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uGround, uSun, uDir; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = d.y >= 0.0 ? mix(uHorizon, uZenith, pow(d.y, 0.55)) : mix(uHorizon, uGround, pow(-d.y, 0.35));
          float s = max(dot(d, normalize(uDir)), 0.0);
          c += uSun * (pow(s, 600.0) * 40.0 + pow(s, 24.0) * 1.2 + pow(s, 4.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    scene.add(new THREE.Mesh(geometry, material));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromScene(scene, 0.02, 0.1, 100);
    pmrem.dispose(); geometry.dispose(); material.dispose();
    return target;
  }

  function create(THREE, { renderer, scene, sun, hemi }) {
    const cfg = E.Config.environment3d;
    const saved = {
      sunColor: sun.color.clone(), sunIntensity: sun.intensity, sunPosition: sun.position.clone(), sunShadow: { l: sun.shadow.camera.left, r: sun.shadow.camera.right, t: sun.shadow.camera.top, b: sun.shadow.camera.bottom, w: sun.shadow.mapSize.x, bias: sun.shadow.bias, normalBias: sun.shadow.normalBias, far: sun.shadow.camera.far },
      hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), hemiIntensity: hemi.intensity,
      toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadowType: renderer.shadowMap.type,
      background: scene.background, fog: scene.fog, environment: scene.environment, environmentIntensity: scene.environmentIntensity ?? 1
    };
    const fogColor = new THREE.Color(cfg.fogColor);
    const direction = new THREE.Vector3(...(cfg.sunDirection || [-0.36, 0.64, 0.56])).normalize();
    let mode = "board", shadowExtent = 0, appliedMap = 0, sky = null;
    const target = new THREE.Vector3();

    function applyStrategy(profile, { post = false } = {}) {
      mode = "strategy";
      sun.color.setHex(cfg.sunColor); sun.intensity = cfg.sunIntensity;
      hemi.color.setHex(cfg.hemiSky); hemi.groundColor.setHex(cfg.hemiGround); hemi.intensity = cfg.hemiIntensity;
      renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = cfg.exposure;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      try { sky ||= buildSky(THREE, renderer, cfg, direction); } catch (error) { console.warn("Ciel 3D indisponible", error); }
      if (sky) { scene.environment = sky.texture; scene.environmentIntensity = cfg.envIntensity; }
      scene.background = fogColor;
      // Avec le post-traitement, la brume est calculée en profondeur (perspective atmosphérique) : pas de brume linéaire.
      if (post) scene.fog = null;
      else { if (!scene.fog?.isFog) scene.fog = new THREE.Fog(fogColor, 30, 120); scene.fog.color.copy(fogColor); }
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
      scene.environment = saved.environment; scene.environmentIntensity = saved.environmentIntensity;
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

    function dispose() { applyBoard(); sky?.dispose(); sky = null; }
    return { applyStrategy, applyBoard, update, dispose, get mode() { return mode; }, get sunDirection() { return direction; }, get environmentMap() { return sky?.texture || null; } };
  }

  E.LightingManager = { create };
}());
