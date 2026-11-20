(function () {
  "use strict";
  // Post-traitement de la version PC (jamais en VR/MR) : la scène est rendue dans une cible HDR
  // (MSAA + profondeur), puis une passe plein écran applique l'occlusion ambiante, la brume
  // atmosphérique (les plans de montagnes se détachent), la brume de vallée, le tone mapping ACES,
  // un étalonnage chaud/froid et un vignettage. Aucune incidence sur la sélection ni les règles.
  const E = window.Eredita = window.Eredita || {};

  const VERTEX = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  const COMMON = `
    uniform sampler2D tDepth; uniform mat4 uProjInv; uniform float uAspect;
    vec3 viewPositionAt(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      return v.xyz / v.w;
    }
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  `;

  // Occlusion ambiante à demi-résolution, depuis la profondeur seule (normales reconstruites).
  const AO_FRAGMENT = `
    varying vec2 vUv;
    uniform vec2 uTexel; uniform float uRadius, uIntensity, uProjScale;
    ${COMMON}
    void main() {
      float depth = texture2D(tDepth, vUv).x;
      if (depth >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = viewPositionAt(vUv);
      vec3 pr = viewPositionAt(vUv + vec2(uTexel.x, 0.0)), pl = viewPositionAt(vUv - vec2(uTexel.x, 0.0));
      vec3 pu = viewPositionAt(vUv + vec2(0.0, uTexel.y)), pd = viewPositionAt(vUv - vec2(0.0, uTexel.y));
      vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
      vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
      vec3 N = normalize(cross(dx, dy));
      float radiusUv = clamp(uRadius * uProjScale / max(-P.z, 0.01), 2.5 * uTexel.y, 0.09);
      float angle = ign(gl_FragCoord.xy) * 6.2831853, occlusion = 0.0, range = uRadius * uRadius * 4.0;
      for (int i = 0; i < AO_SAMPLES; i++) {
        float t = (float(i) + 0.5) / float(AO_SAMPLES);
        float a = angle + float(i) * 2.3999632;
        vec3 v = viewPositionAt(vUv + vec2(cos(a) / uAspect, sin(a)) * radiusUv * sqrt(t)) - P;
        float d2 = dot(v, v);
        occlusion += max(0.0, dot(N, v) * inversesqrt(d2 + 1e-5) - 0.06) * clamp(1.0 - d2 / range, 0.0, 1.0);
      }
      gl_FragColor = vec4(vec3(clamp(1.0 - uIntensity * occlusion / float(AO_SAMPLES), 0.0, 1.0)), 1.0);
    }`;

  const COMPOSITE_FRAGMENT = `
    varying vec2 vUv;
    uniform sampler2D tColor, tAO; uniform vec2 uAOTexel; uniform float uAOStrength;
    uniform mat4 uCamWorld; uniform vec3 uCamPos, uSunDir;
    uniform vec3 uHazeColor, uHazeSunColor, uMistColor, uShadowTint, uHighlightTint;
    uniform float uHazeStart, uHazeDensity, uMistDensity, uMistBase, uMistHeight;
    uniform float uExposure, uSaturation, uContrast, uVignette;
    ${COMMON}
    vec3 rrtOdtFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
    vec3 acesFilmic(vec3 c) {
      const mat3 inputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
      const mat3 outputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
      return clamp(outputMat * rrtOdtFit(inputMat * (c / 0.6)), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float viewDepth(vec2 uv) { return -viewPositionAt(uv).z; }
    void main() {
      vec3 color = texture2D(tColor, vUv).rgb;
      float depth = texture2D(tDepth, vUv).x;
      bool sky = depth >= 0.99999;
      vec3 P = viewPositionAt(vUv);
      vec3 W = (uCamWorld * vec4(P, 1.0)).xyz;
      float dist = sky ? 1e4 : length(P);
      vec3 ray = normalize((uCamWorld * vec4(P, 0.0)).xyz);
      #ifdef USE_AO
      if (!sky) {
        // Flou bilatéral léger de l'AO demi-résolution (évite les halos aux silhouettes).
        float center = -P.z, total = 0.0, weight = 0.0;
        for (int k = 0; k < 5; k++) {
          vec2 o = k == 0 ? vec2(0.0) : vec2(k == 1 || k == 2 ? 1.0 : -1.0, k == 1 || k == 3 ? 1.0 : -1.0) * uAOTexel;
          float w = exp(-abs(viewDepth(vUv + o) - center) * 6.0 / max(center * 0.05, 0.05));
          total += texture2D(tAO, vUv + o).r * w; weight += w;
        }
        color *= mix(1.0, total / max(weight, 1e-4), uAOStrength);
      }
      #endif
      // Perspective atmosphérique : bleutée, réchauffée face au soleil ; brume blanche au fond des vallées.
      float haze = sky ? 1.0 : 1.0 - exp(-max(0.0, dist - uHazeStart) * uHazeDensity);
      float mist = sky ? 0.0 : (1.0 - exp(-max(0.0, dist - uHazeStart * 1.15) * uMistDensity)) * (1.0 - smoothstep(uMistBase, uMistBase + uMistHeight, W.y));
      vec3 hazeColor = mix(uHazeColor, uHazeSunColor, pow(max(dot(ray, uSunDir), 0.0), 5.0) * 0.7);
      color = mix(color, hazeColor, clamp(haze, 0.0, 1.0));
      color = mix(color, uMistColor, clamp(mist, 0.0, 0.8));
      vec3 c = toSRGB(acesFilmic(color * uExposure));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      c *= mix(uShadowTint, uHighlightTint, smoothstep(0.1, 0.9, l));
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
      c += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  function create(THREE, { renderer }) {
    const cfg = E.Config.postProcessing;
    const color = (hex, intensity = 1) => new THREE.Color(hex).multiplyScalar(intensity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(geometry); quad.frustumCulled = false;
    const quadScene = new THREE.Scene(); quadScene.add(quad);
    const shared = { tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uAspect: { value: 1 } };
    const compositeUniforms = {
      ...shared, tColor: { value: null }, tAO: { value: null }, uAOTexel: { value: new THREE.Vector2() }, uAOStrength: { value: cfg.aoStrength },
      uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uHazeColor: { value: color(cfg.hazeColor, cfg.hazeIntensity) }, uHazeSunColor: { value: color(cfg.hazeSunColor, cfg.hazeIntensity) },
      uMistColor: { value: color(cfg.mistColor, cfg.mistIntensity) },
      uShadowTint: { value: new THREE.Vector3(...cfg.shadowTint) }, uHighlightTint: { value: new THREE.Vector3(...cfg.highlightTint) },
      uHazeStart: { value: 20 }, uHazeDensity: { value: cfg.hazeDensity }, uMistDensity: { value: cfg.mistDensity },
      uMistBase: { value: E.Config.environment3d.waterLevel }, uMistHeight: { value: cfg.mistHeight },
      uExposure: { value: cfg.exposure }, uSaturation: { value: cfg.saturation }, uContrast: { value: cfg.contrast }, uVignette: { value: cfg.vignette }
    };
    const aoUniforms = { ...shared, uTexel: { value: new THREE.Vector2() }, uRadius: { value: cfg.aoRadius }, uIntensity: { value: cfg.aoIntensity }, uProjScale: { value: 1 } };
    const materials = new Map();
    let target = null, aoTarget = null, size = "", aoSamples = -1;
    const drawing = new THREE.Vector2();

    function material(key, build) { if (!materials.has(key)) materials.set(key, build()); return materials.get(key); }
    const compositeMaterial = (ao) => material(`composite:${ao}`, () => new THREE.ShaderMaterial({
      uniforms: compositeUniforms, vertexShader: VERTEX, fragmentShader: COMPOSITE_FRAGMENT, defines: ao ? { USE_AO: "" } : {},
      depthTest: false, depthWrite: false }));
    const aoMaterial = (samples) => material(`ao:${samples}`, () => new THREE.ShaderMaterial({
      uniforms: aoUniforms, vertexShader: VERTEX, fragmentShader: AO_FRAGMENT, defines: { AO_SAMPLES: samples }, depthTest: false, depthWrite: false }));

    function releaseTargets() {
      target?.depthTexture?.dispose(); target?.dispose(); aoTarget?.dispose(); target = aoTarget = null; size = "";
    }

    function ensureTargets(profile) {
      renderer.getDrawingBufferSize(drawing);
      const w = Math.max(1, drawing.x), h = Math.max(1, drawing.y), samples = profile.antialias ? 4 : 0, ao = profile.ao || 0;
      const key = `${w}x${h}:${samples}:${ao > 0}`;
      if (key === size) return;
      releaseTargets(); size = key;
      target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(w, h) });
      target.texture.name = "eredita-post-couleur";
      if (ao > 0) {
        aoTarget = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { type: THREE.UnsignedByteType, depthBuffer: false });
        aoUniforms.uTexel.value.set(2 / w, 2 / h); compositeUniforms.uAOTexel.value.set(2 / w, 2 / h);
      }
    }

    // unitScale : unités de scène par unité du paysage (paysage réduit autour des villages agrandis) ;
    // les longueurs réglées dans le paysage (rayon d'AO, brume, nappe) suivent cette réduction.
    function render(scene, camera, { profile, focusDistance = 20, sunDirection, unitScale = 1 } = {}) {
      ensureTargets(profile);
      aoUniforms.uRadius.value = cfg.aoRadius * unitScale;
      compositeUniforms.uHazeDensity.value = cfg.hazeDensity / unitScale;
      compositeUniforms.uMistDensity.value = cfg.mistDensity / unitScale;
      compositeUniforms.uMistHeight.value = cfg.mistHeight * unitScale;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      shared.tDepth.value = target.depthTexture; shared.uProjInv.value.copy(camera.projectionMatrixInverse); shared.uAspect.value = camera.aspect;
      const ao = aoTarget && profile.ao > 0;
      if (ao) {
        aoUniforms.uProjScale.value = camera.projectionMatrix.elements[5] * 0.5;
        quad.material = aoMaterial(profile.ao);
        renderer.setRenderTarget(aoTarget); renderer.render(quadScene, quadCamera);
        compositeUniforms.tAO.value = aoTarget.texture;
      }
      compositeUniforms.tColor.value = target.texture;
      compositeUniforms.uCamWorld.value.copy(camera.matrixWorld); compositeUniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      if (sunDirection) compositeUniforms.uSunDir.value.copy(sunDirection);
      compositeUniforms.uHazeStart.value = focusDistance * cfg.hazeStartFactor;
      quad.material = compositeMaterial(Boolean(ao));
      renderer.setRenderTarget(previous); renderer.render(quadScene, quadCamera);
    }

    function dispose() { releaseTargets(); materials.forEach((m) => m.dispose()); materials.clear(); geometry.dispose(); }
    return { render, dispose, get size() { return size; } };
  }

  E.PostProcessing = { create };
}());
