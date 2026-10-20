(function () {
  'use strict';
  const E = window.Eredita;
  let threePromise;
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  // Un renderer de présentation, sans accès aux règles ni à l’état du match.
  function create({ host, leftId, rightId, autoPlay = true, presentation = 'offer', onState = () => {} }) {
    const cfg = E.Config.mythology.crystal;
    const codex = E.Config.mythology.codex;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let palette = E.Mythology.getCrystalPalette(leftId, rightId);
    let THREE, renderer, scene, camera, model, particles, halves = [], beams = [];
    let disposed = false, paused = false, playing = false, seconds = 0, error = null;
    let raf = null, startMs = 0, lastFrame = -Infinity, reveal = 0;
    let started = false, runId = 0;
    let hovered = false, burstProgress = 0;
    let ambientTime = 0, ambientStartMs = performance.now(), inView = true;
    const shards = [], arcs = [];
    const points = [];
    const cardProgress = () => presentation === 'codex' || !started || seconds < cfg.cardsAppearAt ? 0 : motion.matches ? 1 :
      1 - Math.pow(1 - Math.min(1, (seconds - cfg.cardsAppearAt) / cfg.cardsDeployDuration), 3);
    const diagnostics = () => ({ ready: !disposed && Boolean(renderer) && palette.ready && !error, disposed, paused, playing,
      seconds, duration: presentation === 'codex' ? codex.duration / 1000 : cfg.duration, reducedMotion: motion.matches, palette, reveal, started, runId,
      presentation, hovered, burstProgress,
      magicVisible: Boolean(particles?.visible && particles.material.opacity > 0),
      lightningVisible: arcs.some(arc => arc.visible),
      cardsAppearAt: cfg.cardsAppearAt, cardsProgress: palette.ready ? cardProgress() : 0,
      beamsVisible: presentation !== 'codex' && started && palette.ready && !motion.matches && seconds < cfg.beamsFadeAt + cfg.beamsFadeDuration,
      beams: beams.map(beam => ({ direction: beam.sign > 0 ? 'up' : 'down',
        colors: beam.strands.map(strand => '#' + strand.glow.material.color.getHexString()) })),
      phase: error ? 'error' : !palette.ready ? 'missing-colors' : !renderer ? 'loading' : presentation === 'codex' ?
        playing ? burstProgress < .5 ? 'shattering' : 'reforming' : hovered ? 'enchanted' : 'idle' :
        !started ? 'idle' : seconds < cfg.splitAt ? 'charging' : seconds < cfg.revealAt ? 'opening' : 'revealing', error });
    const emit = () => { if (!disposed) onState(diagnostics()); };

    function geometry(sign) {
      // Deux moitiés fermées d’un prisme hexagonal, avec facettes et faces de fracture.
      const polygon = [[0,-.72],[.42,-.72],[.84,0],[.42,.72],[0,.72]];
      const vertices = [];
      const tri = (a,b,c) => vertices.push(...a,...b,...c);
      const point = (p,y) => [p[0]*sign,y,p[1]];
      for (let i=0;i<polygon.length;i++) {
        const a=point(polygon[i],-.58),b=point(polygon[(i+1)%polygon.length],-.58);
        const c=[b[0],.62,b[2]],d=[a[0],.62,a[2]];
        tri(a,b,c);tri(a,c,d);tri(d,c,[0,1.7,0]);tri(b,a,[0,-1.5,0]);
      }
      const shape = new THREE.BufferGeometry();
      shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));shape.computeVertexNormals();
      return shape;
    }
    function buildCrystal() {
      model = new THREE.Group();scene.add(model);
      halves = [-1,1].map(sign => {
        const shape=geometry(sign),group=new THREE.Group();
        const material=new THREE.MeshStandardMaterial({ transparent:true,opacity:.91,roughness:.23,metalness:.28,
          flatShading:true,side:THREE.DoubleSide });
        const facets=new THREE.Mesh(shape,material);
        const lines=new THREE.LineSegments(new THREE.EdgesGeometry(shape),new THREE.LineBasicMaterial({transparent:true,opacity:.6}));
        group.add(facets,lines);model.add(group);return {group,material,lines,sign};
      });
      const positions=new Float32Array(cfg.particleCount*3),colors=new Float32Array(cfg.particleCount*3);
      for(let i=0;i<cfg.particleCount;i++) {
        const x=Math.sin(i*19.37)*2.5,y=Math.sin(i*7.71)*1.8,z=Math.cos(i*11.13)*.8;
        points.push({x,y,z});positions.set([x,y,z],i*3);
      }
      const dust=new THREE.BufferGeometry();dust.setAttribute('position',new THREE.BufferAttribute(positions,3));
      dust.setAttribute('color',new THREE.BufferAttribute(colors,3));
      particles=new THREE.Points(dust,new THREE.PointsMaterial({size:.025,transparent:true,opacity:.6,
        vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(particles);
      // Effets ajoutés au renderer existant ; les facettes et leur animation sont conservées.
      beams = presentation === 'codex' ? [] : [-1, 1].map(sign => {
        const group = new THREE.Group();
        // Chaque direction porte les DEUX couleurs ; deux filaments entrelacés,
        // et non une couleur mélangée ni un rayon horizontal par légende.
        const strands = [0, 1].map(index => {
          const boltShape = new THREE.BufferGeometry(), ribbon = new THREE.BufferGeometry(), indices = [];
          boltShape.setAttribute('position', new THREE.BufferAttribute(new Float32Array((cfg.beamSegments + 1) * 3), 3));
          ribbon.setAttribute('position', new THREE.BufferAttribute(new Float32Array((cfg.beamSegments + 1) * 6), 3));
          for (let i = 0; i < cfg.beamSegments; i++) {
            const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
          ribbon.setIndex(indices);
          const bolt = new THREE.Line(boltShape, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending }));
          const glow = new THREE.Mesh(ribbon, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
          bolt.frustumCulled = glow.frustumCulled = false;
          group.add(glow, bolt); return { index, glow, bolt };
        });
        scene.add(group); return { group, strands, sign };
      });
      if (presentation === 'codex') {
        // Même cristal et même palette ; petits éclats de facettes propres au grimoire.
        for (let i = 0; i < codex.shardCount; i++) {
          const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(.1 + (i % 4) * .035),
            new THREE.MeshStandardMaterial({ transparent: true, roughness: .18, metalness: .5, flatShading: true }));
          const direction = new THREE.Vector3(Math.sin(i * 17.31), Math.cos(i * 8.17) * 1.2, Math.sin(i * 13.7) * .5).normalize();
          scene.add(mesh); shards.push({ mesh, direction });
        }
        for (let i = 0; i < codex.arcCount; i++) {
          const shape = new THREE.BufferGeometry();
          shape.setAttribute('position', new THREE.BufferAttribute(new Float32Array((codex.arcSegments + 1) * 3), 3));
          const arc = new THREE.Line(shape, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          // Boucles fermées sur les vraies arêtes du prisme et ses deux pointes.
          const ring = [[.42,-.72],[.84,0],[.42,.72],[-.42,.72],[-.84,0],[-.42,-.72]];
          const vertex = (index, y) => new THREE.Vector3(ring[index % ring.length][0], y, ring[index % ring.length][1]);
          const opposite = (i + 3) % ring.length;
          const vertices = i < ring.length ? [new THREE.Vector3(0,1.7,0), vertex(i,.62), vertex(i,-.58),
            new THREE.Vector3(0,-1.5,0), vertex(opposite,-.58), vertex(opposite,.62), new THREE.Vector3(0,1.7,0)] :
            [...ring, ring[0]].map(([x,z]) => new THREE.Vector3(x,.62,z));
          const path = new THREE.CurvePath();
          for (let j = 1; j < vertices.length; j++) path.add(new THREE.LineCurve3(vertices[j - 1], vertices[j]));
          arc.userData.edgePath = path;
          arc.userData.point = new THREE.Vector3();
          arc.frustumCulled = false; model.add(arc); arcs.push(arc);
        }
      }
    }
    function applyColors() {
      host.classList.toggle('has-crystal-colors',palette.ready);
      for(const side of ['left','right']) {
        host.style.removeProperty(`--crystal-${side}`);
        if (palette.ready) host.style.setProperty(`--crystal-${side}`,palette[side].primaryColor);
      }
      if (!model) return;
      model.visible=particles.visible=palette.ready;
      if (!palette.ready) return;
      halves.forEach((half,index) => {
        const color=palette[index?'right':'left'];
        half.material.color.set(color.primaryColor);half.material.emissive.set(color.primaryColor);
        half.lines.material.color.set(color.secondaryColor || color.primaryColor);
      });
      beams.forEach(beam => beam.strands.forEach(strand => {
        const color = palette[strand.index ? 'right' : 'left'];
        strand.glow.material.color.set(color.primaryColor);
        strand.bolt.material.color.set(color.primaryColor);
      }));
      const color=particles.geometry.attributes.color;
      points.forEach((point,index) => {
        const rgb=new THREE.Color(palette[point.x<0?'left':'right'].primaryColor);color.setXYZ(index,rgb.r,rgb.g,rgb.b);
      });color.needsUpdate=true;
      shards.forEach(({ mesh }, i) => {
        const color = palette.left;
        mesh.material.color.set(i % 3 ? color.primaryColor : color.secondaryColor || color.primaryColor);
        mesh.material.emissive.copy(mesh.material.color); mesh.material.emissiveIntensity = .8;
      });
      // Cœur lumineux éclairci depuis la palette, pour distinguer l’électricité des facettes.
      const highlight = new THREE.Color(0xffffff);
      arcs.forEach((arc, i) => arc.material.color.set(i % 2 ? palette.left.primaryColor : palette.left.secondaryColor || palette.left.primaryColor).lerp(highlight, .65));
    }
    function resize() {
      if (!renderer || disposed) return;
      const rect=host.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,cfg.maxPixelRatio));renderer.setSize(width,height,false);
      camera.aspect=width/height;
      // La taille du cristal reste constante quand les grandes cartes se déploient.
      camera.position.z=3.5*height/Math.min(presentation === 'codex' ? codex.crystalHeightPixels : cfg.crystalHeightPixels,height*.85)/(2*Math.tan(THREE.MathUtils.degToRad(21)));
      camera.updateProjectionMatrix();
      paint();
    }
    function paint() {
      if (!renderer || disposed) return;
      if (presentation === 'codex') { paintCodex(); return; }
      const time=started && motion.matches && seconds >= cfg.cardsAppearAt ? cfg.duration : seconds;
      const opening=smooth((time-cfg.splitAt)/cfg.splitDuration),charge=smooth(time/cfg.splitAt);
      reveal=palette.ready?smooth((time-cfg.revealAt)/cfg.revealDuration):0;
      if (model) {
        model.rotation.y=Math.sin(time*.95)*.22*(1-opening*.7);
        model.rotation.z=Math.sin(time*.65)*.025;model.position.y=Math.sin(time*1.6)*.05*(1-opening);
        halves.forEach(half => {
          half.group.position.x=half.sign*opening*.94;half.group.rotation.z=half.sign*opening*-.10;
          half.group.rotation.y=half.sign*opening*.12;
          half.material.emissiveIntensity=.10+charge*.24*(1-opening*.7);
          half.lines.material.opacity=.35+charge*.4;
        });
        const positions=particles.geometry.attributes.position;
        points.forEach((p,i) => positions.setXYZ(i,p.x+Math.sin(time*.6+i)*.04,p.y+Math.sin(time*.7+i)*.12,p.z));
        positions.needsUpdate=true;particles.material.opacity=.5*(1-opening*.65);
      }
      const beamStrength = smooth(seconds / .12) * (1 - smooth((seconds - cfg.beamsFadeAt) / cfg.beamsFadeDuration));
      beams.forEach(beam => {
        beam.group.visible = palette.ready && started && !motion.matches && beamStrength > 0;
        const length = camera.position.z * Math.tan(THREE.MathUtils.degToRad(21));
        beam.strands.forEach(strand => {
          const ribbon = strand.glow.geometry.attributes.position, bolt = strand.bolt.geometry.attributes.position;
          for (let i = 0; i <= cfg.beamSegments; i++) {
            const t = i / cfg.beamSegments, angle = t * Math.PI * 4 - seconds * 5 + strand.index * Math.PI;
            const x = Math.sin(angle) * .2, y = beam.sign * (.3 + length * t), z = Math.cos(angle) * .12;
            ribbon.setXYZ(i * 2, x - .045, y, z); ribbon.setXYZ(i * 2 + 1, x + .045, y, z);
            const noise = Math.sin((i + 1) * 127.1 + Math.floor(seconds * 18) * 311.7 + strand.index * 57) * 43758.5453;
            const jitter = ((noise - Math.floor(noise)) * 2 - 1) * .18 * Math.sin(t * Math.PI);
            bolt.setXYZ(i, x * 2 + jitter, y, z + .12);
          }
          ribbon.needsUpdate = bolt.needsUpdate = true;
          strand.glow.material.opacity = beamStrength * .65; strand.bolt.material.opacity = beamStrength * .9;
        });
      });
      renderer.render(scene,camera);host.style.setProperty('--crystal-energy',String(.12+charge*.6));emit();
    }
    function paintCodex() {
      const time = motion.matches ? 0 : ambientTime, p = started ? burstProgress : 0;
      const broken = smooth(p / .17) * (1 - smooth((p - .72) / .28));
      const energy = hovered && !motion.matches ? 1 : 0;
      model.rotation.set(.06, .35 + Math.sin(time * .8) * .1 * energy, -.06);
      model.position.y = Math.sin(time * 1.5) * .045 * energy;
      halves.forEach(half => {
        half.group.position.x = half.sign * broken * .4;
        half.group.rotation.z = half.sign * broken * -.22;
        half.group.rotation.y = half.sign * broken * .15;
        half.material.opacity = .93 * (1 - broken);
        half.material.emissiveIntensity = .15 + energy * .3 + broken * .7;
        half.lines.material.opacity = (.5 + energy * .35) * (1 - broken);
      });
      shards.forEach(({ mesh, direction }, i) => {
        const distance = p < .5 ? smooth(p / .42) : 1 - smooth((p - .7) / .3);
        const opacity = p < .5 ? smooth(p / .04) * (1 - smooth((p - .28) / .12)) :
          smooth((p - .7) / .08) * (1 - smooth((p - .92) / .08));
        mesh.visible = palette.ready && !motion.matches && opacity > 0;
        if (!mesh.visible) return;
        mesh.position.copy(direction).multiplyScalar(.25 + distance * (1.7 + (i % 4) * .22));
        mesh.rotation.set(time * (i % 2 ? 2 : -2), time * 1.3 + i, i + distance);
        mesh.material.opacity = opacity; mesh.scale.setScalar(.65 + broken * .6);
      });
      arcs.forEach((arc, i) => {
        arc.visible = palette.ready && !motion.matches && hovered && broken < .9;
        if (!arc.visible) return;
        const position = arc.geometry.attributes.position;
        for (let j = 0; j <= codex.arcSegments; j++) {
          const t = j / codex.arcSegments;
          const noise = Math.sin(i * 31.7 + j * 71.13 + Math.floor(time * 18) * 19.7);
          const progress = (time * codex.arcSpeed + i / codex.arcCount + t * codex.arcLength) % 1;
          const point = arc.userData.edgePath.getPoint(progress, arc.userData.point);
          point.multiplyScalar(codex.arcSurfaceOffset + noise * .012);
          position.setXYZ(j, point.x, point.y + noise * .022, point.z);
        }
        position.needsUpdate = true; arc.material.opacity = (.75 + Math.sin(time * 9 + i) * .2) * (1 - broken);
      });
      const positions = particles.geometry.attributes.position;
      points.forEach((point, i) => {
        const drift = (time * .18 + i * .137) % 1;
        positions.setXYZ(i, point.x * (.58 + broken * .5) + Math.sin(time * .7 + i) * .12,
          -1.8 + drift * 3.9 + point.y * .1, point.z);
      });
      positions.needsUpdate = true; particles.material.size = codex.particleSize;
      particles.material.opacity = codex.particleOpacity * (1 - broken);
      renderer.render(scene, camera); emit();
    }
    function ambientActive() {
      return presentation === 'codex' && !disposed && !paused && !document.hidden && inView && renderer && palette.ready && !error && !motion.matches;
    }
    function scheduleAmbient() {
      if (presentation !== 'codex') return;
      cancelAnimationFrame(raf);
      ambientStartMs = performance.now() - ambientTime * 1000;
      if (ambientActive()) raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      if (presentation === 'codex') {
        if (!ambientActive()) return;
        ambientTime = (now - ambientStartMs) / 1000;
        if (playing) { seconds = (now - startMs) / 1000; burstProgress = Math.min(1, seconds * 1000 / codex.duration); if (burstProgress === 1) playing = false; }
        const fps = playing || hovered ? innerWidth < cfg.mobileBreakpoint ? cfg.mobileFps : cfg.desktopFps : codex.ambientFps;
        if (now - lastFrame >= 1000 / fps) { lastFrame = now; paint(); }
        raf = requestAnimationFrame(frame);
        return;
      }
      if (disposed || paused || !playing || document.hidden) return;
      const end = motion.matches ? cfg.cardsAppearAt : cfg.duration;
      seconds=Math.min(end,(now-startMs)/1000);
      const fps=innerWidth<cfg.mobileBreakpoint?cfg.mobileFps:cfg.desktopFps;
      if (now-lastFrame>=1000/fps) {lastFrame=now;paint();}
      if (seconds>=end) {playing=false;paint();return;}
      raf=requestAnimationFrame(frame);
    }
    function play() {
      if (disposed || !palette.ready || !renderer || error || (playing && !paused)) return false;
      cancelAnimationFrame(raf);paused=false;seconds=0;started=true;runId++;
      if (presentation === 'codex') {
        startMs = performance.now(); burstProgress = motion.matches ? 1 : 0; playing = !motion.matches; lastFrame = -Infinity;
        paint(); scheduleAmbient(); return true;
      }
      playing=true;startMs=performance.now();lastFrame=-Infinity;paint();
      if (playing&&!document.hidden) raf=requestAnimationFrame(frame);return true;
    }
    function activate() { return !started && play(); }
    function pause() {
      if (!playing || paused || disposed) return false;
      paused=true;cancelAnimationFrame(raf);emit();return true;
    }
    function resume() {
      if (!paused || disposed || !renderer || !palette.ready || error) return false;
      paused=false;startMs=performance.now()-seconds*1000;lastFrame=-Infinity;
      if (!document.hidden) raf=requestAnimationFrame(frame);emit();return true;
    }
    function seek(value) {
      if (disposed || !renderer || !palette.ready || error || !Number.isFinite(value)) return false;
      cancelAnimationFrame(raf);paused=true;playing=true;started=true;seconds=Math.max(0,Math.min(cfg.duration,value));paint();return true;
    }
    function setSelection(left,right) {
      if (disposed) return false;
      cancelAnimationFrame(raf);playing=false;paused=false;started=false;seconds=0;
      palette=E.Mythology.getCrystalPalette(left,right);applyColors();
      if (autoPlay && palette.ready && renderer && !error) play();else {reveal=0;paint();emit();}
      scheduleAmbient();
      return palette.ready;
    }
    const visibility=() => {
      cancelAnimationFrame(raf);
      if (presentation === 'codex') { if (playing) startMs = performance.now() - seconds * 1000; scheduleAmbient(); return; }
      if (!document.hidden&&playing&&!paused) {startMs=performance.now()-seconds*1000;raf=requestAnimationFrame(frame);}
    };
    const motionChange=() => {
      if (presentation === 'codex') {
        cancelAnimationFrame(raf);
        if (motion.matches && playing) { burstProgress = 1; playing = false; }
        scheduleAmbient();
      }
      if (!disposed&&renderer) paint();
    };
    function setHovered(value) {
      if (presentation !== 'codex' || disposed) return;
      hovered = Boolean(value);
      paint(); scheduleAmbient();
    }
    const contextLost=event => {event.preventDefault();error='Le contexte 3D a été perdu. Fermez puis rouvrez l’aperçu.';playing=false;cancelAnimationFrame(raf);emit();};
    const observer=new ResizeObserver(resize);observer.observe(host);
    const viewportObserver = presentation === 'codex' && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;
      if (visible === inView) return;
      inView = visible; if (playing) startMs = performance.now() - seconds * 1000;
      scheduleAmbient();
    }) : null;
    viewportObserver?.observe(host);
    document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',motionChange);
    function dispose() {
      if (disposed) return;
      disposed=true;playing=false;cancelAnimationFrame(raf);observer.disconnect();viewportObserver?.disconnect();
      document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',motionChange);
      scene?.traverse(node => {node.geometry?.dispose();if(node.material) node.material.dispose();});
      if (renderer) {renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
      host.classList.remove('has-crystal-colors');host.style.removeProperty('--crystal-left');host.style.removeProperty('--crystal-right');
    }
    applyColors();emit();
    const ready=(threePromise||(threePromise=import('./vendor/three.module.min.js'))).then(module => {
      if (disposed) return false;
      THREE=module;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,150);camera.position.set(0,.1,5.3);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
      renderer.domElement.className='mythology-crystal-canvas';renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.addEventListener('webglcontextlost',contextLost);host.append(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff,0x202020,2.2));
      const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(3,4,4);scene.add(key);
      const rim=new THREE.DirectionalLight(0xffffff,1.8);rim.position.set(-3,1,-2);scene.add(rim);
      buildCrystal();applyColors();resize();if (autoPlay && palette.ready) play();else emit();scheduleAmbient();return true;
    }).catch(e => {if (!disposed) {error=`Aperçu 3D indisponible : ${e.message||e}`;emit();}return false;});
    return {ready,activate,play,pause,resume,seek,setSelection,setHovered,dispose,get diagnostics(){return diagnostics();}};
  }
  E.MythologyCrystal=Object.freeze({create});
}());
