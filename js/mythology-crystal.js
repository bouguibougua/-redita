(function () {
  'use strict';
  const E = window.Eredita;
  let threePromise;
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  // Un renderer de présentation, sans accès à CardGame, CardEffects ou à l’état du match.
  function create({ host, leftId, rightId, onState = () => {} }) {
    const cfg = E.Config.mythology.crystal;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let palette = E.Mythology.getCrystalPalette(leftId, rightId);
    let THREE, renderer, scene, camera, model, particles, halves = [];
    let disposed = false, paused = false, playing = false, seconds = 0, error = null;
    let raf = null, startMs = 0, lastFrame = -Infinity, reveal = 0;
    const points = [];
    const diagnostics = () => ({ ready: !disposed && Boolean(renderer) && palette.ready && !error, disposed, paused, playing,
      seconds, duration: cfg.duration, reducedMotion: motion.matches, palette, reveal,
      phase: error ? 'error' : !palette.ready ? 'missing-colors' : !renderer ? 'loading' :
        seconds < cfg.splitAt ? 'charging' : seconds < cfg.revealAt ? 'opening' : 'revealing', error });
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
      const color=particles.geometry.attributes.color;
      points.forEach((point,index) => {
        const rgb=new THREE.Color(palette[point.x<0?'left':'right'].primaryColor);color.setXYZ(index,rgb.r,rgb.g,rgb.b);
      });color.needsUpdate=true;
    }
    function resize() {
      if (!renderer || disposed) return;
      const rect=host.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,cfg.maxPixelRatio));renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.position.z=width/height<1.1?7:5.3;camera.updateProjectionMatrix();
      paint();
    }
    function paint() {
      if (!renderer || disposed) return;
      const time=motion.matches?cfg.duration:seconds;
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
      renderer.render(scene,camera);host.style.setProperty('--crystal-energy',String(.12+charge*.6));emit();
    }
    function frame(now) {
      if (disposed || paused || !playing || document.hidden) return;
      seconds=Math.min(cfg.duration,(now-startMs)/1000);
      const fps=innerWidth<cfg.mobileBreakpoint?cfg.mobileFps:cfg.desktopFps;
      if (now-lastFrame>=1000/fps) {lastFrame=now;paint();}
      if (seconds>=cfg.duration) {playing=false;paint();return;}
      raf=requestAnimationFrame(frame);
    }
    function play() {
      if (disposed || !palette.ready || !renderer || error) return false;
      cancelAnimationFrame(raf);paused=false;seconds=motion.matches?cfg.duration:0;
      playing=!motion.matches;startMs=performance.now();lastFrame=-Infinity;paint();
      if (playing&&!document.hidden) raf=requestAnimationFrame(frame);return true;
    }
    function pause() {
      if (!playing || paused || disposed) return false;
      paused=true;cancelAnimationFrame(raf);emit();return true;
    }
    function resume() {
      if (!paused || disposed || !renderer || !palette.ready || motion.matches || error) return false;
      paused=false;startMs=performance.now()-seconds*1000;lastFrame=-Infinity;
      if (!document.hidden) raf=requestAnimationFrame(frame);emit();return true;
    }
    function seek(value) {
      if (disposed || !renderer || !palette.ready || error || !Number.isFinite(value)) return false;
      cancelAnimationFrame(raf);paused=true;playing=true;seconds=Math.max(0,Math.min(cfg.duration,value));paint();return true;
    }
    function setSelection(left,right) {
      if (disposed) return false;
      cancelAnimationFrame(raf);playing=false;paused=false;seconds=0;
      palette=E.Mythology.getCrystalPalette(left,right);applyColors();
      if (palette.ready && renderer && !error) play();else {reveal=0;paint();emit();}
      return palette.ready;
    }
    const visibility=() => {
      cancelAnimationFrame(raf);
      if (!document.hidden&&playing&&!paused) {startMs=performance.now()-seconds*1000;raf=requestAnimationFrame(frame);}
    };
    const motionChange=() => {if (!disposed&&renderer) {if (motion.matches) {cancelAnimationFrame(raf);playing=false;paused=false;seconds=cfg.duration;}paint();}};
    const contextLost=event => {event.preventDefault();error='Le contexte 3D a été perdu. Fermez puis rouvrez l’aperçu.';playing=false;cancelAnimationFrame(raf);emit();};
    const observer=new ResizeObserver(resize);observer.observe(host);
    document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',motionChange);
    function dispose() {
      if (disposed) return;
      disposed=true;playing=false;cancelAnimationFrame(raf);observer.disconnect();
      document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',motionChange);
      scene?.traverse(node => {node.geometry?.dispose();if(node.material) node.material.dispose();});
      if (renderer) {renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
      host.classList.remove('has-crystal-colors');host.style.removeProperty('--crystal-left');host.style.removeProperty('--crystal-right');
    }
    applyColors();emit();
    const ready=(threePromise||(threePromise=import('./vendor/three.module.min.js'))).then(module => {
      if (disposed) return false;
      THREE=module;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,30);camera.position.set(0,.1,5.3);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
      renderer.domElement.className='mythology-crystal-canvas';renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.addEventListener('webglcontextlost',contextLost);host.append(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff,0x202020,2.2));
      const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(3,4,4);scene.add(key);
      const rim=new THREE.DirectionalLight(0xffffff,1.8);rim.position.set(-3,1,-2);scene.add(rim);
      buildCrystal();applyColors();resize();if (palette.ready) play();else emit();return true;
    }).catch(e => {if (!disposed) {error=`Aperçu 3D indisponible : ${e.message||e}`;emit();}return false;});
    return {ready,play,pause,resume,seek,setSelection,dispose,get diagnostics(){return diagnostics();}};
  }
  E.MythologyCrystal=Object.freeze({create});
}());
