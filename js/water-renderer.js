(function () {
  "use strict";
  // Mer méditerranéenne décorative : plan unique + carte de profondeur cuite depuis le champ de
  // hauteur. La profondeur pilote la couleur (turquoise → bleu profond), la transparence et
  // l'écume des côtes ; deux normales défilantes donnent les vagues et le reflet du soleil.
  const E = window.Eredita = window.Eredita || {};

  const SIZE_BY_DETAIL = [128, 192, 256, 384];
  const DEPTH_RANGE = 4.2, DEPTH_OFFSET = 0.6;

  function create(THREE, { field, extent, profile, textures }) {
    const level = field.waterLevel;
    const res = SIZE_BY_DETAIL[Math.min(3, profile.waterDetail)] || 256;
    const width = extent.maxX - extent.minX, depthExtent = extent.maxZ - extent.minZ;
    const out = {};
    let any = false;
    // Carte de profondeur cuite : L'eau n'existe que là où le terrain la déclare (mer), jamais dans les régions jouables.
    function bake(minX, minZ, w, d, nx, nz) {
      const data = new Uint8Array(nx * nz * 4);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        field.sample(minX + (i + 0.5) / nx * w, minZ + (j + 0.5) / nz * d, out);
        // `bed` : fond réel d'une tuile littorale (sinon le relief du paysage).
        const depth = (out.inside ? out.sea > 0 : out.sea > 0.001) ? level - (out.bed ?? out.h) : -1;
        if (depth > 0) any = true;
        const k = (j * nx + i) * 4;
        data[k] = Math.max(0, Math.min(255, (depth + DEPTH_OFFSET) / DEPTH_RANGE * 255)); data[k + 3] = 255;
      }
      const texture = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat);
      texture.magFilter = texture.minFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.colorSpace = THREE.NoColorSpace;
      texture.generateMipmaps = false; texture.needsUpdate = true;
      return texture;
    }
    const depthTexture = bake(extent.minX, extent.minZ, width, depthExtent, res, res);
    // Détail autour du plateau (0,1 unité) : interstice de la frontière et rivages proches nets, sans écume parasite.
    const b = field.bounds, pad = 7, step = profile.waterDetail >= 2 ? 0.1 : 0.16;
    const detail = { minX: b.minX - pad, minZ: b.minZ - pad, w: b.maxX - b.minX + 2 * pad, d: b.maxZ - b.minZ + 2 * pad };
    const detailTexture = bake(detail.minX, detail.minZ, detail.w, detail.d, Math.ceil(detail.w / step), Math.ceil(detail.d / step));
    if (!any) { depthTexture.dispose(); detailTexture.dispose(); return null; }

    const cfg = E.Config.environment3d;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDepth: { value: depthTexture }, uNormal: { value: textures.water.normal },
      uBounds: { value: new THREE.Vector4(extent.minX, extent.minZ, 1 / width, 1 / depthExtent) },
      uDetail: { value: detailTexture }, uDetailBounds: { value: new THREE.Vector4(detail.minX, detail.minZ, 1 / detail.w, 1 / detail.d) },
      uTime: { value: 0 }, uLocalMatrix: { value: new THREE.Matrix4() }, uSun: { value: new THREE.Vector3(-0.5, 0.8, -0.4).normalize() },
      // Turquoise des criques sur le sable, bleu profond au large (couleurs propres de l'eau, non éclairées).
      uShallow: { value: new THREE.Color(0x2cb4bb) }, uDeep: { value: new THREE.Color(0x166aa8) },
      uFoam: { value: new THREE.Color(0xf4f7f0) }, uSky: { value: new THREE.Color(cfg.skyColor) },
      uSunColor: { value: new THREE.Color(cfg.sunColor) }, uWave: { value: profile.waterDetail > 0 ? 1 : 0 }, uFoamOn: { value: profile.waterDetail > 0 ? 1 : 0.5 }
    }]);
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      vertexShader: `
        uniform mat4 uLocalMatrix;
        varying vec3 vWorld, vLocal;
        #include <fog_pars_vertex>
        void main() {
          // vLocal : unités du paysage (textures de profondeur, motifs) ; vWorld : scène (vue, brume).
          vLocal = (uLocalMatrix * vec4(position, 1.0)).xyz;
          vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D uDepth, uNormal, uDetail; uniform vec4 uBounds, uDetailBounds; uniform float uTime, uWave, uFoamOn;
        uniform vec3 uSun, uShallow, uDeep, uFoam, uSky, uSunColor;
        varying vec3 vWorld, vLocal;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          vec2 uv = (vLocal.xz - uBounds.xy) * uBounds.zw;
          float depth = texture2D(uDepth, uv).r * ${DEPTH_RANGE.toFixed(1)} - ${DEPTH_OFFSET.toFixed(1)};
          vec2 duv = (vLocal.xz - uDetailBounds.xy) * uDetailBounds.zw;
          float inDetail = smoothstep(0.0, 0.04, min(min(duv.x, duv.y), min(1.0 - duv.x, 1.0 - duv.y)));
          if (inDetail > 0.0) depth = mix(depth, texture2D(uDetail, duv).r * ${DEPTH_RANGE.toFixed(1)} - ${DEPTH_OFFSET.toFixed(1)}, inDetail);
          if (depth <= 0.0) discard;
          vec2 p = vLocal.xz;
          vec3 n1 = texture2D(uNormal, p * 0.13 + vec2(uTime * 0.013, uTime * 0.019)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormal, p * vec2(0.31, -0.27) + vec2(-uTime * 0.021, uTime * 0.012)).xyz * 2.0 - 1.0;
          vec3 N = normalize(vec3((n1.x + n2.x) * 0.55 * uWave, 1.0, (n1.y + n2.y) * 0.55 * uWave));
          vec3 V = normalize(cameraPosition - vWorld);
          float fresnel = 0.03 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
          float deepness = 1.0 - exp(-depth * 1.6);
          // Rendu HDR : l'eau (non éclairée) est portée au niveau des surfaces au soleil.
          vec3 color = mix(uShallow, uDeep, deepness) * 1.15;
          // Caustiques sur les hauts-fonds : lignes lumineuses mouvantes, comme dans une crique.
          float ca = texture2D(uNormal, p * 0.55 + vec2(uTime * 0.021, -uTime * 0.017)).x;
          float cb = texture2D(uNormal, p * vec2(-0.47, 0.61) + vec2(-uTime * 0.015, uTime * 0.024)).y;
          float caustic = pow(clamp(1.0 - abs(ca + cb - 1.0) * 3.2, 0.0, 1.0), 3.0);
          color += vec3(0.75, 0.95, 0.85) * caustic * (1.0 - smoothstep(0.1, 1.2, depth)) * 0.14 * uWave;
          color = mix(color, uSky, fresnel);
          vec3 H = normalize(normalize(uSun) + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0) * 0.9 * uWave;
          color += uSunColor * spec;
          // Le fond (sable au soleil, très lumineux en HDR) ne transparaît qu'au ras du rivage.
          float alpha = mix(0.72, 1.0, smoothstep(0.0, 0.28, depth));
          // Écume : bande côtière pulsée par les vagues + liseré blanc au contact du sable.
          float jitter = n1.x * 0.5 + n2.y * 0.5;
          // Écume limitée au liseré du rivage (même sur les pentes douces, elle ne couvre pas la mer).
          float band = 1.0 - smoothstep(0.0, 0.07 + 0.03 * jitter, depth);
          float pulse = smoothstep(0.35, 0.9, 0.5 + 0.5 * sin(depth * 60.0 - uTime * 1.6 + jitter * 6.0));
          float lap = (1.0 - smoothstep(0.0, 0.02, depth)) * 0.75;
          float foam = clamp(band * pulse * 0.6 + lap, 0.0, 1.0) * uFoamOn;
          color = mix(color, uFoam, foam);
          alpha = max(alpha * smoothstep(0.0, 0.025, depth), foam * 0.92);
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`
    });
    const geometry = new THREE.PlaneGeometry(width, depthExtent, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((extent.minX + extent.maxX) / 2, level, (extent.minZ + extent.maxZ) / 2);
    uniforms.uLocalMatrix.value = mesh.matrix; // repère du paysage (le groupe parent peut être réduit)
    mesh.renderOrder = 2; mesh.name = "mer"; mesh.userData.decorative = true; mesh.raycast = () => {};
    mesh.frustumCulled = false;
    mesh.userData.animated = profile.animatedWater;

    function update(time, view) {
      uniforms.uTime.value = profile.animatedWater ? time : 0;
      if (view?.sunDirection) uniforms.uSun.value.copy(view.sunDirection);
    }
    function dispose() { geometry.dispose(); material.dispose(); depthTexture.dispose(); detailTexture.dispose(); mesh.removeFromParent(); }
    return { mesh, update, dispose };
  }

  E.WaterRenderer = { create };
}());
