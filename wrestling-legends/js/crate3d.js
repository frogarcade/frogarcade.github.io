// ============================================================
// WRESTLING LEGENDS — crate3d.js
// The supply crate: a real 3D wooden crate on its own little stage, with its
// own renderer so the arena behind it is untouched. Procedural plank texture,
// frame boards, metal corners in the rarity's colour, and a particle system
// for the dust, the upgrade bursts, the light leaking out and the explosion.
// ============================================================

const Crate3D = (() => {
  const RARITY_LOOK = [
    // common, rare, epic, mythical
    { metal: 0x4a4f58, glow: 0xffd28a, rough: 0.55, metalness: 0.75, emissive: 0.0 },
    { metal: 0x2f74e0, glow: 0x6cb6ff, rough: 0.35, metalness: 0.85, emissive: 0.18 },
    { metal: 0x8b44e0, glow: 0xd08bff, rough: 0.32, metalness: 0.85, emissive: 0.24 },
    { metal: 0xffc43a, glow: 0xffe27a, rough: 0.22, metalness: 1.0, emissive: 0.32 }
  ];
  const W = 1.5, H = 1.15, D = 1.2;          // crate body
  const LID_H = 0.14;

  let renderer = null, scene, camera, host, raf = 0, running = false;
  let crate, body, lidPivot, lid, metalMats = [], interiorMat, seamMat, innerLight, keyLight;
  let rays, blobShadow;
  let tier = 0, t = 0, lastT = 0;
  // animation state
  const S = { shake: 0, drop: 0, dropping: false, opening: -1, openDone: false,
              lidAng: 0, lidVel: 0, lidLift: 0, glow: 0, glowTarget: 0.15,
              kick: 0, flash: 0, icons: [], iconMode: 'none', camZoom: 0,
              spin: -1, spinCb: null };
  const SPIN_DUR = 0.8;   // the upgrade roll: hop, two full turns, land

  // ---------------------------------------------------------------- textures
  function woodTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const planks = 4, ph = c.height / planks;
    for (let i = 0; i < planks; i++) {
      // each plank a slightly different board
      const hue = 26 + Math.random() * 6, light = 34 + Math.random() * 10;
      g.fillStyle = 'hsl(' + hue + ',48%,' + light + '%)';
      g.fillRect(0, i * ph, c.width, ph);
      // grain: long wavy streaks, darker and lighter
      for (let k = 0; k < 46; k++) {
        const y0 = i * ph + Math.random() * ph;
        const dark = Math.random() < 0.7;
        g.strokeStyle = dark ? 'rgba(40,20,8,' + (0.12 + Math.random() * 0.22) + ')'
                             : 'rgba(255,220,170,' + (0.05 + Math.random() * 0.1) + ')';
        g.lineWidth = 0.6 + Math.random() * 1.8;
        g.beginPath();
        const amp = 1 + Math.random() * 4, freq = 0.008 + Math.random() * 0.02, ph0 = Math.random() * 6;
        for (let x = 0; x <= c.width; x += 6) {
          const y = y0 + Math.sin(x * freq + ph0) * amp;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      // a knot or two
      const knots = Math.random() < 0.6 ? 1 : 2;
      for (let k = 0; k < knots; k++) {
        const kx = 40 + Math.random() * (c.width - 80), ky = i * ph + ph * (0.3 + Math.random() * 0.4);
        for (let r = 13; r > 1; r -= 2) {
          g.strokeStyle = 'rgba(45,22,8,' + (0.18 + (13 - r) * 0.035) + ')';
          g.lineWidth = 1.4;
          g.beginPath(); g.ellipse(kx, ky, r * 1.9, r * 0.75, 0, 0, Math.PI * 2); g.stroke();
        }
      }
      // weathering at the plank edges
      const grd = g.createLinearGradient(0, i * ph, 0, (i + 1) * ph);
      grd.addColorStop(0, 'rgba(20,10,4,0.35)'); grd.addColorStop(0.12, 'rgba(20,10,4,0)');
      grd.addColorStop(0.88, 'rgba(20,10,4,0)'); grd.addColorStop(1, 'rgba(20,10,4,0.4)');
      g.fillStyle = grd; g.fillRect(0, i * ph, c.width, ph);
      // the gap between boards
      g.fillStyle = 'rgba(12,6,2,0.85)';
      g.fillRect(0, (i + 1) * ph - 3, c.width, 3);
      // nails
      for (const nx of [22, c.width - 22]) {
        const ny = i * ph + ph / 2;
        g.fillStyle = 'rgba(30,30,32,0.95)';
        g.beginPath(); g.arc(nx, ny, 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(160,160,170,0.55)';
        g.beginPath(); g.arc(nx - 1.2, ny - 1.2, 1.8, 0, Math.PI * 2); g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }
  function softDot() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    rg.addColorStop(0.6, 'rgba(255,255,255,0.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function blobTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,0.75)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  // a hand-drawn syringe on a green glow — emoji in a canvas renders blank on
  // some systems, so it's drawn from shapes
  function iconTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 6, 128, 128, 124);
    rg.addColorStop(0, 'rgba(150,255,180,0.9)'); rg.addColorStop(0.4, 'rgba(60,210,110,0.4)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    g.translate(128, 128); g.rotate(-Math.PI / 4);
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = '#0d2a18';
    // plunger
    rr(-14, -98, 28, 12, 4); g.fillStyle = '#e8edf2'; g.fill(); g.stroke();
    g.fillStyle = '#c7cfd8'; g.fillRect(-5, -88, 10, 30); g.strokeRect(-5, -88, 10, 30);
    // barrel with green juice
    rr(-24, -60, 48, 100, 10); g.fillStyle = 'rgba(235,245,255,0.95)'; g.fill();
    rr(-18, -30, 36, 64, 6); g.fillStyle = '#3ddc72'; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-12, -26, 7, 54);
    rr(-24, -60, 48, 100, 10); g.stroke();
    // graduations
    g.strokeStyle = 'rgba(13,42,24,0.6)'; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(8, -44 + k * 18); g.lineTo(22, -44 + k * 18); g.stroke(); }
    // hub and needle
    g.strokeStyle = '#0d2a18'; g.lineWidth = 7;
    rr(-10, 40, 20, 14, 3); g.fillStyle = '#9aa6b2'; g.fill(); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(0, 54); g.lineTo(0, 100); g.stroke();
    g.strokeStyle = '#dfe6ee'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 56); g.lineTo(0, 98); g.stroke();
    const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding;
    return tx;
  }

  // ---------------------------------------------------------------- particles
  const MAXP = 700;
  let pts, pPos, pCol, pSize, pAlpha;
  const P = [];   // live particles
  function makeParticles(map) {
    const geo = new THREE.BufferGeometry();
    pPos = new Float32Array(MAXP * 3); pCol = new Float32Array(MAXP * 3);
    pSize = new Float32Array(MAXP); pAlpha = new Float32Array(MAXP);
    geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(pCol, 3));
    geo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1));
    geo.setAttribute('palpha', new THREE.BufferAttribute(pAlpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, pr: { value: 1 } },
      vertexShader: [
        'attribute vec3 pcolor; attribute float psize; attribute float palpha;',
        'uniform float pr; varying vec3 vC; varying float vA;',
        'void main(){ vC = pcolor; vA = palpha;',
        ' vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        ' gl_PointSize = psize * pr * (14.0 / -mv.z);',
        ' gl_Position = projectionMatrix * mv; }'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D map; varying vec3 vC; varying float vA;',
        'void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }
  function spawn(o) {
    if (P.length >= MAXP) P.shift();
    P.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
             life: o.life, max: o.life, size: o.size, col: new THREE.Color(o.color),
             grav: o.grav == null ? -9 : o.grav, drag: o.drag == null ? 0.6 : o.drag, fade: o.fade || 1 });
  }
  function stepParticles(dt) {
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.vy < 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    for (let i = 0; i < MAXP; i++) {
      const p = P[i];
      if (!p) { pAlpha[i] = 0; pSize[i] = 0; continue; }
      const f = p.life / p.max;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pCol[i * 3] = p.col.r; pCol[i * 3 + 1] = p.col.g; pCol[i * 3 + 2] = p.col.b;
      pSize[i] = p.size * (0.4 + 0.6 * f);
      pAlpha[i] = Math.min(1, f * 1.6) * p.fade;
    }
    const g = pts.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.pcolor.needsUpdate = true;
    g.attributes.psize.needsUpdate = true; g.attributes.palpha.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the crate
  function build() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a1a0e, 0.55));
    keyLight = new THREE.DirectionalLight(0xfff0d8, 1.35);
    keyLight.position.set(3, 6, 4);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x8fb2ff, 0.7);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const wood = woodTexture();
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.82, metalness: 0.0 });
    const frameTex = wood.clone(); frameTex.needsUpdate = true;
    frameTex.repeat.set(1, 0.25);
    const frameMat = new THREE.MeshStandardMaterial({ map: frameTex, color: 0xc89a6a, roughness: 0.78 });
    interiorMat = new THREE.MeshStandardMaterial({ color: 0x120a05, roughness: 1, emissive: 0xffd28a, emissiveIntensity: 0 });

    crate = new THREE.Group();
    scene.add(crate);

    // body — the top face is the dark interior you see once the lid is gone
    body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
      [woodMat, woodMat, interiorMat, woodMat, woodMat, woodMat]);
    body.position.y = H / 2;
    crate.add(body);

    // frame boards round every side face, plus a diagonal brace
    const T = 0.1, P0 = 0.035;
    const addBoard = (w, h, d, x, y, z, rz = 0, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z); m.rotation.set(0, ry, rz);
      crate.add(m); return m;
    };
    for (const s of [1, -1]) {
      // front/back faces (z)
      const z = s * (D / 2 + P0 / 2);
      addBoard(W, T, P0, 0, T / 2, z); addBoard(W, T, P0, 0, H - T / 2, z);
      addBoard(T, H, P0, W / 2 - T / 2, H / 2, z); addBoard(T, H, P0, -W / 2 + T / 2, H / 2, z);
      const diag = Math.hypot(W - 2 * T, H - 2 * T);
      addBoard(diag, T * 0.9, P0, 0, H / 2, z, s * Math.atan2(H - 2 * T, W - 2 * T));
      // side faces (x)
      const x = s * (W / 2 + P0 / 2);
      addBoard(P0, T, D, x, T / 2, 0); addBoard(P0, T, D, x, H - T / 2, 0);
      addBoard(P0, H, T, x, H / 2, D / 2 - T / 2); addBoard(P0, H, T, x, H / 2, -D / 2 + T / 2);
      const diag2 = Math.hypot(D - 2 * T, H - 2 * T);
      const br = addBoard(P0, T * 0.9, diag2, x, H / 2, 0);
      br.rotation.x = -s * Math.atan2(H - 2 * T, D - 2 * T);
    }

    // metal corner brackets, coloured by rarity
    const mkMetal = () => {
      const m = new THREE.MeshStandardMaterial({ color: RARITY_LOOK[0].metal, roughness: 0.5, metalness: 0.8,
                                                 emissive: RARITY_LOOK[0].metal, emissiveIntensity: 0 });
      metalMats.push(m); return m;
    };
    const cornerMat = mkMetal();
    const C = 0.22, CT = 0.05;
    for (const sx of [1, -1]) for (const sz of [1, -1]) for (const sy of [0, 1]) {
      const y = sy ? H - C / 2 + 0.005 : C / 2 - 0.005;
      const a = new THREE.Mesh(new THREE.BoxGeometry(C, C, CT), cornerMat);
      a.position.set(sx * (W / 2 - C / 2 + 0.01), y, sz * (D / 2 + P0 + CT / 2 - 0.01));
      const b = new THREE.Mesh(new THREE.BoxGeometry(CT, C, C), cornerMat);
      b.position.set(sx * (W / 2 + P0 + CT / 2 - 0.01), y, sz * (D / 2 - C / 2 + 0.01));
      crate.add(a, b);
      // rivets
      for (const m of [a, b]) {
        const r = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), cornerMat);
        r.position.copy(m.position);
        if (m === a) r.position.z += sz * CT / 2; else r.position.x += sx * CT / 2;
        crate.add(r);
      }
    }

    // a glowing seam under the lid — light leaking out before it pops
    seamMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0,
                                            blending: THREE.AdditiveBlending, depthWrite: false });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.04, D + 0.12), seamMat);
    seam.position.y = H + 0.01;
    crate.add(seam);

    // the lid hinges on the back top edge
    lidPivot = new THREE.Group();
    lidPivot.position.set(0, H, -D / 2 - 0.04);
    crate.add(lidPivot);
    lid = new THREE.Group();
    lid.position.set(0, LID_H / 2, D / 2 + 0.04);
    lidPivot.add(lid);
    const lidBoard = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, LID_H, D + 0.08), woodMat);
    lid.add(lidBoard);
    for (const s of [1, -1]) {
      const bat = new THREE.Mesh(new THREE.BoxGeometry(T * 1.1, 0.05, D + 0.08), frameMat);
      bat.position.set(s * (W / 2 - T * 0.6), LID_H / 2 + 0.025, 0); lid.add(bat);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.05, T * 1.1), frameMat);
    cross.position.set(0, LID_H / 2 + 0.025, 0); lid.add(cross);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(C * 0.9, 0.06, C * 0.9), cornerMat);
      cap.position.set(sx * (W / 2 - C * 0.45 + 0.04), LID_H / 2 + 0.03, sz * (D / 2 - C * 0.45 + 0.04));
      lid.add(cap);
    }

    // light inside — the glow that floods out when it opens
    innerLight = new THREE.PointLight(0xffd28a, 0, 7, 2);
    innerLight.position.set(0, H * 0.7, 0);
    crate.add(innerLight);

    // a column of light from the open crate
    const rc = document.createElement('canvas'); rc.width = 4; rc.height = 128;
    const rg = rc.getContext('2d'), grd = rg.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,1)');
    rg.fillStyle = grd; rg.fillRect(0, 0, 4, 128);
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, map: new THREE.CanvasTexture(rc),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    rays = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.62, 3.4, 32, 1, true), rayMat);
    rays.position.y = H + 1.7;
    crate.add(rays);

    blobShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blobShadow.rotation.x = -Math.PI / 2;
    blobShadow.position.y = 0.005;
    scene.add(blobShadow);

    scene.add(makeParticles(softDot()));
    S.iconTex = iconTexture();
  }

  function setLook(i, instant) {
    tier = i;
    const L = RARITY_LOOK[i];
    for (const m of metalMats) {
      m.color.setHex(L.metal); m.emissive.setHex(L.metal);
      m.roughness = L.rough; m.metalness = L.metalness;
      m.emissiveIntensity = L.emissive;
    }
    seamMat.color.setHex(L.glow);
    interiorMat.emissive.setHex(L.glow);
    innerLight.color.setHex(L.glow);
    rays.material.color.setHex(L.glow);
    S.glowTarget = 0.12 + i * 0.12;
    if (instant) S.glow = S.glowTarget;
  }

  let sizedW = 0, sizedH = 0;
  function resize() {
    if (!renderer || !host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;                       // not laid out yet — try next frame
    if (w === sizedW && h === sizedH) return;
    sizedW = w; sizedH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pts.material.uniforms.pr.value = renderer.getPixelRatio();
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000 || 0.016);
    lastT = now; t += dt;
    resize();
    update(dt);
    renderer.render(scene, camera);
  }

  function update(dt) {
    // drop-in
    let y = 0;
    if (S.dropping) {
      S.drop += dt;
      const k = Math.min(1, S.drop / 0.55);
      y = (1 - k * k) * 3.2;                         // falls with gravity's curve
      if (k >= 1) {
        S.dropping = false; S.shake = 0.5; S.kick = 0.25;
        dust(26);
        if (window.AudioFX && AudioFX.hit) AudioFX.hit(1.2);
      }
    }
    // a little settle bounce after landing
    S.kick *= Math.exp(-7 * dt);
    const settle = Math.sin(t * 22) * S.kick * 0.06;

    // ---- upgrade roll: the crate hops and spins, shedding a spiral of sparks,
    // and only shows whether it upgraded once it lands
    let spinYaw = 0, spinTilt = 0;
    if (S.spin >= 0) {
      S.spin += dt;
      const k = Math.min(1, S.spin / SPIN_DUR);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in-out
      spinYaw = e * Math.PI * 4;
      spinTilt = Math.sin(k * Math.PI) * 0.22;
      y += Math.sin(k * Math.PI) * 0.32;
      const col = RARITY_LOOK[tier].glow;
      const rate = 160 * Math.sin(k * Math.PI) + 20;
      for (let n = Math.floor(rate * dt + Math.random()); n > 0; n--) {
        const a = -0.55 + spinYaw + Math.random() * Math.PI * 2;
        const r = Math.max(W, D) * 0.62, py = y + Math.random() * H;
        // flung off tangentially, the way the crate is turning
        spawn({ x: Math.cos(a) * r, y: py, z: Math.sin(a) * r,
                vx: -Math.sin(a) * 2.6 + Math.cos(a) * 0.6, vy: 0.4 + Math.random() * 1.2, vz: Math.cos(a) * 2.6 + Math.sin(a) * 0.6,
                life: 0.6 + Math.random() * 0.5, size: 4 + Math.random() * 6,
                color: Math.random() < 0.35 ? 0xffffff : col, grav: -2, drag: 1.4 });
      }
      if (k >= 1) {
        S.spin = -1; S.kick = 0.3; S.shake = Math.max(S.shake, 0.4);
        dust(10);
        const cb = S.spinCb; S.spinCb = null;
        if (cb) cb();
      }
    }

    // idle sway, plus shake
    S.shake *= Math.exp(-5 * dt);
    const jx = (Math.random() - 0.5) * S.shake * 0.12, jz = (Math.random() - 0.5) * S.shake * 0.12;
    crate.rotation.set(jx + spinTilt, -0.55 + Math.sin(t * 0.55) * 0.07 + spinYaw, jz);
    crate.position.y = y + Math.abs(settle);
    blobShadow.scale.setScalar(1 - Math.min(0.6, y * 0.15));
    blobShadow.material.opacity = 1 - Math.min(0.8, y * 0.25);

    // glow breathing — rarer crates glow more
    S.glow += (S.glowTarget - S.glow) * Math.min(1, dt * 4);
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.6);
    seamMat.opacity = S.opening < 0 ? S.glow * (0.6 + 0.4 * breathe) : seamMat.opacity;
    for (const m of metalMats) m.emissiveIntensity = RARITY_LOOK[tier].emissive * (0.7 + 0.3 * breathe);
    // the higher tiers shed motes even at rest
    if (S.opening < 0 && tier > 0 && Math.random() < dt * (4 + tier * 6)) {
      const a = Math.random() * Math.PI * 2;
      spawn({ x: Math.cos(a) * W * 0.55, y: 0.2 + Math.random() * H, z: Math.sin(a) * D * 0.55,
              vy: 0.4 + Math.random() * 0.4, life: 1.6, size: 4 + tier, color: RARITY_LOOK[tier].glow, grav: 0.2, drag: 0.3, fade: 0.8 });
    }

    // ---- opening ----
    if (S.opening >= 0) {
      S.opening += dt;
      const o = S.opening;
      const glowCol = RARITY_LOOK[tier].glow;
      if (o < 0.75) {
        // strain: shaking harder and harder, light leaking from the seams
        const k = o / 0.75;
        S.shake = Math.max(S.shake, 0.25 + k * 1.1);
        seamMat.opacity = 0.35 + k * 0.65;
        innerLight.intensity = k * 2.2;
        if (Math.random() < dt * (20 + 60 * k)) {
          const sx = (Math.random() - 0.5) * W, sz = (Math.random() < 0.5 ? -1 : 1) * D / 2;
          spawn({ x: sx, y: H + 0.02, z: sz, vx: (Math.random() - 0.5) * 1.2, vy: 1.5 + Math.random() * 2, vz: sz * 0.6,
                  life: 0.6, size: 5, color: glowCol, grav: -4 });
        }
      } else if (!S.popped) {
        // POP
        S.popped = true;
        S.lidVel = -9.5; S.lidLift = 0.0001;
        S.flash = 1; S.kick = 0.4; S.shake = 1.2;
        explode(glowCol);
        if (window.AudioFX) { AudioFX.slam && AudioFX.slam(); AudioFX.sparkle && AudioFX.sparkle(6); }
        S.camZoom = 1;
      }
      if (S.popped) {
        // the lid swings back on its hinge with a heavy overshoot, then falls
        S.lidVel += (-1.95 - S.lidAng) * 60 * dt;
        S.lidVel *= Math.exp(-3.4 * dt);
        S.lidAng += S.lidVel * dt;
        S.lidLift += dt;
        lidPivot.rotation.x = S.lidAng;
        lidPivot.position.y = H + Math.min(0.5, S.lidLift * 1.4) - Math.max(0, S.lidLift - 0.4) * 0.6;
        // light floods out, then settles to a warm glow
        innerLight.intensity += (3.2 - innerLight.intensity) * Math.min(1, dt * 3);
        interiorMat.emissiveIntensity = 1.1;
        seamMat.opacity *= Math.exp(-6 * dt);
        rays.material.opacity += ((0.14 + 0.04 * Math.sin(t * 5)) - rays.material.opacity) * Math.min(1, dt * 5);
        rays.rotation.y += dt * 0.4;
        if (Math.random() < dt * 30) {
          spawn({ x: (Math.random() - 0.5) * W * 0.8, y: H * 0.9, z: (Math.random() - 0.5) * D * 0.8,
                  vy: 1.2 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.5,
                  life: 1.4, size: 4 + Math.random() * 4, color: glowCol, grav: 0.3, drag: 0.4, fade: 0.9 });
        }
      }
    }
    S.flash *= Math.exp(-6 * dt);
    keyLight.intensity = 1.35 + S.flash * 0.8;

    // camera: three-quarter view, a punch-in on the pop that eases back out
    S.camZoom *= Math.exp(-2.2 * dt);
    const dist = 1.42 - S.camZoom * 0.14;
    const open = S.opening >= 0 ? Math.min(1, S.opening * 1.5) : 0;   // tilt up to follow the light
    camera.position.set(3.25 * dist, 2.4 * dist + 0.3, 3.7 * dist);
    camera.lookAt(0, 1.12 + open * 0.3, 0);

    updateIcons(dt);
    stepParticles(dt);
  }

  function dust(n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 0.4;
      spawn({ x: Math.cos(a) * r, y: 0.05, z: Math.sin(a) * r,
              vx: Math.cos(a) * (1.2 + Math.random() * 1.6), vy: 0.3 + Math.random() * 0.6, vz: Math.sin(a) * (1.2 + Math.random() * 1.6),
              life: 0.8 + Math.random() * 0.5, size: 6 + Math.random() * 6, color: 0x6e5c46, grav: 0.4, drag: 2.4, fade: 0.16 });
    }
  }
  function burstRing(color, n, y) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
      const sp = 2.6 + Math.random() * 1.6;
      spawn({ x: Math.cos(a) * 0.7, y: y + (Math.random() - 0.5) * 0.4, z: Math.sin(a) * 0.6,
              vx: Math.cos(a) * sp, vy: 0.6 + Math.random() * 1.6, vz: Math.sin(a) * sp,
              life: 0.9 + Math.random() * 0.4, size: 5 + Math.random() * 4, color, grav: -3, drag: 1.2 });
    }
  }
  function explode(color) {
    for (let i = 0; i < 170; i++) {
      const a = Math.random() * Math.PI * 2, up = 4 + Math.random() * 6;
      const out = 1 + Math.random() * 3.2;
      spawn({ x: (Math.random() - 0.5) * W * 0.7, y: H, z: (Math.random() - 0.5) * D * 0.7,
              vx: Math.cos(a) * out, vy: up, vz: Math.sin(a) * out,
              life: 1 + Math.random() * 1.1, size: 4 + Math.random() * 7,
              color: Math.random() < 0.3 ? 0xffffff : color, grav: -8, drag: 0.5 });
    }
    // splinters of wood thrown off with the lid
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn({ x: Math.cos(a) * W * 0.5, y: H, z: Math.sin(a) * D * 0.5,
              vx: Math.cos(a) * (2 + Math.random() * 3), vy: 3 + Math.random() * 4, vz: Math.sin(a) * (2 + Math.random() * 3),
              life: 1.1, size: 6, color: 0xc89060, grav: -14, drag: 0.4, fade: 0.7 });
    }
  }

  // ---------------------------------------------------------------- reward icons
  const _r = new THREE.Vector3();
  function clearIcons() { for (const ic of S.icons) scene.remove(ic.spr); S.icons = []; S.iconMode = 'none'; }
  function showIcons(n) {
    clearIcons();
    for (let i = 0; i < n; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.iconTex, transparent: true, depthWrite: false, opacity: 0 }));
      spr.scale.setScalar(0.01);
      spr.position.set(0, H * 0.7, 0);
      scene.add(spr);
      const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * Math.min(1.7, 0.85 * (n - 1));
      S.icons.push({ spr, t: -i * 0.14, tx: spread, ty: H + 0.5 - Math.abs(spread) * 0.1 });
    }
    S.iconMode = 'rise';
  }
  function updateIcons(dt) {
    for (const ic of S.icons) {
      ic.t += dt;
      if (ic.t < 0) continue;
      const m = ic.spr.material;
      if (S.iconMode === 'rise') {
        const k = Math.min(1, ic.t / 0.6), e = 1 - Math.pow(1 - k, 3);
        // across the screen: the camera's right vector, flattened
        _r.set(camera.matrixWorld.elements[0], 0, camera.matrixWorld.elements[2]).normalize();
        ic.spr.position.copy(_r).multiplyScalar(ic.tx * e);
        ic.spr.position.y = H * 0.7 + (ic.ty - H * 0.7) * e + Math.sin(t * 2.4 + ic.tx * 3) * 0.05 * e;
        const s = 0.9 * (k < 1 ? (e + Math.sin(k * Math.PI) * 0.25) : 1);
        ic.spr.scale.setScalar(s);
        m.opacity = Math.min(1, k * 2);
      } else if (S.iconMode === 'claim') {
        ic.spr.position.y += dt * (2 + ic.t * 6);
        m.opacity = Math.max(0, m.opacity - dt * 1.6);
        if (Math.random() < dt * 30) spawn({ x: ic.spr.position.x, y: ic.spr.position.y, z: 0, vy: -0.5,
                                             life: 0.5, size: 5, color: 0x7dffa2, grav: 0 });
      } else if (S.iconMode === 'fizzle') {
        ic.spr.scale.multiplyScalar(Math.exp(-3 * dt));
        m.opacity = Math.max(0, m.opacity - dt * 1.4);
        m.color.setRGB(0.5, 0.5, 0.55);
      }
    }
  }

  // ---------------------------------------------------------------- public
  return {
    mount(el) {
      host = el;
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.setClearColor(0x000000, 0);
        build();
        window.addEventListener('resize', resize);
      }
      if (renderer.domElement.parentNode !== el) el.appendChild(renderer.domElement);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      resize();
    },
    start() {
      if (running) return;
      running = true; lastT = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
    // a fresh crate, dropped in from above
    reset(rarity) {
      S.opening = -1; S.popped = false; S.lidAng = 0; S.lidVel = 0; S.lidLift = 0;
      lidPivot.rotation.x = 0; lidPivot.position.y = H;
      innerLight.intensity = 0; interiorMat.emissiveIntensity = 0; rays.material.opacity = 0;
      S.dropping = true; S.drop = 0; S.camZoom = 0; S.spin = -1; S.spinCb = null;
      clearIcons(); P.length = 0;
      setLook(rarity || 0, true);
      sizedW = sizedH = 0; resize();
    },
    upgrade(newTier, jumped) {
      setLook(newTier);
      S.shake = 0.9 + jumped * 0.4; S.flash = 0.6 + jumped * 0.3; S.kick = 0.2;
      burstRing(RARITY_LOOK[newTier].glow, 46 + jumped * 30, H * 0.6);
      burstRing(0xffffff, 14, H);
    },
    dud() { S.shake = 0.35; S.kick = 0.18; dust(8); },
    // hop-and-spin; onLand fires when it touches down (reveal the result then)
    spin(onLand) {
      if (S.spin >= 0 && S.spinCb) { const cb = S.spinCb; S.spinCb = null; cb(); }
      S.spin = 0; S.spinCb = onLand || null;
      if (window.AudioFX && AudioFX.whoosh) AudioFX.whoosh();
    },
    SPIN_MS: SPIN_DUR * 1000,
    open() { S.opening = 0; S.popped = false; },
    reveal(n) { showIcons(n); },
    claim() { S.iconMode = 'claim'; for (const ic of S.icons) ic.t = 0; burstRing(0x7dffa2, 30, H + 1); },
    fizzle() { S.iconMode = 'fizzle'; },
    // test hooks
    _state: S,
    _step(dt) { resize(); update(dt); renderer.render(scene, camera); }
  };
})();
