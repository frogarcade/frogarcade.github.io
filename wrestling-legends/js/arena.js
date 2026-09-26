// ============================================================
// WRESTLING LEGENDS — arena.js
// Arena, ring, crowd, lights.
// ============================================================

const RING = {
  half: 5.98,       // playable half-extent (inside the ropes) — 30% bigger
  postHalf: 6.76,   // corner posts / edge of platform
  top: 0.62,        // y of the canvas surface
  apron: 7.54       // outer edge of the platform skirt
};

const ARENA = { half: 19, barrier: 10.6 };

function makeCanvasTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function buildWorld(scene) {
  scene.background = new THREE.Color(0x0a0b14);
  scene.fog = new THREE.Fog(0x0a0b14, 24, 46);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x6677bb, 0x2a1a10, 0.35));

  const key = new THREE.SpotLight(0xfff2dd, 1.5, 60, Math.PI / 4.2, 0.45, 1);
  key.position.set(6, 14, 4);
  key.target.position.set(0, RING.top, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 4; key.shadow.camera.far = 34;
  key.shadow.bias = -0.0015;
  scene.add(key, key.target);

  const rim = new THREE.SpotLight(0x7fa0ff, 0.55, 60, Math.PI / 4, 0.5, 1);
  rim.position.set(-8, 11, -7);
  rim.target.position.set(0, RING.top, 0);
  scene.add(rim, rim.target);

  const bounce = new THREE.PointLight(0xff8855, 0.5, 30);
  bounce.position.set(0, 3, 0);
  scene.add(bounce);

  // ---------- arena floor ----------
  const floorTex = makeCanvasTexture((g, w, h) => {
    // worn dark concrete, pooled light in the middle, scuffs everywhere
    g.fillStyle = '#191411'; g.fillRect(0, 0, w, h);
    const rad = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.62);
    rad.addColorStop(0, '#2c241c'); rad.addColorStop(1, '#120e0c');
    g.fillStyle = rad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '90,70,50') + ',' + (Math.random() * 0.14) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // faint scuff arcs
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(0,0,0,' + (0.04 + Math.random() * 0.08) + ')';
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const cx = Math.random() * w, cy = Math.random() * h;
      g.arc(cx, cy, 12 + Math.random() * 60, Math.random() * 6, Math.random() * 3 + 3);
      g.stroke();
    }
  }, 1024, 1024);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA.half * 2.6, ARENA.half * 2.6),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // red carpet from the entrance ramp to the ring
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.03, ARENA.half - RING.apron + 1),
    new THREE.MeshStandardMaterial({ color: 0x7a1410, roughness: 0.95 })
  );
  carpet.position.set(0, 0.015, RING.apron + (ARENA.half - RING.apron) / 2);
  carpet.receiveShadow = true;
  scene.add(carpet);

  // enclosing arena walls (it's a fight hall, not an open void)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x141020, roughness: 0.9 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x8e1b12, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.half * 2.7, 13), wallMat);
    wall.position.set(Math.sin(a) * ARENA.half * 1.3, 6.5, Math.cos(a) * ARENA.half * 1.3);
    wall.rotation.y = a + Math.PI;
    scene.add(wall);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.half * 2.7, 0.8), stripeMat);
    stripe.position.set(Math.sin(a) * (ARENA.half * 1.3 - 0.02), 8.6, Math.cos(a) * (ARENA.half * 1.3 - 0.02));
    stripe.rotation.y = a + Math.PI;
    scene.add(stripe);
  }

  // ringside barrier — thrown bodies pile up here instead of phasing
  // through the crowd
  const barMat = new THREE.MeshStandardMaterial({ color: 0x1d2740, roughness: 0.7 });
  const barTopMat = new THREE.MeshStandardMaterial({ color: 0xb8332a, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const ang = i * Math.PI / 2;
    const len = ARENA.barrier * 2 + 0.6;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, 0.18), barMat);
    wall.position.set(Math.sin(ang) * ARENA.barrier, 0.52, Math.cos(ang) * ARENA.barrier);
    wall.rotation.y = ang;
    wall.castShadow = wall.receiveShadow = true;
    scene.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.24), barTopMat);
    cap.position.set(Math.sin(ang) * ARENA.barrier, 1.08, Math.cos(ang) * ARENA.barrier);
    cap.rotation.y = ang;
    scene.add(cap);
  }

  // ---------- ring platform ----------
  const ringGroup = new THREE.Group();

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(RING.apron * 2, RING.top, RING.apron * 2),
    new THREE.MeshStandardMaterial({ color: 0x9e1f16, roughness: 0.75 })
  );
  platform.position.y = RING.top / 2;
  platform.castShadow = platform.receiveShadow = true;
  ringGroup.add(platform);

  // apron skirt text
  const skirtTex = makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#8e1b12'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6d130c'; g.fillRect(0, h - 26, w, 26);
    g.font = 'bold 74px Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd94d';
    g.fillText('WRESTLING LEGENDS', w / 2, h / 2 + 4);
  }, 1024, 160);
  const skirtMat = new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(RING.apron * 2 - 0.02, RING.top - 0.04), skirtMat);
    const a = i * Math.PI / 2;
    s.position.set(Math.sin(a) * (RING.apron + 0.011), RING.top / 2, Math.cos(a) * (RING.apron + 0.011));
    s.rotation.y = a;
    ringGroup.add(s);
  }

  // canvas mat with logo
  const matTex = makeCanvasTexture((g, w, h) => {
    // classic saturated blue canvas
    g.fillStyle = '#1f4fae'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '10,25,70' : '80,130,220') + ',' + (Math.random() * 0.1) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // border trim
    g.strokeStyle = '#d8dbe2'; g.lineWidth = 22;
    g.strokeRect(56, 56, w - 112, h - 112);
    g.strokeStyle = '#c22a1e'; g.lineWidth = 10;
    g.strokeRect(96, 96, w - 192, h - 192);
    // center circle + title
    g.strokeStyle = '#d8dbe2'; g.lineWidth = 12;
    g.beginPath(); g.arc(w / 2, h / 2, 212, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#173c85';
    g.beginPath(); g.arc(w / 2, h / 2, 200, 0, Math.PI * 2); g.fill();
    g.font = 'bold 76px Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd94d';
    g.fillText('WRESTLING', w / 2, h / 2 - 52);
    g.fillStyle = '#d8dbe2';
    g.font = 'bold 44px Impact, sans-serif';
    g.fillText('———', w / 2, h / 2 + 6);
    g.fillStyle = '#ffd94d';
    g.font = 'bold 92px Impact, sans-serif';
    g.fillText('LEGENDS', w / 2, h / 2 + 66);
  }, 1024, 1024);
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(RING.apron * 2 - 0.35, RING.apron * 2 - 0.35),
    new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.95 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = RING.top + 0.005;
  mat.receiveShadow = true;
  ringGroup.add(mat);

  // corner posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0xcccfd8, metalness: 0.7, roughness: 0.3 });
  const padMats = [
    new THREE.MeshStandardMaterial({ color: 0x2b4ba0, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xb8332a, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0x2b4ba0, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: 0xb8332a, roughness: 0.6 })
  ];
  const corners = [];
  for (let i = 0; i < 4; i++) {
    const sx = (i & 1) ? 1 : -1, sz = (i & 2) ? 1 : -1;
    corners.push([sx * RING.postHalf, sz * RING.postHalf]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 10), postMat);
    post.position.set(sx * RING.postHalf, RING.top + 0.675, sz * RING.postHalf);
    post.castShadow = true;
    ringGroup.add(post);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 10), padMats[i]);
    pad.position.set(sx * (RING.postHalf - 0.12), RING.top + 0.72, sz * (RING.postHalf - 0.12));
    pad.rotation.z = sx * 0.1; pad.rotation.x = -sz * 0.1;
    ringGroup.add(pad);
  }

  // ropes: 3 heights, sagging tubes along each side
  const ropeColors = [0xd8dbe2, 0xb8332a, 0x2b4ba0];
  const ropeHeights = [1.18, 0.92, 0.66];
  const sideOrder = [[0, 1], [1, 3], [3, 2], [2, 0]]; // corner index pairs
  ropeHeights.forEach((h, ri) => {
    const rMat = new THREE.MeshStandardMaterial({ color: ropeColors[ri], roughness: 0.55 });
    sideOrder.forEach(([a, b]) => {
      const pa = new THREE.Vector3(corners[a][0], RING.top + h, corners[a][1]);
      const pb = new THREE.Vector3(corners[b][0], RING.top + h, corners[b][1]);
      const mid = pa.clone().lerp(pb, 0.5); mid.y -= 0.045;
      const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
      const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.028, 6), rMat);
      ringGroup.add(rope);
    });
  });

  scene.add(ringGroup);

  // ---------- entrance ramp + barriers ----------
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x22283e, roughness: 0.8 });
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 9), rampMat);
  ramp.position.set(0, 0.06, ARENA.half - 4.5 + 3);
  scene.add(ramp);

  // ---------- big screens / banners ----------
  const bannerTex = makeCanvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#151a30'); grad.addColorStop(1, '#0c0f1e');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd94d'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.font = 'bold 120px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffd94d';
    g.fillText('WRESTLING LEGENDS', w / 2, h / 2 - 40);
    g.fillStyle = '#8fa3e8'; g.font = 'bold 72px Impact, sans-serif';
    g.fillText('TOURNAMENT FIGHT NIGHT', w / 2, h / 2 + 78);
  }, 1600, 400);
  const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
  for (let i = 0; i < 2; i++) {
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), bannerMat);
    banner.position.set(0, 6.4, (i ? -1 : 1) * (ARENA.half - 0.4));
    banner.rotation.y = i ? 0 : Math.PI;
    scene.add(banner);
  }

  // hanging light rig above ring
  const rig = new THREE.Group();
  const rigFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.18, 5),
    new THREE.MeshStandardMaterial({ color: 0x111319, roughness: 0.5, metalness: 0.6 })
  );
  rig.add(rigFrame);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 12), lampMat);
    lamp.position.set((i & 1 ? 1 : -1) * 1.8, -0.3, (i & 2 ? 1 : -1) * 1.8);
    rig.add(lamp);
  }
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x0c0d12 }));
  cable.position.y = 3;
  rig.add(cable);
  rig.position.y = 9;
  scene.add(rig);

  // ---------- bleachers + crowd ----------
  const crowd = buildCrowd(scene);

  // stage light for the select / cutscene screens, so dark-skinned fighters
  // read clearly against the dark arena
  const displayLight = new THREE.SpotLight(0xfff4e2, 0, 30, Math.PI / 5, 0.5, 1);
  displayLight.position.set(1.6, 5.2, 5.2);
  displayLight.target.position.set(0, 1.1, 0.4);
  scene.add(displayLight, displayLight.target);
  const displayFill = new THREE.PointLight(0x88a6ff, 0, 14);
  displayFill.position.set(-2.4, 2.2, 3.0);
  scene.add(displayFill);

  return { crowd, displayLight, displayFill, ringGroup };
}

// Crowd: instanced bodies + heads on bleachers around all 4 sides.
function buildCrowd(scene) {
  const ROWS = 5, GAP = 1.05;
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x231b2e, roughness: 1 });

  const spots = [];
  for (let side = 0; side < 4; side++) {
    const a = side * Math.PI / 2;
    const sin = Math.sin(a), cos = Math.cos(a);
    for (let r = 0; r < ROWS; r++) {
      const dist = 11.5 + r * 1.35;
      const y = 0.45 + r * 0.72;
      // bleacher step (one long box per row per side)
      const step = new THREE.Mesh(new THREE.BoxGeometry(dist * 1.5, 0.72, 1.3), seatMat);
      step.position.set(sin * dist, y - 0.36, cos * dist);
      step.rotation.y = a;
      scene.add(step);
      const count = Math.floor((dist * 1.4) / GAP);
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * GAP + (Math.random() - 0.5) * 0.3;
        // position along the row (perpendicular to outward direction)
        const px = sin * dist + cos * off;
        const pz = cos * dist - sin * off;
        if (Math.random() < 0.12) continue; // empty seats
        spots.push({ x: px, y: y + 0.35, z: pz, rot: a + Math.PI + (Math.random() - 0.5) * 0.4, phase: Math.random() * Math.PI * 2, energy: 0.6 + Math.random() * 0.9 });
      }
    }
  }

  const n = spots.length;
  const palette = [0xc94f3d, 0x3d6bc9, 0x3dc96b, 0xc9b23d, 0x9b59c9, 0xd8d8e0, 0x36bdb2, 0xe08a3c];
  const skinTones = [0xf2c49b, 0xd9a066, 0xa06a3c, 0x8a5a30, 0xf0b58a];

  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.62, 7);
  const headGeo = new THREE.SphereGeometry(0.135, 8, 7);
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), n);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), n);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < n; i++) {
    bodies.setColorAt(i, color.setHex(palette[(Math.random() * palette.length) | 0]).multiplyScalar(0.55 + Math.random() * 0.5));
    heads.setColorAt(i, color.setHex(skinTones[(Math.random() * skinTones.length) | 0]));
  }
  bodies.instanceColor.needsUpdate = true;
  heads.instanceColor.needsUpdate = true;
  scene.add(bodies, heads);

  const crowd = {
    bodies, heads, spots, dummy,
    excitement: 0, // 0 calm .. 1 roaring
    popT: -1,      // seconds into a stadium pop, -1 when idle
    popAt: { x: 0, z: 0 },
    // Something huge just happened. Everyone comes off their seat — as a WAVE
    // rolling outward from where it happened, not all at once, so the whole
    // arena reads as reacting to that spot.
    pop(at) {
      this.excitement = 1;
      this.popT = 0;
      this.popAt.x = at ? at.x : 0;
      this.popAt.z = at ? at.z : 0;
    },
    update(t, dt) {
      this.excitement = Math.max(0, this.excitement - dt * 0.25);
      const ex = 0.25 + this.excitement;
      if (this.popT >= 0) {
        this.popT += dt;
        if (this.popT > 3) this.popT = -1;
      }
      const popping = this.popT >= 0;
      for (let i = 0; i < n; i++) {
        const s = spots[i];
        const bounce = Math.max(0, Math.sin(t * (3 + s.energy * 3) + s.phase)) * 0.09 * s.energy * ex * 4;
        let leap = 0;
        if (popping) {
          const dx = s.x - this.popAt.x, dz = s.z - this.popAt.z;
          // the wave travels out at roughly 22 units a second
          const local = this.popT - Math.sqrt(dx * dx + dz * dz) * 0.045;
          if (local > 0 && local < 0.85) leap = Math.sin(local / 0.85 * Math.PI) * 0.8 * s.energy;
        }
        const lift = bounce + leap;
        dummy.scale.set(1, 1 + leap * 0.3, 1);   // stretch on the way up
        dummy.position.set(s.x, s.y + lift, s.z);
        dummy.rotation.set(0, s.rot, 0);
        dummy.updateMatrix();
        bodies.setMatrixAt(i, dummy.matrix);
        dummy.scale.set(1, 1, 1);
        dummy.position.y = s.y + 0.45 + lift * 1.15 + leap * 0.18;
        dummy.updateMatrix();
        heads.setMatrixAt(i, dummy.matrix);
      }
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    }
  };
  return crowd;
}
