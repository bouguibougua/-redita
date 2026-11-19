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
    const data = new Uint8Array(res * res * 4);
    const out = {};
    let any = false;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = extent.minX + (i + 0.5) / res * width, z = extent.minZ + (j + 0.5) / res * depthExtent;
      field.sample(x, z, out);
      // L'eau n'existe que là où le terrain la déclare (mer), jamais dans les régions jouables.
      const depth = (out.inside ? out.sea > 0 : out.sea > 0.001) ? level - out.h : -1;
      if (depth > 0) any = true;
      const k = (j * res + i) * 4;
      data[k] = Math.max(0, Math.min(255, (depth + DEPTH_OFFSET) / DEPTH_RANGE * 255)); data[k + 3] = 255;
    }
    if (!any) return null;
    const depthTexture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
    depthTexture.magFilter = depthTexture.minFilter = THREE.LinearFilter;
    depthTexture.wrapS = depthTexture.wrapT = THREE.ClampToEdgeWrapping; depthTexture.colorSpace = THREE.NoColorSpace;
    depthTexture.generateMipmaps = false; depthTexture.needsUpdate = true;

    const cfg = E.Config.environment3d;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDepth: { value: depthTexture }, uNormal: { value: textures.water.normal },
      uBounds: { value: new THREE.Vector4(extent.minX, extent.minZ, 1 / width, 1 / depthExtent) },
      uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.5, 0.8, -0.4).normalize() },
      uShallow: { value: new THREE.Color(0x35c4b4) }, uDeep: { value: new THREE.Color(0x0c5f86) },
      uFoam: { value: new THREE.Color(0xf4f7f0) }, uSky: { value: new THREE.Color(cfg.skyColor) },
      uSunColor: { value: new THREE.Color(cfg.sunColor) }, uWave: { value: profile.waterDetail > 0 ? 1 : 0 }, uFoamOn: { value: profile.waterDetail > 0 ? 1 : 0.5 }
    }]);
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      vertexShader: `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D uDepth, uNormal; uniform vec4 uBounds; uniform float uTime, uWave, uFoamOn;
        uniform vec3 uSun, uShallow, uDeep, uFoam, uSky, uSunColor;
        varying vec3 vWorld;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          vec2 uv = (vWorld.xz - uBounds.xy) * uBounds.zw;
          float depth = texture2D(uDepth, uv).r * ${DEPTH_RANGE.toFixed(1)} - ${DEPTH_OFFSET.toFixed(1)};
          if (depth <= 0.0) discard;
          vec2 p = vWorld.xz;
          vec3 n1 = texture2D(uNormal, p * 0.13 + vec2(uTime * 0.013, uTime * 0.019)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormal, p * vec2(0.31, -0.27) + vec2(-uTime * 0.021, uTime * 0.012)).xyz * 2.0 - 1.0;
          vec3 N = normalize(vec3((n1.x + n2.x) * 0.55 * uWave, 1.0, (n1.y + n2.y) * 0.55 * uWave));
          vec3 V = normalize(cameraPosition - vWorld);
          float fresnel = 0.03 + 0.55 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
          float deepness = 1.0 - exp(-depth * 1.15);
          vec3 color = mix(uShallow, uDeep, deepness);
          color = mix(color, uSky, fresnel);
          vec3 H = normalize(normalize(uSun) + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0) * 0.9 * uWave;
          color += uSunColor * spec;
          float alpha = mix(0.42, 0.95, smoothstep(0.0, 0.7, depth));
          // Écume : bande côtière pulsée par les vagues + liseré blanc au contact du sable.
          float jitter = n1.x * 0.5 + n2.y * 0.5;
          float band = 1.0 - smoothstep(0.0, 0.2 + 0.07 * jitter, depth);
          float pulse = 0.55 + 0.45 * sin(depth * 24.0 - uTime * 1.5 + jitter * 6.0);
          float lap = (1.0 - smoothstep(0.0, 0.05, depth)) * 0.85;
          float foam = clamp(band * pulse * 0.75 + lap, 0.0, 1.0) * uFoamOn;
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
    mesh.renderOrder = 2; mesh.name = "mer"; mesh.userData.decorative = true; mesh.raycast = () => {};
    mesh.frustumCulled = false;
    mesh.userData.animated = profile.animatedWater;

    function update(time, view) {
      uniforms.uTime.value = profile.animatedWater ? time : 0;
      if (view?.sunDirection) uniforms.uSun.value.copy(view.sunDirection);
    }
    function dispose() { geometry.dispose(); material.dispose(); depthTexture.dispose(); mesh.removeFromParent(); }
    return { mesh, update, dispose };
  }

  E.WaterRenderer = { create };
}());
