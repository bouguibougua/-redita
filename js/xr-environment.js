(function () {
  'use strict';
  const E = window.Eredita;

  // Décor de présentation, indépendant du groupe du plateau et de sa simulation.
  function create({ THREE, scene, session, world = null, getBoardDimensions = null, panorama = true, altarPreview = false }) {
    const cfg = E.Config.xr.environment;
    const group = new THREE.Group(); group.name = 'xr-corsican-environment'; group.visible = false;
    scene.add(group);
    let disposed = false, positioned = false, loaded = !panorama, opacity = 0;
    let referenceSpace = null, floorSpace = null, floorKnown = false;
    let texture = null, sky = null, groundPhoto = null;
    const altar = new THREE.Group(); altar.name = 'xr-stone-altar'; altar.visible = false; group.add(altar);
    const altarMaterials = [];
    if ((world || altarPreview) && cfg.altar.enabled) {
      const stone = new THREE.MeshBasicMaterial({ color: cfg.altar.stoneColor, transparent: true });
      const side = new THREE.MeshBasicMaterial({ color: cfg.altar.sideColor, transparent: true });
      const bronze = new THREE.MeshBasicMaterial({ color: cfg.altar.bronzeColor, transparent: true });
      altarMaterials.push(stone, side, bronze);
      const block = (width, height, depth, y, material) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
        mesh.position.y = y; altar.add(mesh); return mesh;
      };
      block(1, .12, 1, -.06, [side, side, stone, side, side, side]);
      block(.84, .76, .84, -.50, [side, side, stone, side, stone, stone]);
      block(.94, .12, .94, -.94, [side, side, stone, side, side, side]);
      block(.89, .025, .89, -.16, bronze);
      for (const sign of [-1, 1]) {
        const seal = new THREE.Mesh(new THREE.BoxGeometry(.1, .13, .015), bronze);
        seal.position.set(0, -.48, sign * .43); seal.rotation.z = Math.PI / 4; altar.add(seal);
      }
    }
    const boardPosition = new THREE.Vector3(), boardScale = new THREE.Vector3(), boardRotation = new THREE.Quaternion();
    const previewPosition = new THREE.Vector3(), previewRotation = new THREE.Quaternion();
    function updateAltar() {
      if (!world && altarPreview && cfg.altar.enabled) {
        altar.position.copy(previewPosition); altar.quaternion.copy(previewRotation);
        altar.scale.set(cfg.altar.previewWidth, cfg.altar.previewHeight, cfg.altar.previewDepth);
        altarMaterials.forEach(material => { material.opacity = opacity; }); altar.visible = true; return;
      }
      if (!world || !cfg.altar.enabled || world.visible === false || world.parent?.visible === false) { altar.visible = false; return; }
      world.updateWorldMatrix(true, false);
      world.matrixWorld.decompose(boardPosition, boardRotation, boardScale);
      const size = getBoardDimensions?.() || { width: E.Config.xr.boardWidth, depth: 11.05 };
      const boardBottom = new THREE.Vector3(0, E.Config.xr.boardBottom, 0).applyMatrix4(world.matrixWorld);
      altar.position.copy(boardBottom).sub(group.position);
      altar.quaternion.copy(boardRotation);
      altar.scale.set(size.width * boardScale.x + cfg.altar.widthMargin,
        Math.max(cfg.altar.minHeight, boardBottom.y - group.position.y), size.depth * boardScale.z + cfg.altar.depthMargin);
      altarMaterials.forEach(material => { material.opacity = opacity; });
      altar.visible = true;
    }

    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cfg.groutColor; ctx.fillRect(0, 0, 512, 512);
    // Pavage léger et répétable, un seul matériau sans éclairage/ombres coûteux.
    for (let row = 0; row < 8; row++) {
      for (let column = -1; column < 5; column++) {
        const x = column * 128 + (row % 2) * 64;
        const seed = (row * 7 + column * 11 + 55) % 9;
        ctx.fillStyle = seed % 3 === 0 ? cfg.stoneColor : cfg.groundColor;
        ctx.fillRect(x + 2, row * 64 + 2, 124, 60);
        ctx.strokeStyle = 'rgba(218,183,127,.1)'; ctx.strokeRect(x + 4, row * 64 + 4, 120, 56);
        ctx.fillStyle = 'rgba(0,0,0,.05)'; ctx.fillRect(x + 8 + seed * 5, row * 64 + 12, 35, 2);
      }
    }
    const groundTexture = new THREE.CanvasTexture(canvas);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(cfg.floorRadius * 2 / cfg.floorTileMeters, cfg.floorRadius * 2 / cfg.floorTileMeters);
    const groundMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { uMap: { value: groundTexture }, uRepeat: { value: cfg.floorRadius * 2 / cfg.floorTileMeters },
        uOpacity: { value: 0 }, uEdge: { value: cfg.floorEdgeStart } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D uMap; uniform float uRepeat, uOpacity, uEdge; varying vec2 vUv;
        void main() {
          float edge = 1.0 - smoothstep(uEdge, .5, distance(vUv, vec2(.5)));
          gl_FragColor = vec4(texture2D(uMap, vUv * uRepeat).rgb, edge * uOpacity);
          #include <colorspace_fragment>
        }`
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(cfg.floorRadius, 64), groundMaterial);
    ground.name = 'xr-stone-ground'; ground.rotation.x = -Math.PI / 2;
    // Le fond puis le sol transparent sont dessinés avant les fenêtres XR.
    ground.renderOrder = -1; group.add(ground);
    new THREE.TextureLoader().load(cfg.groundTexture, image => {
      if (disposed) { image.dispose(); return; }
      groundPhoto = image; image.colorSpace = THREE.SRGBColorSpace;
      image.wrapS = image.wrapT = THREE.RepeatWrapping;
      groundMaterial.uniforms.uMap.value = image;
      altarMaterials.slice(0, 2).forEach(material => { material.map = image; material.needsUpdate = true; });
    }, undefined, () => { /* Le pavage de repli reste visible. */ });

    if (panorama) {
      const geometry = new THREE.SphereGeometry(cfg.sphereRadius, cfg.sphereSegments, cfg.sphereSegments / 2);
      geometry.scale(-1, 1, 1);
      sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sky.name = 'xr-panorama'; sky.rotation.y = -Math.PI / 2; sky.renderOrder = -2; group.add(sky);
      new THREE.TextureLoader().load(cfg.panorama, image => {
        if (disposed) { image.dispose(); return; }
        texture = image; image.colorSpace = THREE.SRGBColorSpace;
        image.generateMipmaps = false; image.minFilter = THREE.LinearFilter; image.wrapS = THREE.RepeatWrapping;
        sky.material.map = image; sky.material.needsUpdate = true; loaded = true;
      }, undefined, () => { loaded = false; });
    }
    // Si disponible, le repère du sol donne la vraie hauteur du pavage, même assis.
    session?.requestReferenceSpace?.('local-floor').then(space => {
      if (!disposed) { floorSpace = space; positioned = false; }
    }).catch(() => {});

    function update(viewer, enabled, delta = 0, frame = null) {
      if (disposed) return;
      // Placement/replacement : la vraie pièce redevient visible immédiatement.
      if (!enabled || !viewer || !loaded) { opacity = 0; group.visible = false; return; }
      const pose = floorSpace && referenceSpace && frame?.getPose(floorSpace, referenceSpace);
      if (positioned && !floorKnown && pose) {
        const previousFloorY = group.position.y;
        group.position.y = pose.transform.position.y;
        if (sky) sky.position.y += previousFloorY - group.position.y;
        floorKnown = true;
      }
      if (!positioned) {
        let floorY = viewer.position.y - cfg.fallbackEyeHeight;
        if (pose) { floorY = pose.transform.position.y; floorKnown = true; }
        group.position.set(viewer.position.x, floorY, viewer.position.z);
        const q = viewer.quaternion || viewer.orientation;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q); forward.y = 0;
        if (forward.lengthSq() < .001) forward.set(0, 0, -1);
        forward.normalize();
        previewPosition.copy(forward).multiplyScalar(cfg.altar.previewDistance); previewPosition.y = cfg.altar.previewHeight;
        previewRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-forward.x, -forward.z));
        if (sky) {
          sky.position.y = viewer.position.y - floorY;
          sky.rotation.y = -Math.PI / 2 + Math.atan2(-forward.x, -forward.z);
        }
        positioned = true;
      }
      opacity = panorama ? Math.min(1, opacity + Math.max(0, delta) / cfg.fadeSeconds) : 1;
      group.visible = true;
      groundMaterial.opacity = opacity;
      groundMaterial.uniforms.uOpacity.value = opacity;
      if (sky) sky.material.opacity = opacity;
      updateAltar();
    }

    function dispose() {
      if (disposed) return;
      disposed = true; scene.remove(group);
      ground.geometry.dispose(); groundMaterial.dispose(); groundTexture.dispose();
      groundPhoto?.dispose();
      altar.children.forEach(mesh => mesh.geometry.dispose());
      altarMaterials.forEach(material => material.dispose());
      sky?.geometry.dispose(); sky?.material.dispose(); texture?.dispose();
    }
    return { group, update, dispose,
      setReferenceSpace(space) { referenceSpace = space; },
      reset() { positioned = false; floorKnown = false; group.visible = false; opacity = 0; },
      get diagnostics() { return { visible: group.visible, loaded, opacity, floorY: group.position.y, floorKnown, groundLoaded: Boolean(groundPhoto),
        altarVisible: group.visible && altar.visible, altarTop: altar.position.y + group.position.y }; }
    };
  }
  E.XREnvironment = { create };
}());
