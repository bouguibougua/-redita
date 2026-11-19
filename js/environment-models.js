(function () {
  "use strict";
  // Modèles Tripo du décor PC (arbres, maquis, rochers) : chargés une seule fois, normalisés à la taille
  // des formes procédurales, partagés entre reconstructions du paysage. Couleurs de sommets seulement.
  // Tout échec laisse la forme procédurale : le jeu n'en dépend jamais.
  const E = window.Eredita = window.Eredita || {};
  let loading = null, models = null;

  // Géométrie non indexée → position, normal, color (RGB flottant), base à y = 0, pied au centre.
  function normalize(THREE, scene, spec) {
    const parts = [];
    scene.updateMatrixWorld(true);
    scene.traverse((item) => {
      if (!item.isMesh) return;
      const g = item.geometry.clone().applyMatrix4(item.matrixWorld);
      const flat = g.index ? g.toNonIndexed() : g;
      if (flat !== g) g.dispose();
      const count = flat.attributes.position.count, source = flat.attributes.color;
      const color = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        color[i * 3] = source ? source.getX(i) : 0.6; color[i * 3 + 1] = source ? source.getY(i) : 0.6; color[i * 3 + 2] = source ? source.getZ(i) : 0.6;
      }
      const clean = new THREE.BufferGeometry();
      clean.setAttribute("position", flat.attributes.position);
      if (!flat.attributes.normal) flat.computeVertexNormals();
      clean.setAttribute("normal", flat.attributes.normal);
      clean.setAttribute("color", new THREE.BufferAttribute(color, 3));
      parts.push(clean);
    });
    if (!parts.length) return null;
    const merged = parts.length === 1 ? parts[0] : E.EnvironmentModels.mergeUtils.mergeGeometries(parts, false);
    if (parts.length > 1) parts.forEach((part) => part.dispose());
    merged.computeBoundingBox();
    const box = merged.boundingBox, sizeVector = box.getSize(new THREE.Vector3());
    const reference = spec.fit === "width" ? Math.max(sizeVector.x, sizeVector.z) : sizeVector.y;
    const scale = reference > 1e-6 ? spec.size / reference : 1;
    merged.translate(0, -box.min.y, 0).scale(scale, scale, scale);
    const colors = merged.attributes.color, positions = merged.attributes.position, b = spec.brightness ?? 1, top = spec.size * (spec.fit === "height" ? 1 : 0.6);
    // Houppiers : base et intérieur plus sombres, sommet éclairé (lecture claire en vue RTS).
    for (let i = 0; i < colors.count; i++) {
      const shade = spec.shade ? 0.6 + 0.42 * Math.min(1, Math.max(0, positions.getY(i) / Math.max(1e-4, top))) : 1;
      for (let c = 0; c < 3; c++) colors.array[i * 3 + c] = Math.min(1, colors.array[i * 3 + c] * b * shade * (spec.tint ? spec.tint[c] : 1));
    }
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    merged.userData.sharedModel = true;
    return merged;
  }

  function load(THREE) {
    if (loading) return loading;
    const specs = E.Config.environment3d.models || {};
    loading = Promise.all([import("./vendor/GLTFLoader.js"), import("./vendor/BufferGeometryUtils.js")]).then(async ([{ GLTFLoader }, utils]) => {
      E.EnvironmentModels.mergeUtils = utils;
      const loader = new GLTFLoader(), result = {};
      const one = async (key, spec, far) => {
        const url = far ? spec.src.replace(/\.glb$/, "_far.glb") : spec.src;
        try {
          const asset = await loader.loadAsync(new URL(url, document.baseURI).href);
          const geometry = normalize(THREE, asset.scene, spec);
          if (geometry) (result[key] ||= {})[far ? "far" : "near"] = geometry;
        } catch (error) { console.warn(`Décor 3D : ${url} indisponible, forme procédurale conservée.`, error?.message || error); }
      };
      await Promise.all(Object.entries(specs).flatMap(([key, spec]) => [one(key, spec, false), one(key, spec, true)]));
      // Lointain trop lourd (feuillages en îlots, impossibles à réduire) : forme procédurale lointaine.
      const budget = E.Config.environment3d.modelFarMaxTriangles || 600;
      for (const entry of Object.values(result)) {
        if (entry.far && entry.far.attributes.position.count / 3 > budget) { if (entry.far !== entry.near) entry.far.dispose(); delete entry.far; }
      }
      models = result;
      return result;
    }).catch((error) => { console.warn("Décor 3D : modèles indisponibles", error); models = {}; return models; });
    return loading;
  }

  E.EnvironmentModels = { load, get ready() { return models; }, mergeUtils: null };
}());
