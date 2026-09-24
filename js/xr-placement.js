(function () {
  "use strict";
  const E = window.Eredita;
  function create({ THREE, session, root, scene, playerId, manualOnly, status }) {
    const cfg = E.Config.xr;
    const sources = new Map();
    let disposed = false;
    let manual = manualOnly;
    let placed = false;
    let candidate = null;
    let preferred = null;
    let manualHeight = null;
    let anchor = null;
    let anchorGeneration = 0;
    let needsAnchor = false;
    let initialViewer = null;
    let savedPlacement = null;
    let gripStart = null;
    let requestedAt = null;
    let referenceSpace;
    let latestViewer;
    root.scale.setScalar(cfg.initialWidth / cfg.boardWidth);
    root.visible = false;
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0x6cffba, side: THREE.DoubleSide }));
    reticle.rotation.x = -Math.PI / 2;
    reticle.visible = false;
    scene.add(reticle);

    function releaseAnchor() {
      anchorGeneration++;
      anchor?.delete(); anchor = null; needsAnchor = false;
    }
    function yaw(position) {
      return Math.atan2(initialViewer.x - position.x, initialViewer.z - position.z) + (playerId === "red" ? Math.PI : 0);
    }
    function inRange(position, viewer) {
      const distance = Math.hypot(position.x - viewer.position.x, position.z - viewer.position.z);
      return distance >= cfg.minDistance && distance <= cfg.maxDistance &&
        position.y <= viewer.position.y - cfg.minBelowEyes && position.y >= viewer.position.y - cfg.maxBelowEyes;
    }
    function constrain(viewer) {
      const offset = root.position.clone().sub(viewer.position); offset.y = 0;
      const length = offset.length();
      if (length < 0.001) offset.set(0, 0, -1);
      offset.setLength(THREE.MathUtils.clamp(length, cfg.minDistance, cfg.maxDistance));
      root.position.x = viewer.position.x + offset.x; root.position.z = viewer.position.z + offset.z;
      root.position.y = THREE.MathUtils.clamp(root.position.y, viewer.position.y - cfg.maxBelowEyes, viewer.position.y - cfg.minBelowEyes);
      root.scale.setScalar(THREE.MathUtils.clamp(root.scale.x, cfg.minWidth / cfg.boardWidth, cfg.maxWidth / cfg.boardWidth));
    }
    function requestSource(record) {
      const source = record.source;
      if (sources.has(source) || !session.requestHitTestSource) return;
      const entry = { hit: null };
      sources.set(source, entry);
      try { session.requestHitTestSource({ space: source.targetRaySpace }).then((hit) => {
        if (disposed || sources.get(source) !== entry) hit.cancel();
        else entry.hit = hit;
      }).catch(() => { entry.failed = true; }); } catch (_) { entry.failed = true; }
    }
    function followAnchor(frame) {
      if (!anchor) return;
      const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
      root.visible = Boolean(pose);
      if (pose) {
        root.position.copy(pose.transform.position);
        root.quaternion.copy(pose.transform.orientation);
      } else status("Suivi du plateau perdu. Regardez autour de vous ou utilisez Recentrer.");
    }
    function createAnchor(frame) {
      needsAnchor = false;
      if (!frame.createAnchor || typeof XRRigidTransform === "undefined" ||
          (session.enabledFeatures && !session.enabledFeatures.includes("anchors"))) return;
      const generation = ++anchorGeneration;
      const transform = new XRRigidTransform(
        { x: root.position.x, y: root.position.y, z: root.position.z },
        { x: root.quaternion.x, y: root.quaternion.y, z: root.quaternion.z, w: root.quaternion.w }
      );
      // Appel pendant l'image XR active, jamais à partir d'une promesse différée.
      try {
        frame.createAnchor(transform, referenceSpace).then((created) => {
          if (disposed || generation !== anchorGeneration) created.delete();
          else anchor = created;
        }).catch(() => status("Plateau conservé dans cette session ; ancre indisponible."));
      } catch (_) { status("Plateau conservé dans cette session ; ancre indisponible."); }
    }
    function preview(next) {
      candidate = next;
      root.visible = Boolean(next);
      reticle.visible = Boolean(next);
      if (!next) return;
      root.position.copy(next.position);
      root.rotation.set(0, yaw(next.position), 0);
      reticle.position.copy(next.position); reticle.position.y += 0.004;
      reticle.material.color.setHex(manual ? 0xffd778 : 0x6cffba);
    }
    function update(frame, space, records, viewer, timestamp) {
      referenceSpace = space;
      latestViewer = viewer;
      if (!initialViewer) initialViewer = viewer.position.clone();
      if (manualHeight === null) manualHeight = viewer.position.y - cfg.manualBelowEyes;
      if (requestedAt === null) requestedAt = timestamp;
      for (const [source, entry] of sources) {
        if (!records.some((record) => record.source === source)) { entry.hit?.cancel(); sources.delete(source); }
      }
      if (placed) {
        if (!anchor) root.visible = true;
        followAnchor(frame);
        if (needsAnchor) createAnchor(frame);
        return;
      }
      const tracked = records.filter((record) => record.tracked).sort((a, b) => {
        const priority = (r) => r === preferred ? 0 : r.source.handedness === "right" ? 1 : 2;
        return priority(a) - priority(b);
      });
      let next = null;
      for (const record of tracked) {
        if (manual) {
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -manualHeight);
          const position = new THREE.Ray(record.position, record.direction).intersectPlane(plane, new THREE.Vector3());
          if (position && record.direction.y < -0.05 && inRange(position, viewer)) { next = { record, position }; break; }
        } else {
          requestSource(record);
          const hitSource = sources.get(record.source)?.hit;
          if (!hitSource) continue;
          let results;
          try { results = frame.getHitTestResults(hitSource); } catch (_) { continue; }
          for (const hit of results) {
            const pose = hit.getPose(space);
            if (!pose) continue;
            const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
            const normal = new THREE.Vector3(0, 1, 0).transformDirection(matrix);
            const position = new THREE.Vector3().setFromMatrixPosition(matrix);
            if (normal.y >= cfg.surfaceNormalMin && inRange(position, viewer)) { next = { record, position }; break; }
          }
          if (next) break;
        }
      }
      if (next && !candidate) status(manual ? "Plan manuel proposé. Vérifiez sa hauteur puis confirmez." : "Surface proposée. Confirmez si le repère est sur votre table.");
      preview(next);
      if (!manual && !next && timestamp - requestedAt > cfg.hitTestTimeoutMs) {
        status("Aucune surface exploitable. Essayez le placement manuel.");
      }
    }

    function confirm(record) {
      if (!candidate) { status("Visez une surface accessible, ou utilisez le placement manuel."); return false; }
      if (record !== candidate.record) {
        preferred = record;
        status("Visez avec ce contrôleur puis confirmez son repère.");
        return false;
      }
      placed = true; savedPlacement = null; reticle.visible = false; needsAnchor = true;
      status("Plateau placé. Pointez un village pour le consulter.");
      return true;
    }
    function beginPlacement() {
      releaseAnchor();
      savedPlacement = placed ? { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() } : null;
      placed = false; candidate = null; gripStart = null; root.visible = false; requestedAt = null;
      if (latestViewer) initialViewer = latestViewer.position.clone();
    }
    function cancelPlacement() {
      if (!savedPlacement) return false;
      root.position.copy(savedPlacement.position); root.quaternion.copy(savedPlacement.quaternion); root.scale.copy(savedPlacement.scale);
      root.visible = true; placed = true; savedPlacement = null; candidate = null; reticle.visible = false; needsAnchor = true;
      return true;
    }
    function manipulate(records, viewer, dt) {
      if (!placed) return;
      const grips = records.filter((r) => r.tracked && r.squeezing);
      const key = grips.map((r) => records.indexOf(r)).join(",");
      if (grips.length) {
        if (!gripStart || gripStart.key !== key) {
          gripStart = { key, position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.x, points: grips.map((r) => r.gripPosition.clone()) };
        }
        const start = gripStart;
        if (grips.length === 1) root.position.copy(start.position).add(grips[0].gripPosition).sub(start.points[0]);
        else {
          const oldVector = start.points[1].clone().sub(start.points[0]);
          const newVector = grips[1].gripPosition.clone().sub(grips[0].gripPosition);
          if (oldVector.length() >= cfg.minGripSeparation && newVector.length() >= cfg.minGripSeparation) {
            const scale = THREE.MathUtils.clamp(start.scale * newVector.length() / oldVector.length(), cfg.minWidth / cfg.boardWidth, cfg.maxWidth / cfg.boardWidth);
            const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(newVector.x, newVector.z) - Math.atan2(oldVector.x, oldVector.z));
            const oldMid = start.points[0].clone().add(start.points[1]).multiplyScalar(0.5);
            const newMid = grips[0].gripPosition.clone().add(grips[1].gripPosition).multiplyScalar(0.5);
            root.position.copy(start.position).sub(oldMid).multiplyScalar(scale / start.scale).applyQuaternion(rotation).add(newMid);
            root.quaternion.copy(rotation).multiply(start.quaternion); root.scale.setScalar(scale);
          }
        }
      } else {
        gripStart = null;
        const left = records.find((r) => r.tracked && r.source.handedness === "left");
        const right = records.find((r) => r.tracked && r.source.handedness === "right");
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion); forward.y = 0; forward.normalize();
        const side = new THREE.Vector3(-forward.z, 0, forward.x);
        if (left) root.position.addScaledVector(side, left.axes[0] * cfg.moveSpeed * dt).addScaledVector(forward, -left.axes[1] * cfg.moveSpeed * dt);
        if (right) root.rotateY(-right.axes[0] * cfg.turnSpeed * dt);
      }
      constrain(viewer);
    }
    return {
      update, confirm, beginPlacement, cancelPlacement, manipulate,
      get placed() { return placed; }, get manual() { return manual; },
      get manualOnly() { return manualOnly; },
      get candidate() { return candidate; }, get width() { return root.scale.x * cfg.boardWidth; },
      setWidth(width) { if (Number.isFinite(width)) root.scale.setScalar(THREE.MathUtils.clamp(width, cfg.minWidth, cfg.maxWidth) / cfg.boardWidth); },
      get anchorTracked() { return Boolean(anchor && root.visible); },
      setManual(value) { manual = value; candidate = null; requestedAt = null; status(value ? "Plan manuel : ajustez sa hauteur à votre table puis confirmez." : "Visez votre table. Confirmez uniquement le repère souhaité."); },
      height(direction) { manualHeight = THREE.MathUtils.clamp(manualHeight + direction * cfg.heightStep, latestViewer.position.y - cfg.maxBelowEyes, latestViewer.position.y - cfg.minBelowEyes); },
      beginManipulation() { releaseAnchor(); gripStart = null; root.visible = true; },
      endManipulation() { gripStart = null; needsAnchor = true; },
      adjust(action, viewer) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.quaternion); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x);
        const move = { left: [right, -1], right: [right, 1], forward: [forward, 1], back: [forward, -1] }[action];
        if (move) root.position.addScaledVector(move[0], move[1] * cfg.moveStep);
        if (action === "up" || action === "down") root.position.y += (action === "up" ? 1 : -1) * cfg.heightStep;
        if (action === "rotate-left" || action === "rotate-right") root.rotateY((action === "rotate-left" ? 1 : -1) * cfg.turnStep);
        if (action === "grow" || action === "shrink") root.scale.multiplyScalar(action === "grow" ? cfg.scaleStep : 1 / cfg.scaleStep);
        constrain(viewer); gripStart = null;
      },
      resetReference() { if (!anchor) { beginPlacement(); savedPlacement = null; status("Origine du suivi modifiée. Replacez le plateau sur votre table."); } },
      dispose() {
        disposed = true; releaseAnchor(); sources.forEach((entry) => entry.hit?.cancel()); sources.clear();
        scene.remove(reticle); reticle.geometry.dispose(); reticle.material.dispose();
      }
    };
  }
  E.XRPlacement = { create };
}());
