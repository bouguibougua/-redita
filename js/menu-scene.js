(function () {
  'use strict';
  const E = window.Eredita;
  const cfg = E.Config.menu;
  const host = document.querySelector('#menu-environment');
  const menu = document.querySelector('#main-menu');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let THREE, renderer, scene, camera, sphere, flat, material, texture, panoramaTexture;
  let flatParticles, worldParticles, particleTexture;
  let panoramaGround;
  let ready = false, textureLoaded = false, active = false, immersive = false;
  let mode = 'cinematic', yaw = 0, pitch = 0, drag = null;
  let motionPaused = reducedMotion.matches, lastFrame = -Infinity, phase = 0, previousTime = null;
  let viewOffset = { x: 0, y: 0 }, needsRender = true, loadError = null;
  const $ = selector => document.querySelector(selector);

  const vertexShader = `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const fragmentShader = `
    uniform sampler2D uMap;
    uniform float uTime, uFlag, uMist, uFire;
    uniform vec2 uOffset, uFireCenter;
    varying vec2 vUv;
    float band(float a, float b, float x) { return smoothstep(a, a + .018, x) * (1.0 - smoothstep(b - .018, b, x)); }
    void main() {
      vec2 uv = vUv + uOffset;
      // Déformation localisée sur le tissu, le mât reste fixe.
      float flag = band(.062, .162, uv.x) * band(.45, .83, uv.y);
      float loose = smoothstep(.069, .15, uv.x);
      float wave = sin(uTime * 2.0 + uv.y * 35.0) + .35 * sin(uTime * 3.0 + uv.y * 61.0);
      uv.x += flag * loose * wave * uFlag;
      uv.y += flag * loose * sin(uTime * 2.0 + uv.x * 37.0) * uFlag * .55;
      vec4 base = texture2D(uMap, vec2(fract(uv.x), clamp(uv.y, .001, .999)));
      vec3 color = base.rgb;
      // Brasero à droite : lumière chaude sur la pierre et scintillement des flammes.
      vec2 fireDelta = (vUv - uFireCenter) * vec2(1.0, 1.5);
      float glow = exp(-dot(fireDelta, fireDelta) * 1800.0);
      float flicker = .6 + .22 * sin(uTime * 7.0) + .12 * sin(uTime * 13.0 + 1.0);
      color += vec3(1.0, .29, .025) * glow * flicker * uFire;
      float flame = exp(-dot(fireDelta, fireDelta) * 26000.0);
      color += vec3(1.0, .45, .07) * flame * (.5 + .5 * sin(uTime * 11.0 + uv.y * 160.0)) * uFire;
      // Brume lente au-dessus des rochers, sans post-traitement ni transparences superposées.
      float mist = band(.10, .39, vUv.y) * (.5 + .5 * sin(vUv.x * 24.0 + uTime + sin(vUv.y * 29.0)));
      color = mix(color, vec3(.35, .32, .27), mist * uMist);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`;

  function resize() {
    if (!renderer || immersive) return;
    const width = innerWidth, height = innerHeight;
    camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cfg.desktopFov / 2));
    flat.scale.set(h * camera.aspect, h, 1);
    // Le cadrage de référence occupe tout l'écran, sans étirer la photographie.
    const imageAspect = texture?.image ? texture.image.width / texture.image.height : 2;
    const scaleX = Math.min(1, camera.aspect / imageAspect);
    const scaleY = Math.min(1, imageAspect / camera.aspect);
    const uv = flat.geometry.attributes.uv;
    uv.setXY(0, .5 - scaleX / 2, .5 + scaleY / 2);
    uv.setXY(1, .5 + scaleX / 2, .5 + scaleY / 2);
    uv.setXY(2, .5 - scaleX / 2, .5 - scaleY / 2);
    uv.setXY(3, .5 + scaleX / 2, .5 - scaleY / 2); uv.needsUpdate = true;
    needsRender = true;
  }

  function particles(inWorld) {
    const positions = new Float32Array(cfg.particleCount * 3);
    const colors = new Float32Array(cfg.particleCount * 3);
    for (let i = 0; i < cfg.particleCount; i++) {
      const c = new THREE.Color(i % 5 === 0 ? '#f8c88c' : '#b96525');
      c.toArray(colors, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: inWorld ? .026 : .004, map: particleTexture, vertexColors: true,
      transparent: true, opacity: .68, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    points.frustumCulled = false; points.userData.inWorld = inWorld;
    return points;
  }

  function animateParticles(points, cycle) {
    const p = points.geometry.attributes.position;
    for (let i = 0; i < cfg.particleCount; i++) {
      const seed = (i * .61803398875) % 1;
      const rise = (cycle / (Math.PI * 2) + seed) % 1;
      if (points.userData.inWorld) {
        const angle = seed * Math.PI * 2;
        p.setXYZ(i, Math.cos(angle) * (2 + seed * 3) + .1 * Math.sin(cycle + i), rise * 3 - 1.3, Math.sin(angle) * (2 + seed * 3));
      } else {
        p.setXYZ(i, (seed - .5) * 1.8 + .025 * Math.sin(cycle + i), rise * 1.25 - .65, -.65 - (i % 4) * .07);
      }
    }
    p.needsUpdate = true;
  }

  function paint(seconds) {
    const cycle = seconds / cfg.animationSeconds * Math.PI * 2;
    const exploring = immersive || mode === 'panorama';
    material.uniforms.uMap.value = exploring ? panoramaTexture : texture;
    material.uniforms.uFlag.value = exploring ? 0 : cfg.flagAmplitude;
    material.uniforms.uFire.value = exploring ? 0 : cfg.fireStrength;
    panoramaGround?.update(immersive ? null : { position: camera.position, quaternion: camera.quaternion }, exploring && !immersive, 0);
    material.uniforms.uTime.value = cycle;
    material.uniforms.uOffset.value.set(mode === 'cinematic' && !immersive ? viewOffset.x : 0, mode === 'cinematic' && !immersive ? viewOffset.y : 0);
    animateParticles(flatParticles, cycle); animateParticles(worldParticles, cycle);
  }

  function animate(time, frame) {
    if ((!active && !immersive) || (!immersive && document.hidden)) { previousTime = null; return; }
    if (previousTime !== null && !motionPaused) phase += Math.min((time - previousTime) / 1000, .1);
    previousTime = time;
    if (!immersive && time - lastFrame < 1000 / cfg.desktopFps) return;
    if (motionPaused && !immersive && !needsRender) return;
    lastFrame = time;
    paint(phase);
    E.MenuVR?.update(time, frame);
    renderer.render(scene, camera); needsRender = false;
  }

  function setVisible(value) {
    active = Boolean(value); host.hidden = !active && !immersive;
    previousTime = null; needsRender = true;
    if (renderer && ready && !loadError) renderer.setAnimationLoop(active || immersive ? animate : null);
  }

  function syncVisibility() {
    const shown = (!E.Intro?.active || E.Intro?.closing) && !E.XR?.active && (!menu.hidden || !$('#menu-subscreen').hidden || !$('#connection-screen').hidden);
    setVisible(shown);
  }

  function setImmersive(value) {
    immersive = Boolean(value);
    panoramaGround?.reset();
    flat.visible = !immersive && mode === 'cinematic';
    flatParticles.visible = !immersive && mode === 'cinematic';
    worldParticles.visible = immersive || mode === 'panorama';
    sphere.visible = immersive || mode === 'panorama';
    if (!immersive) { camera.position.set(0, 0, 0); camera.rotation.set(pitch, yaw, 0, 'YXZ'); resize(); }
    syncVisibility();
  }

  function recenter() {
    mode = 'cinematic'; yaw = pitch = 0; viewOffset = { x: 0, y: 0 };
    if (camera && !immersive) camera.rotation.set(0, 0, 0);
    if (ready) setImmersive(immersive);
    $('#menu-look').textContent = 'Explorer le panorama'; $('#menu-look').setAttribute('aria-pressed', 'false');
    needsRender = true;
  }

  function explore() {
    if (!ready || immersive || mode === 'panorama') return;
    mode = 'panorama'; setImmersive(false);
    $('#menu-look').textContent = 'Recentrer le décor'; $('#menu-look').setAttribute('aria-pressed', 'true');
  }

  function setMotion(paused) {
    motionPaused = paused;
    $('#menu-motion').setAttribute('aria-pressed', String(paused));
    $('#menu-motion').textContent = `Animations : ${paused ? 'en pause' : 'actives'}`;
    needsRender = true;
  }

  function bindControls() {
    menu.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, a') || !ready) return;
      drag = { x: event.clientX, y: event.clientY, started: false, id: event.pointerId };
      menu.setPointerCapture(event.pointerId);
    });
    menu.addEventListener('pointermove', event => {
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.started && Math.abs(dx) + Math.abs(dy) < 3) return;
        drag.started = true; explore(); menu.classList.add('is-dragging');
        yaw -= dx * cfg.mouseSensitivity;
        pitch = Math.max(-cfg.maxPitch, Math.min(cfg.maxPitch, pitch - dy * cfg.mouseSensitivity));
        camera.rotation.set(pitch, yaw, 0, 'YXZ'); drag.x = event.clientX; drag.y = event.clientY;
        needsRender = true;
      } else if (!motionPaused && mode === 'cinematic') {
        viewOffset.x = (event.clientX / innerWidth - .5) * .004;
        viewOffset.y = -(event.clientY / innerHeight - .5) * .002; needsRender = true;
      }
    });
    const release = () => { drag = null; menu.classList.remove('is-dragging'); };
    menu.addEventListener('pointerup', release); menu.addEventListener('pointercancel', release);
    menu.addEventListener('lostpointercapture', release);
    $('#menu-look').addEventListener('click', () => mode === 'cinematic' ? explore() : recenter());
    $('#menu-motion').addEventListener('click', () => setMotion(!motionPaused));
    $('#menu-sound').addEventListener('click', () => {
      E.Audio.setMuted(!E.Audio.muted);
      $('#menu-sound').setAttribute('aria-pressed', String(E.Audio.muted));
      $('#menu-sound').textContent = `Son : ${E.Audio.muted ? 'coupé' : 'actif'}`;
    });
    reducedMotion.addEventListener('change', event => setMotion(event.matches));
    setMotion(motionPaused);
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { previousTime = null; needsRender = true; });
    const observer = new MutationObserver(syncVisibility);
    ['#main-menu', '#menu-subscreen', '#connection-screen'].forEach(selector => observer.observe($(selector), { attributes: true, attributeFilter: ['hidden'] }));
  }

  async function init() {
    bindControls(); syncVisibility();
    try {
      THREE = await import('./vendor/three.module.min.js');
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(cfg.desktopFov, 1, .01, cfg.sphereRadius + 10);
      scene.add(camera);
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, cfg.maxPixelRatio));
      renderer.xr.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.xr.setFramebufferScaleFactor(cfg.vrFramebufferScale);
      renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); loadError = 'Contexte WebGL perdu'; ready = false;
        renderer.setAnimationLoop(null); host.replaceChildren();
        $('#menu-status').textContent = 'Décor statique actif. Rechargez la page pour rétablir la 3D.';
        $('#menu-enter-vr').disabled = true;
      });
      host.append(renderer.domElement);
      const loader = new THREE.TextureLoader();
      [texture, panoramaTexture] = await Promise.all([
        loader.loadAsync(cfg.panorama),
        loader.loadAsync(cfg.explorationPanorama).catch(() => loader.loadAsync(cfg.panorama))
      ]);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping; texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      panoramaTexture.colorSpace = THREE.SRGBColorSpace;
      panoramaTexture.wrapS = THREE.RepeatWrapping; panoramaTexture.generateMipmaps = false;
      panoramaTexture.minFilter = THREE.LinearFilter; panoramaTexture.magFilter = THREE.LinearFilter;
      textureLoaded = true;
      material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: {
        uMap: { value: texture }, uTime: { value: 0 }, uOffset: { value: new THREE.Vector2() },
        uFlag: { value: cfg.flagAmplitude }, uMist: { value: cfg.mistOpacity }, uFire: { value: cfg.fireStrength },
        uFireCenter: { value: new THREE.Vector2(...cfg.fireCenter) }
      } });
      const geometry = new THREE.SphereGeometry(cfg.sphereRadius, 48, 32);
      geometry.scale(-1, 1, 1);
      sphere = new THREE.Mesh(geometry, material); sphere.rotation.y = -Math.PI / 2; sphere.visible = false; scene.add(sphere);
      flat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material); flat.position.z = -1; camera.add(flat);
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
      const ctx = sprite.getContext('2d'), gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, '#fff'); gradient.addColorStop(.15, '#fffc'); gradient.addColorStop(1, '#fff0');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32); particleTexture = new THREE.CanvasTexture(sprite);
      flatParticles = particles(false); worldParticles = particles(true); worldParticles.visible = false;
      camera.add(flatParticles); scene.add(worldParticles);
      panoramaGround = E.XREnvironment?.create({ THREE, scene, panorama: false, altarPreview: true });
      ready = true; resize(); setVisible(active); E.MenuVR?.checkSupport();
    } catch (error) {
      loadError = String(error.message || error); ready = false;
      renderer?.setAnimationLoop(null); renderer?.dispose(); host.replaceChildren();
      $('#menu-status').textContent = 'Décor statique actif. La navigation du jeu reste disponible.';
    }
  }

  // Export du décor animé : mêmes shaders, particules et source que le menu web.
  function captureFrame(seconds, width = 960, height = 480) {
    if (!ready || immersive) throw new Error('Le décor doit être prêt et hors VR pour exporter.');
    const saved = { mode, yaw, pitch, phase, ratio: renderer.getPixelRatio(), offset: viewOffset };
    mode = 'cinematic'; viewOffset = { x: 0, y: 0 }; camera.rotation.set(0, 0, 0);
    flat.visible = flatParticles.visible = true; sphere.visible = worldParticles.visible = false;
    renderer.setPixelRatio(1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(cfg.desktopFov / 2)); flat.scale.set(h * camera.aspect, h, 1);
    const uv = flat.geometry.attributes.uv; [[0,1],[1,1],[0,0],[1,0]].forEach((p,i) => uv.setXY(i,...p)); uv.needsUpdate = true;
    paint(seconds); renderer.render(scene, camera);
    const data = renderer.domElement.toDataURL('image/png');
    ({ mode, yaw, pitch, phase } = saved); viewOffset = saved.offset; renderer.setPixelRatio(saved.ratio);
    setImmersive(false); paint(phase); needsRender = true;
    return data;
  }

  E.MenuScene = { recenter, setImmersive, setVisible, captureFrame, refreshVisibility: syncVisibility,
    getContext: () => ready && !loadError ? { THREE, renderer, scene, camera } : null,
    get diagnostics() { return { ready, textureLoaded, active, immersive, mode, yaw, pitch, motionPaused, error: loadError,
      environmentAsset: immersive || mode === 'panorama' ? cfg.explorationPanorama : cfg.panorama,
      altarVisible: panoramaGround?.diagnostics.altarVisible || false }; }
  };
  init();
}());
