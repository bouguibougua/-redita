(function () {
  "use strict";
  const E = window.Eredita;
  function create({ THREE, world, terrainGroup, panels }) {
    const overlay = new THREE.Group();
    overlay.name = "xr-village-targets";
    world.add(overlay);
    const targets = [];
    const raycaster = new THREE.Raycaster();
    raycaster.far = E.Config.xr.rayLength;
    let terrainVersion = null;
    function clear() {
      overlay.children.slice().forEach((item) => { overlay.remove(item); item.geometry.dispose(); item.material.dispose(); });
      targets.length = 0;
    }
    function sync() {
      if (terrainVersion === terrainGroup.children[0]) return;
      terrainVersion = terrainGroup.children[0];
      clear();
      terrainGroup.traverse((item) => {
        if (item.userData.xrTarget?.kind !== "village") return;
        const position = item.position.clone().add(item.parent.position);
        const target = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.5, 1.05), new THREE.MeshBasicMaterial({ visible: false }));
        target.position.copy(position).add(new THREE.Vector3(0, 0.55, 0));
        target.userData.xrTarget = item.userData.xrTarget;
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 24), new THREE.MeshBasicMaterial({ color: 0x6cffba, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(position); ring.position.y += 0.02;
        ring.visible = false;
        target.userData.ring = ring;
        overlay.add(target, ring);
        targets.push(target);
      });
    }
    return {
      sync, targets,
      hit(record, allowVillages) {
        raycaster.set(record.position, record.direction);
        const objects = panels.group.visible ? panels.targets.slice() : [];
        if (allowVillages && world.parent.visible) objects.push(...targets);
        return raycaster.intersectObjects(objects, false)[0] || null;
      },
      highlight(objects, selected) {
        targets.forEach((target) => {
          const data = target.userData.xrTarget;
          const chosen = selected?.playerId === data.playerId && selected?.lane === data.lane;
          target.userData.ring.visible = objects.has(target) || chosen;
          target.userData.ring.material.color.setHex(chosen ? 0xffdf72 : 0x6cffba);
        });
        panels.highlight(objects);
      },
      dispose() { clear(); world.remove(overlay); }
    };
  }
  E.XRInteractions = { create };
}());
