// ============================================================
// WRESTLING LEGENDS — boxer.js
// Character rigs, procedural animation, exaggerated verlet ragdoll.
// ============================================================

const BOXER_DEFS = {
  joe: {
    id: 'joe', name: 'JOE AVERAGE', tag: 'The Reliable Everyman',
    maxHp: 200, speed: 100, dmg: 20, mass: 1,
    playerHp: 200, playerDmg: 20,
    special: 'barrage', specialName: 'HAYMAKER HURRICANE', specialCooldown: 14,
    specialDesc: 'A furious barrage of 10 punches, 8 damage each!',
    playerSpecialDesc: 'A furious barrage of 10 punches, {d:8} damage each — {d:80} in total!',
    build: 'human', bulk: 1, head: 'flattop', starter: true,
    skin: 0xdd9a63, hair: 0x53350f, trunks: 0x3557c9, trunksTrim: 0xffffff,
    gloves: 0xd42a1e, boots: 0xf0f0f0, scaleY: 1.0, uiColor: '#9db8ff'
  },
  bean: {
    id: 'bean', name: 'KING BEAN', tag: 'Royalty Hits Different',
    maxHp: 150, speed: 125, dmg: 25, mass: 0.85,
    playerHp: 150, playerDmg: 25,
    special: 'suplex', specialName: 'ROYAL SUPLEX', specialCooldown: 12,
    specialDesc: 'Grab your foe and suplex them flying to your crosshair — 60 damage on impact!',
    playerSpecialDesc: 'Grab them and suplex them flying to your crosshair — {d:60} damage on impact!',
    build: 'bean', bulk: 1, head: 'crown',
    skin: 0x5da32c, hair: 0xf7c531, trunks: 0xa2261b, trunksTrim: 0xffd94d,
    gloves: 0xf0b429, boots: 0xa2261b, scaleY: 0.96, uiColor: '#a5e876'
  },
  blaze: {
    id: 'blaze', name: 'BLAZE', tag: 'Slow Burn, Big Bang',
    maxHp: 275, speed: 50, dmg: 25, mass: 1.2,
    playerHp: 320, playerDmg: 30,
    attackSpeed: 1.25,   // neither version can chase, so both get quicker hands
    special: 'slam', specialName: 'METEOR DROP', specialCooldown: 9,
    specialDesc: 'Leap VERY high and crash down right on your foe — 60 damage!',
    playerSpecialDesc: 'Leap high and crash down right on top of them — {d:60} damage!',
    build: 'human', bulk: 1.26, head: 'buzz', physique: 'jacked',
    skin: 0x4a2c18, hair: 0x140c06, trunks: 0xd93b0e, trunksTrim: 0xffb020,
    gloves: 0xff8c1a, boots: 0x2b0f04, scaleY: 1.07, uiColor: '#ff9d4d'
  },
  honk: {
    id: 'honk', name: 'HONK THE CLOWN', tag: 'The Big Top Bruiser',
    maxHp: 300, speed: 100, dmg: 15, mass: 2.4,
    playerHp: 260, playerDmg: 22,
    special: 'roll', specialName: 'ROLLING RIOT', specialCooldown: 22,
    specialDesc: 'Curl up and barrel back and forth for 10 seconds — 20 damage a hit!',
    playerSpecialDesc: 'Curl up and barrel around for 10 seconds — steer it, {d:20} damage a hit!',
    build: 'human', bulk: 1.95, head: 'clown',
    skin: 0xf5ece2, hair: 0xd8352a, trunks: 0xf2c60c, trunksTrim: 0xe0342f,
    gloves: 0xe0342f, boots: 0x2f7fd8, scaleY: 1.14, uiColor: '#ff7ab8'
  },
  vicious: {
    id: 'vicious', name: 'CHAMPION VICIOUS', tag: 'Nobody Beats The Champ',
    maxHp: 280, speed: 100, dmg: 30, mass: 1,
    playerHp: 240, playerDmg: 24,
    special: 'ultimate', specialName: 'VICIOUS FIVE', specialCooldown: 9,
    specialDesc: 'Five punches that climb — 5, 10, 15, 20, 25 damage, each healing him 20. Miss one and it starts over!',
    playerSpecialDesc: 'Five punches that climb — {d:5}, {d:10}, {d:15}, {d:20}, {d:25} damage, each healing you {h:20}. Miss one and it starts over!',
    build: 'human', bulk: 1.12, head: 'slick',
    skin: 0x8a5a30, hair: 0x140d1c, trunks: 0x2a0f3f, trunksTrim: 0xffd94d,
    gloves: 0x9b1fd8, boots: 0x140d1c, scaleY: 1.03, uiColor: '#d69bff'
  },
  // ---------------- SILVER TOURNAMENT ----------------
  joeabove: {
    id: 'joeabove', name: 'JOE ABOVE', tag: 'Everyman, Levelled Up',
    maxHp: 220, speed: 115, dmg: 22, mass: 1,
    playerHp: 225, playerDmg: 25, playerSpeed: 100,
    special: 'barrage', specialName: 'HAYMAKER HURRICANE', specialCooldown: 14,
    specialDesc: 'A furious barrage of 10 punches, 8 damage each — and he walks it onto you!',
    playerSpecialDesc: 'A furious barrage of 10 punches, {d:8} damage each — {d:80} in total, and you stride in with every swing!',
    build: 'human', bulk: 1.08, head: 'above', tier: 'silver',
    skin: 0xdd9a63, hair: 0x53350f, trunks: 0xc9ccd6, trunksTrim: 0xffd94d,
    gloves: 0x2b4ba0, boots: 0xffffff, scaleY: 1.02, uiColor: '#cfd8f7'
  },
  brick: {
    id: 'brick', name: 'BRICK MULLIGAN', tag: 'Built Like A Chimney',
    maxHp: 350, speed: 75, dmg: 25, mass: 2.0,
    playerHp: 300, playerDmg: 26,
    special: 'wall', specialName: 'RAISE THE WALL', specialCooldown: 16,
    specialDesc: 'Guards for 5 seconds — halves your damage, stores every punch, then hurls it all back at once. Cannot be dodged, at any range!',
    playerSpecialDesc: 'Guard for 5 seconds — incoming damage is halved and every punch is banked, then fired back in one shot. No range limit, and it cannot be dodged.',
    build: 'human', bulk: 1.7, head: 'brick', tier: 'silver',
    skin: 0xc98a5a, hair: 0x6b4a2a, trunks: 0x8e3b22, trunksTrim: 0xd9c9a3,
    gloves: 0x7a4a2c, boots: 0x3a2a1c, scaleY: 0.92, uiColor: '#e0a06a'
  },
  bull: {
    id: 'bull', name: 'BULLY BULL', tag: 'Head Down, Horns Up',
    maxHp: 300, speed: 150, dmg: 30, mass: 1.3,
    playerHp: 200, playerDmg: 24,
    special: 'charge', specialName: 'BULL RUSH', specialCooldown: 9,
    specialDesc: 'Lowers his head and charges clean across the ring — 75 damage if it connects!',
    playerSpecialDesc: 'Drop your head and charge clean across the ring — {d:75} damage if it connects!',
    build: 'human', bulk: 1.42, head: 'bull', physique: 'jacked', tier: 'silver',
    skin: 0xc08a55, hair: 0x2e2018, trunks: 0xf2f2ee, trunksTrim: 0x8a1f12,
    gloves: 0x9c4a2a, boots: 0x161616, scaleY: 0.95, uiColor: '#ffb37a'
  },
  mitchell: {
    id: 'mitchell', name: 'MAD COP MITCHELL', tag: 'Badge First, Questions Never',
    maxHp: 280, speed: 105, dmg: 35, mass: 1.63,   // 30% heavier — harder to shift
    playerHp: 240, playerDmg: 26,
    special: 'steel', specialName: 'STEEL KNUCKLES', specialCooldown: 15, meterPunches: 6,
    specialDesc: 'Plates his gloves in steel — his next 3 punches stun you stiff for a full second.',
    playerSpecialDesc: 'Plate your gloves in steel — your next 3 punches land for {d:26} and freeze them for a full second each.',
    build: 'human', bulk: 1.24, head: 'cop', physique: 'jacked', tier: 'silver',
    skin: 0xc2895e, hair: 0x2b2a33, trunks: 0x1d2c4d, trunksTrim: 0xe0c34a,
    gloves: 0x2a3a5c, boots: 0x14161f, scaleY: 1.0, uiColor: '#8fb4ff'
  },
  bigwave: {
    id: 'bigwave', name: 'BIG WAVE', tag: 'The Immovable Tide',
    maxHp: 500, speed: 60, dmg: 30, mass: 5.0,
    playerHp: 270, playerDmg: 28,
    special: 'shield', specialName: 'RISING TIDE', specialCooldown: 18,
    specialDesc: 'For 5 seconds he glows: your punches HEAL him and throw you back, and he moves and swings twice as fast!',
    build: 'human', bulk: 2.45, head: 'wave', tier: 'silver',
    skin: 0xe0b088, hair: 0x1c1a2e, trunks: 0x1b6fa8, trunksTrim: 0x7fd4ff,
    gloves: 0x2f9fd8, boots: 0x123c5c, scaleY: 1.2, uiColor: '#7fd4ff'
  },

  // ---------------- GOLD TOURNAMENT ----------------
  presto: {
    id: 'presto', name: 'PRESTO PRESTON', tag: 'Gone Before You Blink',
    maxHp: 275, speed: 200, dmg: 40, mass: 0.9,
    playerHp: 180, playerDmg: 22,
    special: 'ricochet', specialName: 'ROPE RICOCHET', specialCooldown: 11,
    specialDesc: 'Rockets into the nearest ropes and pinballs off them five times — 15 damage every time he clips you!',
    playerSpecialDesc: 'Rocket into the nearest ropes and pinball off them five times — {d:15} damage every time you clip him!',
    build: 'human', bulk: 1.14, head: 'presto', physique: 'jacked', tier: 'gold',
    skin: 0x63381c, hair: 0x14100c, trunks: 0xf4f4f0, trunksTrim: 0x8b5cf6,
    gloves: 0x8b5cf6, boots: 0x14100c, scaleY: 1.03, uiColor: '#c4a6ff'
  },
  // ---------------- CHALLENGES ----------------
  slumber: {
    id: 'slumber', name: 'SLUMBERJACK', tag: 'Out Cold, Not Out Of It',
    maxHp: 600, speed: 95, dmg: 30, mass: 1.7,
    playerHp: 260, playerDmg: 24,
    special: 'sleep', specialName: 'LOG NAP', specialCooldown: 16,
    specialDesc: 'Sleeps for 10 seconds, snoring back 25 health a second while drifting around the ring — even straight up. Bump into him and it\'s 30 damage. Hit him and he takes QUADRUPLE damage and flies a country mile, still fast asleep!',
    playerSpecialDesc: 'Sleep for 10 seconds, snoring back {h:25} health a second while you drift around the ring — even straight up. Anyone you bump takes {d:30}. Get hit and you take QUADRUPLE damage and fly a country mile, still fast asleep!',
    build: 'human', bulk: 1.42, head: 'slumber', physique: 'jacked', tier: 'challenge',
    skin: 0xe0a878, hair: 0x4a2a14, trunks: 0x8d2b22, trunksTrim: 0x2c2016,
    gloves: 0x6b4a2a, boots: 0x3b2a18, scaleY: 1.05, uiColor: '#d8a66a'
  },
  peter: {
    id: 'peter', name: 'PETER EATER', tag: 'Never Fights Hungry',
    maxHp: 400, speed: 100, dmg: 50, mass: 2.2,
    playerHp: 220, playerDmg: 26,
    special: 'feast', specialName: 'BURGER BREAK', specialCooldown: 20,
    feastHeal: 300, playerFeastHeal: 150,
    specialDesc: 'Wolfs down a burger — heals 300 over 3 seconds while moving twice as fast and swinging 50% quicker!',
    playerSpecialDesc: 'Wolf down a burger — heals {h:150} over 3 seconds while you move twice as fast and swing 50% quicker!',
    build: 'human', bulk: 1.85, head: 'peter', tier: 'gold',
    skin: 0xf0d3bb, hair: 0x1d1a17, trunks: 0x7a4a24, trunksTrim: 0xd9a441,
    gloves: 0x8a5a2c, boots: 0x4a2f18, scaleY: 1.06, uiColor: '#ffcf8a'
  },
  jimmy: {
    id: 'jimmy', name: 'JIMMY GOLD', tag: 'Cash Heals All Wounds',
    maxHp: 450, speed: 110, dmg: 40, mass: 1.2,
    playerHp: 240, playerDmg: 24,
    special: 'coins', specialName: 'GOLD RUSH', specialCooldown: 12,
    coinHeal: 35, playerCoinHeal: 30,
    specialDesc: 'Scatters 6 gold coins across the ring — only he can collect them, 50 health each!',
    playerSpecialDesc: 'Scatter 6 gold coins across the ring — only you can collect them, {h:30} health each ({h:180} in all)!',
    build: 'human', bulk: 1.2, head: 'jimmy', tier: 'gold',
    skin: 0xd9a066, hair: 0x2b1d0e, trunks: 0xd9a441, trunksTrim: 0xfff0b8,
    gloves: 0xffd94d, boots: 0x2b1d0e, scaleY: 1.02, uiColor: '#ffd94d'
  },
  gustavo: {
    id: 'gustavo', name: 'GUSTAVO MOHAWK', tag: 'One Eye, No Mercy',
    maxHp: 420, speed: 100, dmg: 40, mass: 1.8,
    playerHp: 285, playerDmg: 26, playerSpeed: 85,
    special: 'quake', specialName: 'FAULT LINE', specialCooldown: 9,
    quakeDmg: 130, playerQuakeDmg: 60,
    specialDesc: 'Slams the canvas and splits it open — 100 damage to anyone caught on the mat. Nowhere to jump.',
    playerSpecialDesc: 'Slam the canvas open — {d:60} damage to anyone still standing on it.',
    build: 'human', bulk: 1.55, head: 'gustavo', physique: 'jacked', tier: 'gold',
    skin: 0xb07a4a, hair: 0x8e2f1f, trunks: 0x3f4a2a, trunksTrim: 0xc2b280,
    gloves: 0x5a6b38, boots: 0x2b2418, scaleY: 1.05, uiColor: '#a8c46a'
  },
  hound: {
    id: 'hound', name: 'PRIME HOUND', tag: 'The Last Name On The Card',
    maxHp: 550, speed: 90, dmg: 50, mass: 2.0,
    playerHp: 270, playerDmg: 28,
    special: 'piledriver', specialName: 'HOUND SLAM', specialCooldown: 11,
    rageAt: 0.53,   // whirls at just over half health — as a fraction it fits your build too
    specialDesc: 'Hoists you overhead one-handed, leaps sky-high and spikes you into the canvas — 150 damage. Under 400 HP he goes into an 8-second spin.',
    playerSpecialDesc: 'Hoist them overhead one-handed, leap sky-high and spike them into the canvas — {d:150} damage. Drop past halfway and you whirl for 8 seconds — steer it, {d:20} damage a hit.',
    build: 'human', bulk: 1.62, head: 'hound', physique: 'jacked', tier: 'gold',
    skin: 0x8a4a3a, hair: 0x0d0a0e, trunks: 0x1a0d14, trunksTrim: 0xd8342a,
    gloves: 0xa8151a, boots: 0x0d0a0e, scaleY: 1.12, uiColor: '#ff6a5a'
  }
};

// ---- rig dimensions (character space, facing +Z, left = +X) ----
const RIG = {
  hipY: 0.92, chestY: 1.42, headY: 1.68,
  shoulderX: 0.27, hipX: 0.15,
  armLen: 0.60, legLen: 0.92, headR: 0.185
};

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);

// r128 has no CapsuleGeometry — a slightly tapered cylinder reads the same on limbs
function limbGeo(r, len) {
  return new THREE.CylinderGeometry(r, r * 0.82, len + r * 1.1, 10);
}

function groundYAt(x, z) {
  return (Math.abs(x) < RING.apron && Math.abs(z) < RING.apron) ? RING.top : 0;
}

function dampFactor(rate, dt) { return 1 - Math.exp(-rate * dt); }

// ============================================================
// RAGDOLL — 10-point verlet body
// point index: 0 head, 1 shL, 2 shR, 3 hipL, 4 hipR,
//              5 handL, 6 handR, 7 footL, 8 footR, 9 chestBrace(front)
// ============================================================
class Ragdoll {
  constructor() {
    this.pts = [];
    for (let i = 0; i < 10; i++) this.pts.push({ p: new THREE.Vector3(), o: new THREE.Vector3(), r: 0.09, pin: null });
    this.pts[0].r = RIG.headR;
    this.cons = [];
    this.active = false;
    this.landed = true;
    this.airTime = 0;
  }

  addCon(a, b, len, stiff = 1) { this.cons.push({ a, b, len, stiff }); }

  // local-space offsets of each point for a standing pose
  static offsets(s) {
    return [
      new THREE.Vector3(0, RIG.headY + 0.12, 0),
      new THREE.Vector3(RIG.shoulderX, RIG.chestY, 0),
      new THREE.Vector3(-RIG.shoulderX, RIG.chestY, 0),
      new THREE.Vector3(RIG.hipX, RIG.hipY, 0),
      new THREE.Vector3(-RIG.hipX, RIG.hipY, 0),
      new THREE.Vector3(RIG.shoulderX + 0.12, RIG.chestY - 0.1, 0.5),  // hands in guard
      new THREE.Vector3(-RIG.shoulderX - 0.12, RIG.chestY - 0.1, 0.5),
      new THREE.Vector3(RIG.hipX, 0.06, 0),
      new THREE.Vector3(-RIG.hipX, 0.06, 0),
      new THREE.Vector3(0, (RIG.chestY + RIG.hipY) / 2, 0.22)
    ].map(v => v.multiplyScalar(s));
  }

  seed(root, scale, vel, spin) {
    const offs = Ragdoll.offsets(scale);
    root.updateMatrixWorld(true);
    for (let i = 0; i < 10; i++) {
      const wp = offs[i].clone().applyQuaternion(root.quaternion).add(root.position);
      this.pts[i].p.copy(wp);
      // per-point velocity: base + spin differential (higher points get more → tumble)
      const heightFrac = offs[i].y / (RIG.headY * scale);
      const v = vel.clone().addScaledVector(spin, heightFrac - 0.5);
      v.x += (Math.random() - 0.5) * 0.8; v.z += (Math.random() - 0.5) * 0.8;
      this.pts[i].o.copy(wp).addScaledVector(v, -1 / 60);
      this.pts[i].pin = null;
    }
    if (this.cons.length === 0) {
      const d = (a, b) => offs[a].distanceTo(offs[b]);
      this.addCon(1, 2, d(1, 2));            // shoulders
      this.addCon(3, 4, d(3, 4));            // hips
      this.addCon(1, 3, d(1, 3)); this.addCon(2, 4, d(2, 4)); // torso sides
      this.addCon(1, 4, d(1, 4)); this.addCon(2, 3, d(2, 3)); // cross braces
      this.addCon(0, 1, d(0, 1)); this.addCon(0, 2, d(0, 2)); // neck
      this.addCon(9, 1, d(9, 1)); this.addCon(9, 2, d(9, 2)); // chest brace
      this.addCon(9, 3, d(9, 3)); this.addCon(9, 4, d(9, 4));
      this.addCon(0, 9, d(0, 9), 0.6);
      this.addCon(1, 5, RIG.armLen * scale, 0.9);  // arms
      this.addCon(2, 6, RIG.armLen * scale, 0.9);
      this.addCon(3, 7, RIG.legLen * scale, 0.95); // legs
      this.addCon(4, 8, RIG.legLen * scale, 0.95);
      this.addCon(7, 8, d(3, 4) * 1.4, 0.15);      // loose feet spacing
    }
    this.active = true;
    this.landed = false;
    this.airTime = 0;
    this.canLeaveRing = false;
  }

  step(dt) {
    const g = -22 * dt * dt; // heavier-than-life gravity reads punchier
    let maxSpeed = 0;
    for (const pt of this.pts) {
      if (pt.pin) { pt.o.copy(pt.p); pt.p.copy(pt.pin); continue; }
      _v1.subVectors(pt.p, pt.o).multiplyScalar(0.995);
      maxSpeed = Math.max(maxSpeed, _v1.length());
      pt.o.copy(pt.p);
      pt.p.add(_v1);
      pt.p.y += g;
    }
    // Only a deliberate throw sends a body over the ropes. Punch knockdowns,
    // slams and roll hits are always held in — otherwise a stray knockdown by
    // the ropes ejected you and instantly lost the fight. Once a thrown body is
    // past the ropes they must not catch it again on the way down.
    const cHips = this.center();
    const escX = this.canLeaveRing && Math.abs(cHips.x) > RING.postHalf;
    const escZ = this.canLeaveRing && Math.abs(cHips.z) > RING.postHalf;

    // constraints
    for (let iter = 0; iter < 5; iter++) {
      for (const c of this.cons) {
        const pa = this.pts[c.a], pb = this.pts[c.b];
        _v1.subVectors(pb.p, pa.p);
        const dl = _v1.length() || 0.0001;
        const diff = (dl - c.len) / dl * 0.5 * c.stiff;
        if (pa.pin && pb.pin) continue;
        const wa = pa.pin ? 0 : (pb.pin ? 1 : 0.5) * 2;
        const wb = pb.pin ? 0 : (pa.pin ? 1 : 0.5) * 2;
        pa.p.addScaledVector(_v1, diff * wa);
        pb.p.addScaledVector(_v1, -diff * wb);
      }
      // ground collision (bouncy = exaggerated)
      const ROPE_IN = RING.postHalf - 0.05, ROPE_OUT = RING.postHalf + 0.6;
      const ROPE_BOT = RING.top + 0.02, ROPE_TOP = RING.top + 1.0;
      for (const pt of this.pts) {
        if (pt.pin) continue;
        // the ropes catch bodies unless they fly OVER the top rope
        if (pt.p.y > ROPE_BOT && pt.p.y < ROPE_TOP) {
          for (const ax of ['x', 'z']) {
            if (ax === 'x' ? escX : escZ) continue;
            const v = pt.p[ax], pv = pt.o[ax];
            if (Math.abs(v) > ROPE_IN && Math.abs(v) < ROPE_OUT && Math.abs(v) > Math.abs(pv) - 0.001) {
              const s = Math.sign(v);
              const vel = v - pv;
              pt.p[ax] = s * ROPE_IN;
              pt.o[ax] = pt.p[ax] + vel * 0.75; // springy rope bounce
            }
          }
        }
        // ringside barrier: bodies never reach the crowd
        const BAR = ARENA.barrier - pt.r;
        for (const ax of ['x', 'z']) {
          if (Math.abs(pt.p[ax]) > BAR) {
            const sgn = Math.sign(pt.p[ax]);
            const v = pt.p[ax] - pt.o[ax];
            pt.p[ax] = sgn * BAR;
            pt.o[ax] = pt.p[ax] + v * 0.5;
          }
        }
        const gy = groundYAt(pt.p.x, pt.p.z) + pt.r;
        if (pt.p.y < gy) {
          const vy = pt.p.y - pt.o.y;
          pt.p.y = gy;
          if (vy < -0.015) pt.o.y = pt.p.y + Math.abs(vy) * 0.45; // bounce!
          else pt.o.y = pt.p.y;
          // friction
          pt.o.x += (pt.p.x - pt.o.x) * 0.35;
          pt.o.z += (pt.p.z - pt.o.z) * 0.35;
        }
      }
    }
    // landed / settled detection
    const hips = this.center();
    const onGround = hips.y < groundYAt(hips.x, hips.z) + 0.55;
    if (!onGround) { this.airTime += dt; this.landed = false; }
    else if (maxSpeed < 0.9 * dt * 60 / 60 + 0.035) this.landed = true;
    return { onGround, maxSpeed };
  }

  center() { return _v3.addVectors(this.pts[3].p, this.pts[4].p).multiplyScalar(0.5); }

  addImpulse(vel) {
    for (const pt of this.pts) { if (!pt.pin) pt.o.addScaledVector(vel, -1 / 60); }
  }
}

// ============================================================
// BOXER
// ============================================================
class Boxer {
  constructor(defId, scene, isPlayer) {
    this.cfg = BOXER_DEFS[defId];
    this.scene = scene;
    this.isPlayer = isPlayer;
    this.scale = this.cfg.scaleY;

    // Enemies use their tournament stats; the player uses the balanced
    // player-side numbers (cfg.playerHp / cfg.playerDmg when present) plus
    // whatever steroids have been spent on this fighter.
    const st = (isPlayer && typeof getSteroids === 'function') ? getSteroids(this.cfg.id) : { hp: 0, dmg: 0 };
    this.hpScale = 1 + 0.20 * st.hp;    // +20% max health per stack
    this.dmgScale = 1 + 0.15 * st.dmg;  // +15% damage per stack
    if (!isPlayer) { this.hpScale = 1; this.dmgScale = 1; }
    const baseHp = (isPlayer && this.cfg.playerHp != null) ? this.cfg.playerHp : this.cfg.maxHp;
    const baseDmg = (isPlayer && this.cfg.playerDmg != null) ? this.cfg.playerDmg : this.cfg.dmg;
    // special-move numbers that are tuned down on the player's side
    const pick = (key, dflt) => {
      const pk = 'player' + key.charAt(0).toUpperCase() + key.slice(1);
      if (isPlayer && this.cfg[pk] != null) return this.cfg[pk];
      return this.cfg[key] != null ? this.cfg[key] : dflt;
    };
    this.feastHeal = pick('feastHeal', 300);
    this.quakeDmg = pick('quakeDmg', 100);
    this.coinHeal = pick('coinHeal', isPlayer ? 30 : 50);
    this.maxHp = Math.round(baseHp * this.hpScale);
    this.hp = this.maxHp;
    // per-side like hp and damage: buffing the enemy champion shouldn't quietly
    // buff the version you play as
    this.speed = (isPlayer && this.cfg.playerSpeed != null) ? this.cfg.playerSpeed : this.cfg.speed;
    this.moveSpeed = 3.9 * (this.speed / 100);
    // separate from move speed: a slow bruiser can still have fast hands
    this.attackSpeed = (isPlayer && this.cfg.playerAttackSpeed) || this.cfg.attackSpeed || 1;
    this.dmg = Math.round(baseDmg * this.dmgScale);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();      // knockback velocity
    this.moveInput = new THREE.Vector3(); // desired velocity from controller
    this.yaw = 0;

    this.state = 'fight'; // fight | ragdoll | carried | getup | victory
    this.koTimer = 0;      // >0 → knocked out
    this.thrownBy = null;
    this.suplexVictim = false;
    this.pendingLandDmg = 0;
    this.eliminated = false;

    this.punchT = -1;      // -1 idle, else 0..1
    this.punchArm = 'R';
    this.punchDidHit = false;
    this.punchSpeed = 1;
    this.punchCd = 0;
    this.flinch = 0;
    this.stun = 0;
    this.busy = 0;         // generic action lock (suplex windup etc.)
    this.specialCd = 0;
    this.meter = 0;        // player only: 0..1, filled by landing punches
    this.barrage = null;   // { left, timer }
    this.carrying = null;  // Boxer being carried
    this.carriedBy = null;
    this.suplexAnim = 0;
    this.getupT = 0;
    this.walkPhase = 0;
    this.victoryT = 0;
    this.kdCd = 0;         // knockdown cooldown (prevents stagger-lock spam)
    this.jumpVel = 0;   // vertical velocity; nothing launches it now that jumping is out
    this.slam = null;      // Blaze: leap-and-crash
    this.roll = null;      // Honk: rolling riot
    this.wall = null;      // Brick: guard-and-counter
    this.charge = null;    // Bully Bull: the rush
    this.ricochet = null;  // Presto: pinballing off the ropes
    this.rage = null;      // player only: the AI has the wheel
    this.sleep = null;     // Slumberjack: flat out on the mat
    this.shield = 0;       // Big Wave: seconds of damage-to-heal left
    this.sinceHit = 999;   // seconds since last taking damage
    this.regen = false;    // catching your breath
    this.feast = null;     // Peter: burger boost
    this.quake = null;     // Gustavo: canvas slam
    this.rage = false;     // Prime Hound: has the spin already triggered?
    this.steel = 0;        // Mitchell: stunning punches left on the plating
    this.mass = this.cfg.mass || 1;

    this.flinchSide = 1;

    this.ragdoll = new Ragdoll();
    this.buildRig();

    // everything hanging off the torso except the arms gets hidden in
    // first-person (head, body, face, crown...) — arms and legs stay visible
    this.fpHide = this.parts.torso.children.filter(
      c => c !== this.parts.armL.shoulder && c !== this.parts.armR.shoulder
    );
    this.bodyHidden = false;
    this.displayPose = false;
  }

  setBodyHidden(hide) {
    if (this.bodyHidden === hide) return;
    this.bodyHidden = hide;
    for (const o of this.fpHide) o.visible = !hide;
  }

  // ---------------------------------------------------------
  buildRig() {
    const c = this.cfg;
    const s = this.scale;
    const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    const skinM = M(c.skin), glovesM = M(c.gloves, { roughness: 0.45 }),
      trunksM = M(c.trunks), bootsM = M(c.boots);

    const root = new THREE.Group();
    root.scale.setScalar(s);
    this.root = root;
    const P = this.parts = {};

    const shadowify = (m) => { m.castShadow = true; return m; };

    // ---- torso ----
    const torso = new THREE.Group();
    torso.position.y = RIG.hipY;
    root.add(torso);
    P.torso = torso;
    const torsoLen = RIG.chestY - RIG.hipY;

    const bulk = c.bulk || 1;
    if (c.build === 'bean') {
      // bean-shaped body: big squashed sphere covering hips→head
      const bean = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), skinM));
      bean.scale.set(0.78, 1.14, 0.72);
      bean.position.y = torsoLen * 0.55;
      torso.add(bean);
      const beanTop = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), skinM));
      beanTop.position.set(0, torsoLen * 0.55 + 0.42, 0.05);
      beanTop.userData.headPart = true;
      torso.add(beanTop);
      const eyeW = M(0xffffff, { roughness: 0.3 });
      const eyeB = M(0x1c1c1c, { roughness: 0.3 });
      const mkEye = (x) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeW);
        e.position.set(x, torsoLen * 0.55 + 0.46, 0.30);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeB);
        p.position.z = 0.055;
        e.add(p);
        e.userData.headPart = true;
        torso.add(e);
      };
      mkEye(0.13); mkEye(-0.13);
      const browM = M(0x2e5716);
      for (const x of [0.14, -0.14]) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.04), browM);
        brow.position.set(x, torsoLen * 0.55 + 0.56, 0.31);
        brow.rotation.z = x > 0 ? -0.25 : 0.25;
        brow.userData.headPart = true;
        torso.add(brow);
      }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), M(0x3d2b1f));
      mouth.position.set(0, torsoLen * 0.55 + 0.28, 0.325);
      mouth.userData.headPart = true;
      torso.add(mouth);
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.045), M(0xffd94d, { metalness: 0.6, roughness: 0.3 }));
      tooth.position.set(0.05, torsoLen * 0.55 + 0.28, 0.327);
      tooth.userData.headPart = true;
      torso.add(tooth);
      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.055, 8, 24), M(0xa2261b));
      sash.position.y = torsoLen * 0.42;
      sash.rotation.x = Math.PI / 2; sash.rotation.z = 0.35;
      sash.scale.set(1, 1, 1.6);
      torso.add(sash);
    } else {
      // human build — `bulk` scales from lean brawler to enormous clown
      const jacked = c.physique === 'jacked';
      const chest = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), skinM));
      chest.scale.set(bulk * (jacked ? 1.16 : 1), jacked ? 0.52 : 1.05, (jacked ? 0.62 : 0.72) * bulk);
      chest.position.y = torsoLen * (jacked ? 1.04 : 0.85);
      torso.add(chest);
      const belly = shadowify(new THREE.Mesh(
        new THREE.CylinderGeometry(
          (jacked ? 0.235 : 0.26) * bulk, (jacked ? 0.175 : 0.29) * bulk, torsoLen * 0.9, 16), skinM));
      belly.position.y = torsoLen * 0.42;
      belly.scale.z = 0.78;
      torso.add(belly);

      if (jacked) {
        // follow the real taper of the abdomen so every muscle sits ON the body
        const bTop = 0.235 * bulk, bBot = 0.175 * bulk;
        const bH = torsoLen * 0.9, bBottomY = torsoLen * 0.42 - bH / 2;
        const surfZ = (y) => (bBot + ((y - bBottomY) / bH) * (bTop - bBot)) * 0.78;

        // V-taper lats
        for (const sx of [1, -1]) {
          const lat = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinM));
          lat.scale.set(0.7, 1.35, 0.8);
          lat.position.set(sx * 0.285 * bulk, torsoLen * 0.72, -0.02);
          torso.add(lat);
        }
        // pecs
        for (const sx of [1, -1]) {
          const pec = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 11), skinM));
          pec.scale.set(1.12, 0.62, 0.6);
          pec.position.set(sx * 0.145, 0.50, 0.185 * bulk);
          torso.add(pec);
        }
        // delts
        for (const sx of [1, -1]) {
          const delt = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinM));
          delt.position.set(sx * (0.31 * bulk + 0.01), 0.52, 0.0);
          torso.add(delt);
        }

        // the eight-pack: four rows of two, cut apart by shadowed creases
        const creaseM = M(new THREE.Color(c.skin).multiplyScalar(0.4));
        const absTop = 0.33, absGap = 0.055;
        for (let row = 0; row < 4; row++) {
          const y = absTop - row * absGap;
          const w = 1 - row * 0.08;                    // taper toward the navel
          const z = surfZ(y);
          for (const sx of [1, -1]) {
            const ab = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 9), skinM));
            ab.scale.set(1.1 * w, 0.8, 0.85);
            ab.position.set(sx * 0.054 * w, y, z - 0.012);
            torso.add(ab);
          }
          if (row < 3) {  // crease under each row
            const cr = new THREE.Mesh(new THREE.BoxGeometry(0.19 * w, 0.011, 0.03), creaseM);
            cr.position.set(0, y - absGap / 2, surfZ(y - absGap / 2) + 0.026);
            torso.add(cr);
          }
        }
        // linea alba down the middle
        const midline = new THREE.Mesh(
          new THREE.BoxGeometry(0.013, absGap * 3 + 0.06, 0.03), creaseM);
        midline.position.set(0, absTop - absGap * 1.5, surfZ(absTop - absGap * 1.5) + 0.028);
        torso.add(midline);
        // crease between the pecs
        const pecLine = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.115, 0.03), creaseM);
        pecLine.position.set(0, 0.50, 0.185 * bulk + 0.055);
        torso.add(pecLine);
        // obliques flanking the abs
        for (const sx of [1, -1]) {
          const ob = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinM));
          ob.scale.set(0.6, 1.7, 0.62);
          ob.position.set(sx * 0.145, 0.26, surfZ(0.26) - 0.05);
          torso.add(ob);
        }
      }

      const waistY = jacked ? -0.07 : 0.02;
      const trunks = shadowify(new THREE.Mesh(
        new THREE.CylinderGeometry(
          (jacked ? 0.245 : 0.30) * bulk, (jacked ? 0.30 : 0.33) * bulk, 0.34, 16), trunksM));
      trunks.position.y = waistY;
      trunks.scale.z = 0.8;
      torso.add(trunks);
      const belt = new THREE.Mesh(
        new THREE.CylinderGeometry(
          (jacked ? 0.255 : 0.31) * bulk, (jacked ? 0.255 : 0.31) * bulk, 0.09, 16), M(c.trunksTrim));
      belt.position.y = waistY + 0.17;
      belt.scale.z = 0.8;
      torso.add(belt);

      if (c.head === 'clown') {
        // polka dots + ruffled collar
        for (let i = 0; i < 7; i++) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(c.trunksTrim));
          const a = i / 7 * Math.PI * 2;
          dot.position.set(Math.sin(a) * 0.32 * bulk, 0.02 + (i % 3) * 0.07, Math.cos(a) * 0.26 * bulk);
          dot.scale.z = 0.4;
          torso.add(dot);
        }
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 18), M(0xf2c60c));
        collar.position.y = torsoLen + 0.02;
        collar.rotation.x = Math.PI / 2;
        torso.add(collar);
      }
      if (c.head === 'slick') {
        // championship belt
        const strap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.315 * bulk, 0.315 * bulk, 0.16, 16), M(0x2b1608));
        strap.position.y = 0.2; strap.scale.z = 0.8;
        torso.add(strap);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12),
          M(0xffd94d, { metalness: 0.8, roughness: 0.22 }));
        plate.rotation.x = Math.PI / 2;
        plate.position.set(0, 0.2, 0.26 * bulk);
        torso.add(plate);
      }
      if (c.head === '__never__') {
        // scorch marks across the chest
        for (const x of [0.16, -0.16]) {
          const mark = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), M(0xff8c1a));
          mark.position.set(x, torsoLen * 0.8, 0.25 * bulk);
          mark.rotation.x = Math.PI / 2.1;
          torso.add(mark);
        }
      }
    }

    // ---- head ----
    const neck = new THREE.Group();
    neck.position.y = torsoLen + 0.02;
    torso.add(neck);
    P.neck = neck;

    if (c.build === 'bean') {
      const crown = new THREE.Group();
      const crownM = M(0xffd94d, { metalness: 0.75, roughness: 0.25 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.14, 10), crownM);
      crown.add(band);
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), crownM);
        const a = i / 6 * Math.PI * 2;
        spike.position.set(Math.sin(a) * 0.17, 0.14, Math.cos(a) * 0.17);
        crown.add(spike);
        if (i % 2 === 0) {
          const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(i === 0 ? 0x4dc3ff : 0xff4d4d, { roughness: 0.2 }));
          jewel.position.set(Math.sin(a) * 0.21, 0.0, Math.cos(a) * 0.21);
          crown.add(jewel);
        }
      }
      crown.position.y = 0.52;
      crown.rotation.z = 0.08;
      neck.add(crown);
      P.headMesh = crown;
    } else {
      const head = new THREE.Group();
      const headBig = c.head === 'clown' ? 1.25 : 1;
      const skull = shadowify(new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * headBig, 18, 14), skinM));
      skull.scale.set(0.92, 1.05, 0.95);
      head.add(skull);
      const hr = RIG.headR * headBig;

      for (const x of [0.18 * headBig, -0.18 * headBig]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skinM);
        ear.position.set(x, 0, 0);
        head.add(ear);
      }
      // eyes
      const eyeW = M(0xffffff, { roughness: 0.3 });
      const eyeB = M(0x1c1c1c);
      for (const x of [0.075 * headBig, -0.075 * headBig]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.042 * headBig, 8, 6), eyeW);
        e.position.set(x, 0.02, hr * 0.84);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.02 * headBig, 6, 5), eyeB);
        p.position.z = 0.032;
        e.add(p);
        head.add(e);
      }
      const browM = M(c.head === 'clown' ? 0xd8352a : c.hair);
      for (const x of [0.08 * headBig, -0.08 * headBig]) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09 * headBig, 0.028, 0.03), browM);
        brow.position.set(x, 0.085 * headBig, hr * 0.9);
        // scowl: inner ends dropped toward the nose, outer ends raised.
        // (The opposite slant reads as sad — Vicious looked like he was crying.)
        if (c.head === 'slick' || c.head === 'buzz') brow.rotation.z = x > 0 ? 0.5 : -0.5;
        head.add(brow);
      }

      if (c.head === 'flattop') {
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.13, 0.3), M(c.hair));
        hair.position.y = 0.15;
        head.add(hair);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xdda06f));
        nose.position.set(0, -0.03, 0.18);
        head.add(nose);
        const aid = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.032, 0.012), M(0xd9c9a3));
        aid.position.set(-0.11, -0.06, 0.145);
        aid.rotation.z = 0.5; aid.rotation.y = -0.55;
        head.add(aid);
      } else if (c.head === 'buzz') {
        // close-cropped buzz cut hugging the skull
        const cut = new THREE.Mesh(
          new THREE.SphereGeometry(RIG.headR * 1.03, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
          M(c.hair, { roughness: 0.95 }));
        cut.scale.set(0.99, 1.02, 1.0);
        cut.position.y = 0.012;
        head.add(cut);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), skinM);
        nose.position.set(0, -0.03, 0.18);
        head.add(nose);
        // trimmed goatee
        const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(c.hair, { roughness: 0.95 }));
        goatee.scale.set(1, 0.72, 0.6);
        goatee.position.set(0, -0.13, 0.135);
        head.add(goatee);
      } else if (c.head === 'presto') {
        // close fade, mouth open mid-roar
        const fade = new THREE.Mesh(
          new THREE.SphereGeometry(RIG.headR * 1.02, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), M(c.hair, { roughness: 0.95 }));
        fade.scale.set(1, 0.9, 1.02);
        fade.position.y = 0.02;
        head.add(fade);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), skinM);
        nose.position.set(0, -0.03, 0.18);
        head.add(nose);
        const roar = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(0x3a1c18));
        roar.scale.set(1, 0.85, 0.5);
        roar.position.set(0, -0.095, 0.155);
        head.add(roar);
      } else if (c.head === 'peter') {
        // bald dome, heavy brows, huge toothy grin and a moustache
        const dome = shadowify(new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), skinM));
        dome.scale.set(1, 0.9, 1);
        dome.position.y = 0.02;
        head.add(dome);
        const grin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.04), M(0x2a1410));
        grin.position.set(0, -0.085, 0.16);
        head.add(grin);
        for (let i = 0; i < 4; i++) {
          const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.02), M(0xfdfbf2));
          tooth.position.set(-0.066 + i * 0.044, -0.078, 0.176);
          head.add(tooth);
        }
        const stache = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.035), M(c.hair));
        stache.position.set(0, -0.042, 0.168);
        head.add(stache);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xdfb495));
        nose.position.set(0, -0.005, 0.185);
        head.add(nose);
      } else if (c.head === 'jimmy') {
        // slicked hair, gold shades, gold tooth
        const hair = new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(c.hair));
        hair.scale.set(0.99, 0.85, 1.05);
        hair.position.set(0, 0.03, -0.02);
        head.add(hair);
        const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.065, 0.05),
          M(0xffd94d, { metalness: 0.85, roughness: 0.2 }));
        shades.position.set(0, 0.02, 0.16);
        head.add(shades);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skinM);
        nose.position.set(0, -0.035, 0.18);
        head.add(nose);
        const smirk = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.016, 0.012), M(0x6b4a34));
        smirk.position.set(0, -0.095, 0.165);
        head.add(smirk);
        const goldTooth = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.024, 0.014),
          M(0xffd94d, { metalness: 0.9, roughness: 0.15 }));
        goldTooth.position.set(0.03, -0.096, 0.172);
        head.add(goldTooth);
      } else if (c.head === 'gustavo') {
        // tall mohawk, eyepatch and a hard mouth
        for (let i = 0; i < 6; i++) {
          const hgt = 0.26 - Math.abs(i - 2.5) * 0.04;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, hgt, 5), M(c.hair));
          spike.position.set(0, 0.15 + hgt / 2, 0.115 - i * 0.046);
          head.add(spike);
        }
        const patch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.085, 0.03), M(0x14110f));
        patch.position.set(-0.078, 0.02, 0.15);
        head.add(patch);
        const strap = new THREE.Mesh(new THREE.TorusGeometry(RIG.headR * 0.99, 0.011, 6, 20), M(0x14110f));
        strap.position.set(0, 0.045, 0);
        strap.rotation.y = Math.PI / 2;
        strap.rotation.x = 0.35;
        head.add(strap);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), skinM);
        nose.position.set(0, -0.035, 0.18);
        head.add(nose);
        const grim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.016, 0.012), M(0x4a2a1c));
        grim.position.set(0, -0.095, 0.163);
        head.add(grim);
      } else if (c.head === 'slumber') {
        // woolly hat pulled low, enormous lumberjack beard, permanently drowsy
        const hat = shadowify(new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * 1.06, 14, 10,
          0, Math.PI * 2, 0, Math.PI / 2), M(c.trunks)));
        hat.position.y = 0.02; hat.scale.y = 0.82;
        head.add(hat);
        const brim = new THREE.Mesh(new THREE.TorusGeometry(RIG.headR * 1.02, 0.032, 8, 22), M(c.trunksTrim));
        brim.position.y = 0.02; brim.rotation.x = Math.PI / 2;
        head.add(brim);
        const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(c.trunksTrim));
        bobble.position.set(0, RIG.headR * 0.96, 0);
        head.add(bobble);
        const beard = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), M(c.hair)));
        beard.position.set(0, -0.115, 0.075); beard.scale.set(1.1, 0.95, 0.8);
        head.add(beard);
        const stache = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.038, 0.04), M(c.hair));
        stache.position.set(0, -0.055, 0.165);
        head.add(stache);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), skinM);
        nose.position.set(0, -0.02, 0.185);
        head.add(nose);
      } else if (c.head === 'hound') {
        // sharp jaw, bared teeth, burning eyes
        const jaw = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.22), skinM));
        jaw.position.set(0, -0.095, 0.035);
        head.add(jaw);
        const snarl = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.04), M(0x24080a));
        snarl.position.set(0, -0.085, 0.165);
        head.add(snarl);
        for (let i = 0; i < 5; i++) {
          const fang = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 4), M(0xfdf6ea));
          fang.position.set(-0.06 + i * 0.03, -0.088, 0.18);
          fang.rotation.x = Math.PI;
          head.add(fang);
        }
        const crest = new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * 1.03, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), M(c.hair));
        crest.scale.set(1, 0.75, 1.04);
        crest.position.y = 0.035;
        head.add(crest);
        // eyes burn red
        for (const x of [0.075, -0.075]) {
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6),
            new THREE.MeshBasicMaterial({ color: 0xff3b2a }));
          glow.position.set(x, 0.02, hr * 0.9);
          head.add(glow);
        }
      } else if (c.head === 'above') {
        // Joe, but with the swagger: flat-top, gold headband, shades
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.13, 0.3), M(c.hair));
        hair.position.y = 0.15;
        head.add(hair);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.055, 0.33), M(0xffd94d, { metalness: 0.5, roughness: 0.35 }));
        band.position.y = 0.085;
        head.add(band);
        const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), M(0x14161f, { roughness: 0.2, metalness: 0.4 }));
        shades.position.set(0, 0.02, 0.16);
        head.add(shades);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skinM);
        nose.position.set(0, -0.04, 0.18);
        head.add(nose);
        const smirk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.012), M(0x8a5a3a));
        smirk.position.set(0.015, -0.1, 0.16);
        smirk.rotation.z = -0.22;
        head.add(smirk);
      } else if (c.head === 'cop') {
        // peaked cap with a badge, mirrored shades and a regulation moustache
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.205, 0.12, 16), M(c.trunks));
        cap.position.y = 0.145;
        head.add(cap);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(c.trunks));
        crown.scale.set(1, 0.34, 1);
        crown.position.y = 0.2;
        head.add(crown);
        const peak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.028, 0.16), M(0x11131b));
        peak.position.set(0, 0.093, 0.16);
        peak.rotation.x = -0.16;
        head.add(peak);
        const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 6),
          M(0xe0c34a, { metalness: 0.75, roughness: 0.28 }));
        badge.rotation.x = Math.PI / 2;
        badge.position.set(0, 0.16, 0.185);
        head.add(badge);
        const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.075, 0.05),
          M(0x0f1622, { roughness: 0.12, metalness: 0.65 }));
        shades.position.set(0, 0.015, 0.16);
        head.add(shades);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), skinM);
        nose.position.set(0, -0.045, 0.18);
        head.add(nose);
        const tash = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.045), M(c.hair));
        tash.position.set(0, -0.085, 0.165);
        head.add(tash);
        const jaw = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.18), skinM));
        jaw.position.set(0, -0.13, 0.03);
        head.add(jaw);
      } else if (c.head === 'brick') {
        // squat bricklayer: flat cap, heavy jaw, stubble
        const jaw = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.2), skinM));
        jaw.position.set(0, -0.1, 0.03);
        head.add(jaw);
        const stubble = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.19), M(0x4a3524));
        stubble.position.set(0, -0.115, 0.045);
        head.add(stubble);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(c.hair));
        cap.scale.set(1, 0.62, 1);
        cap.position.y = 0.045;
        head.add(cap);
        const peak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.14), M(0x54361c));
        peak.position.set(0, 0.05, 0.17);
        peak.rotation.x = -0.12;
        head.add(peak);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), M(0xb87748));
        nose.position.set(0, -0.03, 0.185);
        head.add(nose);
      } else if (c.head === 'bull') {
        // bald bruiser, heavy brow ridge, broad jaw, brass nose ring
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.09), M(0xa8703f));
        brow.position.set(0, 0.075, 0.14);
        head.add(brow);
        const jaw = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.22), skinM));
        jaw.position.set(0, -0.09, 0.03);
        head.add(jaw);
        const scowl = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.012), M(0x3a1f14));
        scowl.position.set(0, -0.088, 0.16);
        head.add(scowl);
        const crop = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), M(c.hair));
        crop.scale.set(1, 0.5, 1);
        crop.position.set(0, 0.055, -0.03);
        head.add(crop);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), M(0xd8b23d, { metalness: 0.8, roughness: 0.25 }));
        ring.position.set(0, -0.075, 0.17);
        head.add(ring);
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xb87748));
        snout.position.set(0, -0.025, 0.19);
        head.add(snout);
      } else if (c.head === 'wave') {
        // the immovable tide: jowls, topknot, calm unbothered face
        for (const sx of [1, -1]) {
          const jowl = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 9), skinM));
          jowl.scale.set(0.85, 1, 0.8);
          jowl.position.set(sx * 0.13, -0.085, 0.06);
          head.add(jowl);
        }
        const knotBase = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(c.hair));
        knotBase.scale.set(1, 0.55, 1);
        knotBase.position.y = 0.04;
        head.add(knotBase);
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M(c.hair));
        knot.position.set(0, 0.17, -0.02);
        head.add(knot);
        const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 14), M(c.trunksTrim));
        tie.position.set(0, 0.115, -0.01);
        tie.rotation.x = Math.PI / 2;
        head.add(tie);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), M(0xc99b72));
        nose.position.set(0, -0.02, 0.185);
        head.add(nose);
        const calm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.012), M(0x6b4a34));
        calm.position.set(0, -0.09, 0.165);
        head.add(calm);
      } else if (c.head === 'clown') {
        // big red nose + curly hair puffs + tiny hat
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M(0xe0342f, { roughness: 0.35 }));
        nose.position.set(0, -0.02, hr * 0.95);
        head.add(nose);
        for (const sx of [1, -1]) {
          for (let i = 0; i < 3; i++) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(0.088 - i * 0.012, 10, 8), M(c.hair));
            puff.position.set(sx * (0.19 + i * 0.04), 0.10 - i * 0.075, -0.02 - i * 0.02);
            head.add(puff);
          }
        }
        const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.022, 12), M(0x2f7fd8));
        hatBrim.position.y = 0.2;
        head.add(hatBrim);
        const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.13, 12), M(0x2f7fd8));
        hatTop.position.y = 0.27;
        head.add(hatTop);
        // painted grin
        const grin = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14, Math.PI), M(0xe0342f));
        grin.position.set(0, -0.1, hr * 0.85);
        grin.rotation.z = Math.PI;
        head.add(grin);
      } else if (c.head === 'slick') {
        // slicked-back hair + scar
        const hair = new THREE.Mesh(new THREE.SphereGeometry(RIG.headR * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(c.hair));
        hair.scale.set(0.98, 0.9, 1.06);
        hair.position.set(0, 0.03, -0.02);
        head.add(hair);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), skinM);
        nose.position.set(0, -0.03, 0.18);
        head.add(nose);
        // scar slashed across the brow — kept well clear of the eye, and in a
        // muted scar-tissue tone, so it never reads as a tear running down
        const grim = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.015, 0.012), M(0x3b2416));
        grim.position.set(0, -0.088, 0.158);
        head.add(grim);
        const scar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.085, 0.012), M(0xa87a52));
        scar.position.set(0.105, 0.098, 0.15);
        scar.rotation.z = 0.62;
        head.add(scar);
      }
      head.position.y = RIG.headY - RIG.chestY + 0.06;
      neck.add(head);
      P.headMesh = head;
    }

    // ---- arms ----
    const armR = 0.085, armLenU = RIG.armLen * 0.5;
    const mkArm = (side) => { // side +1 = left (+X)
      const shoulder = new THREE.Group();
      const shX = c.build === 'bean'
        ? RIG.shoulderX + 0.14
        : RIG.shoulderX + 0.05 + (bulk - 1) * 0.3;
      shoulder.position.set(side * shX, torsoLen - 0.06, c.build === 'bean' ? 0.1 : 0);
      torso.add(shoulder);
      const armThick = c.build === 'bean' ? 0.06 : armR * (1 + (bulk - 1) * 0.45);
      const upper = shadowify(new THREE.Mesh(limbGeo(armThick, armLenU), skinM));
      upper.position.y = -armLenU / 2 - 0.03;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -armLenU - 0.05;
      shoulder.add(elbow);
      const fore = shadowify(new THREE.Mesh(limbGeo(armThick * 0.9, armLenU * 0.85), skinM));
      fore.position.y = -armLenU * 0.42;
      elbow.add(fore);
      // glove
      const glove = shadowify(new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), glovesM));
      glove.scale.set(1, 1.12, 1.25);
      glove.position.y = -armLenU * 0.85 - 0.08;
      elbow.add(glove);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.09, 10), M(0xffffff));
      cuff.position.y = -armLenU * 0.85 + 0.05;
      elbow.add(cuff);
      if (c.head === 'gustavo') {
        for (let i = 0; i < 2; i++) {
          const band = new THREE.Mesh(
            new THREE.TorusGeometry(armThick * 1.06, 0.012, 6, 14), M(0x25303d));
          band.rotation.x = Math.PI / 2;
          band.position.y = -armLenU * (0.32 + i * 0.34);
          shoulder.add(band);
        }
        const ink = new THREE.Mesh(new THREE.BoxGeometry(armThick * 1.5, 0.05, 0.012), M(0x25303d));
        ink.position.set(0, -armLenU * 0.62, armThick);
        shoulder.add(ink);
      }
      return { shoulder, elbow, glove, upper, fore };
    };
    P.armL = mkArm(1);
    P.armR = mkArm(-1);
    P.glovesMat = glovesM;   // Mitchell plates these in steel
    this.gloveColor = c.gloves;

    // ---- legs ----
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * RIG.hipX * (1 + (bulk - 1) * 0.9), RIG.hipY, 0);
      root.add(hip);
      const legThick = c.build === 'bean' ? 0.07 : 0.1 * (1 + (bulk - 1) * 0.4);
      const thigh = shadowify(new THREE.Mesh(limbGeo(legThick, RIG.legLen * 0.42), skinM));
      thigh.position.y = -RIG.legLen * 0.24;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -RIG.legLen * 0.48;
      hip.add(knee);
      const shin = shadowify(new THREE.Mesh(limbGeo(legThick * 0.85, RIG.legLen * 0.4), skinM));
      shin.position.y = -RIG.legLen * 0.22;
      knee.add(shin);
      // boot
      const boot = shadowify(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), bootsM));
      boot.position.set(0, -RIG.legLen * 0.46, 0.06);
      knee.add(boot);
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.1), M(0xffffff));
      lace.position.set(0, -RIG.legLen * 0.42, 0.09);
      knee.add(lace);
      return { hip, knee };
    };
    P.legL = mkLeg(1);
    P.legR = mkLeg(-1);

    if (c.special === 'feast') {
      const burger = new THREE.Group();
      const bunTop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd9a441));
      bunTop.scale.y = 0.7; bunTop.position.y = 0.045;
      const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.045, 12), M(0x5a3218));
      patty.scale.set(1.05, 1.25, 1.05);
      const lettuce = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.018, 12), M(0x6faa3c));
      lettuce.position.y = 0.032;
      lettuce.scale.set(1.06, 2.2, 1.06);   // a green stripe you can read across the ring
      const bunBot = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.045, 12), M(0xc9913a));
      bunBot.position.y = -0.042;
      burger.add(bunTop, patty, lettuce, bunBot);
      // It used to sit at the WRIST, half inside the glove, and the eating pose
      // held it behind a belly that reaches 0.59 further forward than his own
      // mouth — so head-on (i.e. from where you fight him) it was never visible.
      // Now it sits in the hand, past the glove surface, and the local rotation
      // stands the stack upright against the raised-arm pose below.
      burger.position.set(0, -0.40, 0.17);
      burger.rotation.set(-2.54, 2.86, 1.16);
      burger.scale.setScalar(1.7);
      burger.visible = false;
      P.armR.elbow.add(burger);
      P.burger = burger;

      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 20, 14),
        new THREE.MeshBasicMaterial({
          color: 0xffa32e, transparent: true, opacity: 0.26,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide
        }));
      aura.position.y = 1.0;
      aura.visible = false;
      root.add(aura);
      P.feastAura = aura;
    }

    // RISING TIDE bubble — front faces only, so opponents see the glow but a
    // shielded player still has a clear first-person view from inside it
    if (c.special === 'shield') {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(1.3, 22, 16),
        new THREE.MeshBasicMaterial({
          color: 0x6fd0ff, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide
        }));
      bubble.position.y = 1.05;
      bubble.visible = false;
      const wire = new THREE.Mesh(
        new THREE.SphereGeometry(1.33, 16, 11),
        new THREE.MeshBasicMaterial({
          color: 0xcdf1ff, wireframe: true, transparent: true,
          opacity: 0.55, depthWrite: false
        }));
      bubble.add(wire);
      root.add(bubble);
      P.shieldMesh = bubble;
    }

    this.scene.add(root);
  }

  // ---------------------------------------------------------
  get isKO() { return this.koTimer > 0; }
  get isRagdolled() { return this.state === 'ragdoll' || this.state === 'carried'; }
  // Off the canvas — mid-jump or mid-meteor. Punches shouldn't connect with a
  // body that isn't standing there.
  get airborne() {
    return this.pos.y > groundYAt(this.pos.x, this.pos.z) + 0.3 || !!this.slam;
  }

  // Anything that would throw a sleeping wrestler turns into this instead: the
  // strings are cut, he whips end over end, and he stays asleep. It lives here
  // so EVERY route in — punches, rolls, charges, quakes, throws — behaves the
  // same. Rolling Riot used to call launch() directly and ragdoll him properly,
  // which gave him normal knockback and a get-up animation mid-nap.
  sleepSmack(vel) {
    const s = this.sleep;
    if (!s) return;
    s.freeT = Math.max(s.freeT, 1.1);
    s.shoveT = 0; s.shove.set(0, 0, 0);
    for (const pt of this.ragdoll.pts) pt.pin = null;
    this.ragdoll.addImpulse(vel);
    for (const pt of this.ragdoll.pts) {
      pt.o.addScaledVector(_v1.set((Math.random() - 0.5) * 9,
                                   (Math.random() - 0.5) * 9,
                                   (Math.random() - 0.5) * 9), -1 / 60);
    }
    this.vel.set(0, 0, 0);
  }
  wake() {
    if (!this.sleep) return;
    if (this.sleep.seeded) for (const pt of this.ragdoll.pts) pt.pin = null;
    this.sleep = null;
    this.pos.y = groundYAt(this.pos.x, this.pos.z);   // gravity remembers him
    this.stun = Math.max(this.stun, 0.35);   // groggy for a beat
    if (this.onWake) this.onWake(this);
  }
  get canAct() { return this.state === 'fight' && this.stun <= 0 && this.busy <= 0 && !this.barrage && !this.carrying && !this.slam && !this.roll && !this.wall && !this.charge && !this.ricochet && !this.sleep && !this.quake
      && !(this.feast && this.feast.eating > 0); }   // the boost half of a feast is fully playable

  headWorldPos() {
    _v1.set(0, RIG.headY * this.scale, 0).applyQuaternion(this.root.quaternion);
    return _v1.add(this.pos);
  }

  chestWorldPos(target) {
    if (this.isRagdolled) return target.copy(this.ragdoll.pts[9].p);
    return target.set(this.pos.x, this.pos.y + RIG.chestY * this.scale * 0.9, this.pos.z);
  }

  // ---------------------------------------------------------

  startPunch(speedMul = 1) {
    if (this.punchCd > 0 || this.punchT >= 0) return false;
    if (this.shield > 0) speedMul *= 2;              // Rising Tide: twice as fast
    if (this.feast && this.feast.eating <= 0) speedMul *= 1.5;  // Burger Break: 50% quicker
    this.punchArm = this.punchArm === 'R' ? 'L' : 'R';
    this.punchT = 0;
    this.punchDidHit = false;
    this.punchSpeed = speedMul;
    this.punchCd = (0.52 / speedMul) * (100 / this.speed) / this.attackSpeed;
    return true;
  }

  takeHit(dmg, fromDir, big = false) {
    if (this.eliminated || this.isKO) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.sinceHit = 0;                     // interrupts the regen
    this.flinch = Math.min(1, this.flinch + (big ? 1 : 0.7));
    this.flinchSide = Math.random() < 0.5 ? -1 : 1;
    this.stun = Math.max(this.stun, big ? 0.45 : 0.26);
    if (!this.isRagdolled) {
      this.vel.addScaledVector(fromDir, (big ? 4.5 : 2.6) / this.mass);
    }
  }

  knockOut(impulse) {
    this.koTimer = 3;
    this.hp = 0;
    this.barrage = null;
    this.busy = 0;
    this.slam = null;
    this.roll = null;
    this.wall = null;
    this.charge = null;
    this.ricochet = null;
    if (this.sleep) { for (const pt of this.ragdoll.pts) pt.pin = null; this.sleep = null; }
    this.feast = null;
    this.quake = null;
    this.setSteel(0);
    this.parts.torso.position.y = RIG.hipY;
    if (this.carrying) this.dropCarried();
    if (this.state !== 'ragdoll') {
      this.state = 'ragdoll';
      const spin = new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      this.ragdoll.seed(this.root, this.scale, impulse || new THREE.Vector3(0, 2.5, 0), spin);
    } else if (impulse) {
      this.ragdoll.addImpulse(impulse);
    }
  }

  // throw / suplex launch: full ragdoll flight
  // canLeaveRing: only true for a deliberate heave out of the ring
  launch(vel, landDmg, byBoxer, canLeaveRing = false) {
    // super armour: nothing knocks a rolling boxer out of the Rolling Riot.
    // Damage still lands; only dropping to 0 hp stops the roll.
    if ((this.roll || this.wall || this.quake) && this.hp > 0) return;   // super armour
    // asleep: never becomes a real ragdoll, so no normal knockback and no get-up
    if (this.sleep && this.hp > 0) { this.sleepSmack(vel.clone().multiplyScalar(1.8)); return; }
    if (this.carrying) this.dropCarried();
    // heavy fighters are harder to throw — but a square-root curve keeps even
    // the clown ejectable from the ring edge, which is the only win condition
    vel = vel.clone().multiplyScalar(1 / Math.sqrt(this.mass));
    this.slam = null; this.roll = null;
    this.barrage = null; this.busy = 0;
    this.pendingLandDmg = landDmg;
    this.thrownBy = byBoxer || null;

    if (this.state === 'carried' || this.state === 'ragdoll') {
      for (const pt of this.ragdoll.pts) pt.pin = null;
      this.ragdoll.addImpulse(vel);
      this.ragdoll.airTime = 0; this.ragdoll.landed = false;
    } else {
      this.state = 'ragdoll';
      const spin = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
      spin.add(vel.clone().multiplyScalar(0.35)); // dramatic flips along flight dir
      this.ragdoll.seed(this.root, this.scale, vel, spin);
    }
    this.ragdoll.canLeaveRing = canLeaveRing;   // seed() clears it, so set it last
    this.state = 'ragdoll';
  }

  dropCarried() {
    if (!this.carrying) return;
    const v = this.carrying;
    v.carriedBy = null;
    v.state = 'ragdoll';
    for (const pt of v.ragdoll.pts) pt.pin = null;
    this.carrying = null;
  }

  // stop a spin cleanly — used when it times out and when the AI breaks it off
  // STEEL KNUCKLES — the gloves go metal for a few punches, then back to leather
  // A championship medal on a ribbon, hung round the neck. Rebuilt whenever the
  // tier changes; null clears it.
  wearMedal(medal) {
    if (this.medalGroup) {
      this.parts.torso.remove(this.medalGroup);
      this.medalGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      this.medalGroup = null;
    }
    if (!medal) return;
    const torsoLen = RIG.chestY - RIG.hipY;
    const g = new THREE.Group();
    const ribbonM = new THREE.MeshStandardMaterial({ color: medal.ribbon, roughness: 0.85 });
    const metalM = new THREE.MeshStandardMaterial({
      color: medal.metal, metalness: 0.85, roughness: 0.22 });
    // Hang it off the ACTUAL chest surface. The old formula (0.17 + bulk*0.06)
    // grew far too slowly: Honk's belly reaches ~0.48 out at bulk 1.95 and the
    // medal sat at 0.30 — completely buried inside him. These are the same
    // numbers buildRig uses for the chest sphere.
    const bulk = this.cfg.bulk || 1;
    const jacked = this.cfg.physique === 'jacked';
    const chestDepth = this.cfg.build === 'bean'
      ? 0.5 * 0.72                                   // his body IS the sphere
      : 0.34 * (jacked ? 0.62 : 0.72) * bulk;
    const reach = chestDepth + 0.05;
    const hangY = torsoLen * 0.72;
    const hangZ = reach + 0.015;
    for (const side of [1, -1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.018), ribbonM);
      strap.position.set(side * reach * 0.36, hangY + 0.19, reach - 0.01);
      strap.rotation.set(-0.12, 0, side * 0.3);
      g.add(strap);
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.018, 18), metalM);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, hangY, hangZ);
    g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 20), metalM);
    rim.position.copy(disc.position);
    g.add(rim);
    this.parts.torso.add(g);
    this.medalGroup = g;
  }

  setSteel(n) {
    this.steel = Math.max(0, n);
    const mat = this.parts && this.parts.glovesMat;
    if (!mat) return;
    if (this.steel > 0) {
      mat.color.setHex(0xd6dae2);
      mat.metalness = 0.85;
      mat.roughness = 0.22;
    } else {
      mat.color.setHex(this.gloveColor);
      mat.metalness = 0;
      mat.roughness = 0.45;
    }
  }

  endRoll() {
    if (!this.roll) return;
    this.roll = null;
    this.parts.torso.position.y = RIG.hipY;
    this.root.rotation.set(0, this.yaw, 0);
    this.root.quaternion.setFromEuler(this.root.rotation);
  }

  tryGetUp() {
    // called when KO expires (or non-KO ragdoll settles)
    // out of the ring is out of the fight — you lie where you landed
    if (this.eliminated) return;
    const c = this.ragdoll.center();
    this.pos.set(c.x, groundYAt(c.x, c.z), c.z);
    this.state = 'getup';
    this.getupT = 0;
    this.vel.set(0, 0, 0);
  }

  // ---------------------------------------------------------
  update(dt, t, opponent) {
    const P = this.parts;

    if (this.specialCd > 0) this.specialCd -= dt;
    if (this.punchCd > 0) this.punchCd -= dt;
    if (this.stun > 0) this.stun -= dt;
    if (this.busy > 0) this.busy -= dt;
    if (this.kdCd > 0) this.kdCd -= dt;
    if (this.shield > 0) this.shield -= dt;
    // The nap is 10 seconds of wall clock wherever he happens to be — mid-air
    // included. Only the HEALING needs him actually lying on the mat.
    if (this.sleep) {
      this.sleep.left -= dt;
      if (this.sleep.left <= 0) this.wake();
    }
    if (this.parts && this.parts.feastAura) {
      const on = !!(this.feast && this.feast.eating <= 0);
      this.parts.feastAura.visible = on;
      if (on) {
        this.parts.feastAura.scale.setScalar(1 + Math.sin(t * 13) * 0.06);
        this.parts.feastAura.material.opacity = 0.22 + Math.sin(t * 10) * 0.1;
      }
    }
    if (this.parts && this.parts.shieldMesh) {
      const on = this.shield > 0;
      this.parts.shieldMesh.visible = on;
      if (on) {
        const pulse = 1 + Math.sin(t * 11) * 0.05;
        this.parts.shieldMesh.scale.setScalar(pulse);
        this.parts.shieldMesh.material.opacity = 0.26 + Math.sin(t * 9) * 0.09;
        this.parts.shieldMesh.rotation.y += dt * 1.6;
      }
    }
    this.flinch = Math.max(0, this.flinch - dt * 3.2);

    // Catch your breath: 3 clean seconds and you start healing back up. Getting
    // up from a knockdown resets this clock, so a knockdown never heals you —
    // you stand on a flat 40% and have to earn the rest.
    // only counts while you're actually on your feet, so the 3 seconds are 3
    // seconds of fighting — time spent flat on the canvas doesn't bank healing
    if (this.state === 'fight') this.sinceHit += dt;
    this.regen = this.state === 'fight' && !this.sleep && this.sinceHit >= 3 && this.hp < this.maxHp;
    if (this.regen) this.hp = Math.min(this.maxHp, this.hp + 20 * dt);   // flat: steroids never speed up healing

    switch (this.state) {
      case 'carried':
      case 'ragdoll': this.updateRagdoll(dt); return;
      case 'getup': this.updateGetup(dt); return;
    }

    // ---------- scripted specials ----------
    if (this.slam) {
      const s = this.slam;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      if (k < 0.18) {
        // crouch, then explode upward
        this.pos.y = groundYAt(this.pos.x, this.pos.z);
      } else {
        const f = (k - 0.18) / 0.82;               // 0..1 through the arc
        if (f < 0.72 && s.trackFn) s.to.copy(s.trackFn()); // auto-aim mid-flight
        this.pos.x = s.from.x + (s.to.x - s.from.x) * f;
        this.pos.z = s.from.z + (s.to.z - s.from.z) * f;
        this.pos.y = groundYAt(this.pos.x, this.pos.z) + Math.sin(f * Math.PI) * s.height;
        this.yaw = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z);
      }
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      // tuck up on the way, stomp down on the way in
      const rise = k < 0.6;
      const LS = dampFactor(14, dt);
      const setR = (o, x = 0, y = 0, z = 0) => {
        o.rotation.x += (x - o.rotation.x) * LS;
        o.rotation.y += (y - o.rotation.y) * LS;
        o.rotation.z += (z - o.rotation.z) * LS;
      };
      setR(P.torso, rise ? -0.35 : 0.55, 0, 0);
      setR(P.armL.shoulder, -2.7, 0, 0.4); setR(P.armR.shoulder, -2.7, 0, -0.4);
      setR(P.armL.elbow, -0.3); setR(P.armR.elbow, -0.3);
      setR(P.legL.hip, rise ? -0.9 : 0.5); setR(P.legR.hip, rise ? -0.75 : 0.5);
      setR(P.legL.knee, rise ? 1.5 : 0.15); setR(P.legR.knee, rise ? 1.4 : 0.15);
      setR(P.neck, rise ? -0.3 : 0.2);
      if (k >= 1) {
        this.pos.y = groundYAt(this.pos.x, this.pos.z);
        this.slam = null;
        if (this.onSlamLand) this.onSlamLand(this);
      }
      return;
    }

    if (this.roll) {
      const r = this.roll;
      r.time -= dt;
      r.hitCd -= dt;
      r.phaseT -= dt;
      if (r.recoil > 0) r.recoil -= dt;
      if (r.phaseT <= 0) {
        r.phase = r.phase === 'charge' ? 'back' : 'charge';
        r.phaseT = r.phase === 'charge' ? 1.35 : 0.55;
      }
      const tp = r.targetFn ? r.targetFn() : this.pos;
      _v1.subVectors(tp, this.pos); _v1.y = 0;
      const d = _v1.length();
      if (d > 0.01) _v1.normalize(); else _v1.set(0, 0, 1);
      const lim = RING.half - 0.2;
      if (r.steer && !r.upright) {
        // A runaway barrel: no brakes and no WASD. It rolls wherever you're
        // looking, and you steer with the camera alone.
        _v3.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        // bounce off whoever you just flattened — the AI barrel does the same
        this.pos.addScaledVector(_v3, (r.recoil > 0 ? -4.4 : 7.6) * dt);
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
        r.lookSteered = true;
      } else if (r.steer) {
        // the Hound's upright whirl stays on WASD — you drive it on foot
        _v3.copy(this.moveInput); _v3.y = 0;
        if (_v3.lengthSq() > 1e-6) {
          _v3.normalize();
          this.pos.addScaledVector(_v3, 6.4 * dt);
        }
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
      } else if (r.upright) {
        // Circles the target at striking distance instead of running through
        // them — close enough to clip you, never standing on top of you.
        const radius = 1.4;
        const rel = _v2.subVectors(this.pos, tp); rel.y = 0;
        if (r.orbitAngle == null) {
          r.orbitAngle = rel.lengthSq() > 1e-6 ? Math.atan2(rel.x, rel.z) : Math.random() * Math.PI * 2;
        }
        const orbitSpeed = 5.6;
        r.orbitAngle += r.spinDir * (orbitSpeed / radius) * dt;
        const wantX = tp.x + Math.sin(r.orbitAngle) * radius;
        const wantZ = tp.z + Math.cos(r.orbitAngle) * radius;
        _v3.set(wantX - this.pos.x, 0, wantZ - this.pos.z);
        const gap = _v3.length();
        if (gap > 1e-5) {
          this.pos.addScaledVector(_v3.divideScalar(gap), Math.min(gap, orbitSpeed * 1.7 * dt));
        }
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
      } else {
        const sign = r.phase === 'charge' ? 1 : -1;
        const speed = r.phase === 'charge' ? 7.6 : 4.4;
        this.pos.addScaledVector(_v1, sign * speed * dt);
        // bounce off the ropes instead of rolling out of the ring
        if (Math.abs(this.pos.x) > lim) { this.pos.x = Math.sign(this.pos.x) * lim; r.phase = 'charge'; r.phaseT = 1.35; }
        if (Math.abs(this.pos.z) > lim) { this.pos.z = Math.sign(this.pos.z) * lim; r.phase = 'charge'; r.phaseT = 1.35; }
      }
      this.pos.y = groundYAt(this.pos.x, this.pos.z);
      if (!r.lookSteered) this.yaw = Math.atan2(_v1.x, _v1.z);

      // spin: Honk tumbles like a wheel, the Hound whirls upright
      r.angle += dt * (r.phase === 'charge' ? 15 : 9);
      const ballY = r.upright ? 0 : RIG.hipY * this.scale * 0.92;
      this.root.position.set(this.pos.x, this.pos.y + ballY, this.pos.z);
      if (r.upright) this.root.rotation.set(0, r.angle, 0);
      else this.root.rotation.set(r.angle, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      P.torso.position.y = RIG.hipY - ballY / this.scale;
      const LR = dampFactor(16, dt);
      if (r.upright) {
        // arms flung wide like a helicopter
        const LU = dampFactor(14, dt);
        const arm = (o, x, z) => {
          o.rotation.x += (x - o.rotation.x) * LU;
          o.rotation.z += (z - o.rotation.z) * LU;
          o.rotation.y += (0 - o.rotation.y) * LU;
        };
        arm(P.armL.shoulder, -1.5, 1.5); arm(P.armR.shoulder, -1.5, -1.5);
        arm(P.armL.elbow, -0.1, 0); arm(P.armR.elbow, -0.1, 0);
        arm(P.torso, 0, 0); arm(P.neck, 0, 0);
        arm(P.legL.hip, 0.1, 0); arm(P.legR.hip, -0.1, 0);
        arm(P.legL.knee, 0.15, 0); arm(P.legR.knee, 0.15, 0);
        if (r.hitCd <= 0 && d < 1.6 + this.scale * 0.4 && this.onRollHit) {
          r.hitCd = 0.8;
          this.onRollHit(this);
        }
        if (r.time <= 0) this.endRoll();
        return;
      }
      const tuck = (o, x = 0, y = 0, z = 0) => {
        o.rotation.x += (x - o.rotation.x) * LR;
        o.rotation.y += (y - o.rotation.y) * LR;
        o.rotation.z += (z - o.rotation.z) * LR;
      };
      tuck(P.torso, 0.9, 0, 0);
      tuck(P.armL.shoulder, -0.4, 0, 1.15); tuck(P.armR.shoulder, -0.4, 0, -1.15);
      tuck(P.armL.elbow, -2.5); tuck(P.armR.elbow, -2.5);
      tuck(P.legL.hip, 2.0); tuck(P.legR.hip, 2.0);
      tuck(P.legL.knee, 1.9); tuck(P.legR.knee, 1.9);
      tuck(P.neck, 0.7);
      if (r.hitCd <= 0 && d < 1.5 + this.scale * 0.4 && this.onRollHit) {
        r.hitCd = 0.9;
        r.phase = 'back'; r.phaseT = 0.55;
        r.recoil = 0.55;
        this.onRollHit(this);
      }
      if (r.time <= 0) this.endRoll();
      return;
    }

    if (this.wall) {
      // planted behind a high guard: soaks punches, then swings back
      const w = this.wall;
      w.time -= dt;
      // YOUR wall is yours to aim — the arms follow the camera, not the enemy.
      // Brick's AI still squares up automatically.
      const tp = w.targetFn ? w.targetFn() : null;
      if (tp && !this.isPlayer) {
        _v1.subVectors(tp, this.pos); _v1.y = 0;
        if (_v1.lengthSq() > 0.01) this.yaw = Math.atan2(_v1.x, _v1.z);
      }
      this.pos.y = groundYAt(this.pos.x, this.pos.z);
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      const LW = dampFactor(14, dt);
      const setW = (o, x = 0, y = 0, z = 0) => {
        o.rotation.x += (x - o.rotation.x) * LW;
        o.rotation.y += (y - o.rotation.y) * LW;
        o.rotation.z += (z - o.rotation.z) * LW;
      };
      const brace = Math.min(1, w.stored / 90);
      setW(P.torso, 0.3 + brace * 0.1, 0, 0);
      // forearms crossed in front of the face
      setW(P.armL.shoulder, -1.65, 0, 0.75);
      setW(P.armR.shoulder, -1.65, 0, -0.75);
      setW(P.armL.elbow, -1.5); setW(P.armR.elbow, -1.5);
      setW(P.legL.hip, 0.28); setW(P.legR.hip, -0.28);
      setW(P.legL.knee, 0.4); setW(P.legR.knee, 0.4);
      setW(P.neck, -0.25);
      if (w.time <= 0) {
        this.wall = null;
        this.busy = 0.45;
        if (this.onWallRelease) this.onWallRelease(this, w.stored);
      }
      return;
    }

    if (this.charge) {
      const ch = this.charge;
      ch.t += dt;
      if (ch.phase === 'windup') {
        // paw the canvas, head down — your window to step aside
        const LC = dampFactor(12, dt);
        P.torso.rotation.x += (0.55 - P.torso.rotation.x) * LC;
        P.neck.rotation.x += (0.4 - P.neck.rotation.x) * LC;
        P.armL.shoulder.rotation.x += (-0.7 - P.armL.shoulder.rotation.x) * LC;
        P.armR.shoulder.rotation.x += (-0.7 - P.armR.shoulder.rotation.x) * LC;
        // He commits to the line the moment he plants — he does NOT track you
        // through the paw. That is what makes the telegraph mean something:
        // step off this line during the windup and the rush goes past you.
        this.yaw = Math.atan2(ch.dir.x, ch.dir.z);
        this.root.rotation.set(0, this.yaw, 0);
        this.root.quaternion.setFromEuler(this.root.rotation);
        if (ch.t >= (ch.windup != null ? ch.windup : 0.55)) {
          ch.phase = 'run';
          ch.t = 0;
        }
        return;
      }
      // full tilt in a straight line until the ropes or a body stop him
      this.pos.addScaledVector(ch.dir, (ch.speed || 15) * dt);
      this.pos.y = groundYAt(this.pos.x, this.pos.z);
      const lim = RING.half - 0.15;
      let hitRopes = false;
      if (Math.abs(this.pos.x) > lim) { this.pos.x = Math.sign(this.pos.x) * lim; hitRopes = true; }
      if (Math.abs(this.pos.z) > lim) { this.pos.z = Math.sign(this.pos.z) * lim; hitRopes = true; }
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      this.walkPhase += dt * 22;
      const LC = dampFactor(18, dt);
      P.torso.rotation.x += (0.62 - P.torso.rotation.x) * LC;
      P.neck.rotation.x += (0.45 - P.neck.rotation.x) * LC;
      P.armL.shoulder.rotation.x += (-0.35 - P.armL.shoulder.rotation.x) * LC;
      P.armR.shoulder.rotation.x += (-0.35 - P.armR.shoulder.rotation.x) * LC;
      P.legL.hip.rotation.x = Math.sin(this.walkPhase) * 0.9;
      P.legR.hip.rotation.x = -Math.sin(this.walkPhase) * 0.9;
      if (!ch.hit && this.onChargeHit && this.onChargeHit(this)) {
        ch.hit = true;
        this.charge = null;
        this.busy = 0.5;
        return;
      }
      if (hitRopes || ch.t > 2.2) {
        this.charge = null;
        this.stun = Math.max(this.stun, hitRopes ? (ch.recoil != null ? ch.recoil : 1.1) : 0.4);  // whiffed
        if (hitRopes && this.onChargeMiss) this.onChargeMiss(this);
      }
      return;
    }

    if (this.ricochet) {
      // PRESTO — hurls himself at the nearest ropes and pinballs off them
      const rc = this.ricochet;
      rc.t += dt;
      if (rc.hitCd > 0) rc.hitCd -= dt;
      if (rc.bounceCd > 0) rc.bounceCd -= dt;
      if (rc.phase === 'windup') {
        // coil down, aimed at the ropes he's about to abuse
        const LC = dampFactor(16, dt);
        P.torso.rotation.x += (0.5 - P.torso.rotation.x) * LC;
        P.neck.rotation.x += (0.3 - P.neck.rotation.x) * LC;
        P.armL.shoulder.rotation.x += (0.9 - P.armL.shoulder.rotation.x) * LC;
        P.armR.shoulder.rotation.x += (0.9 - P.armR.shoulder.rotation.x) * LC;
        this.yaw = Math.atan2(rc.dir.x, rc.dir.z);
        this.root.rotation.set(0, this.yaw, 0);
        this.root.quaternion.setFromEuler(this.root.rotation);
        if (rc.t >= 0.28) { rc.phase = 'run'; rc.t = 0; }
        return;
      }
      this.pos.addScaledVector(rc.dir, rc.speed * dt);
      this.pos.y = groundYAt(this.pos.x, this.pos.z);
      const rlim = RING.half - 0.15;
      let nx = false, nz = false;
      if (Math.abs(this.pos.x) > rlim) { this.pos.x = Math.sign(this.pos.x) * rlim; nx = true; }
      if (Math.abs(this.pos.z) > rlim) { this.pos.z = Math.sign(this.pos.z) * rlim; nz = true; }
      if ((nx || nz) && rc.bounceCd <= 0 && rc.finish < 0) {
        rc.bounceCd = 0.12;
        rc.bounces++;
        // reflect off the ropes, then lean the rebound at whoever he's chasing
        if (nx) rc.dir.x = -rc.dir.x;
        if (nz) rc.dir.z = -rc.dir.z;
        const tp = rc.targetFn();
        _v1.subVectors(tp, this.pos); _v1.y = 0;
        if (_v1.lengthSq() > 0.04) rc.dir.lerp(_v1.normalize(), 0.4);
        // never let a rebound hug the ropes he just left
        if (nx) rc.dir.x = -Math.sign(this.pos.x) * Math.max(0.42, Math.abs(rc.dir.x));
        if (nz) rc.dir.z = -Math.sign(this.pos.z) * Math.max(0.42, Math.abs(rc.dir.z));
        rc.dir.y = 0;
        if (rc.dir.lengthSq() < 0.0001) rc.dir.set(0, 0, 1);
        rc.dir.normalize();
        rc.speed *= 1.08;
        if (this.onRicochetBounce) this.onRicochetBounce(this, rc.bounces);
        if (rc.bounces >= 5) rc.finish = 0.4;   // one last screamer, then he's spent
      }
      this.yaw = Math.atan2(rc.dir.x, rc.dir.z);
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      this.walkPhase += dt * 30;
      const LC = dampFactor(20, dt);
      P.torso.rotation.x += (0.5 - P.torso.rotation.x) * LC;
      P.neck.rotation.x += (0.2 - P.neck.rotation.x) * LC;
      P.armL.shoulder.rotation.x += (1.5 - P.armL.shoulder.rotation.x) * LC;   // arms streaming behind
      P.armR.shoulder.rotation.x += (1.5 - P.armR.shoulder.rotation.x) * LC;
      P.legL.hip.rotation.x = Math.sin(this.walkPhase) * 1.15;
      P.legR.hip.rotation.x = -Math.sin(this.walkPhase) * 1.15;
      if (rc.hitCd <= 0 && this.onRicochetHit) this.onRicochetHit(this);
      if (rc.finish >= 0) {
        rc.finish -= dt;
        if (rc.finish <= 0) {
          this.ricochet = null;
          this.stun = Math.max(this.stun, 0.7);   // dizzy from all that bouncing
        }
      } else if (rc.t > 8) {
        this.ricochet = null;
        this.stun = Math.max(this.stun, 0.5);
      }
      return;
    }

    if (this.sleep) {
      // Flat on his back, snoring health back. No guard, no super armour — the
      // whole point is that you get to tee off on him.
      const s = this.sleep;
      this.hp = Math.min(this.maxHp, this.hp + s.healRate * dt);
      if (s.hitCd > 0) s.hitCd -= dt;
      this.vel.set(0, 0, 0);   // the nap owns his movement, not stored knockback

      // He does not lie still. He drifts — and not only along the floor: a
      // sleeping Slumberjack will happily set off straight upward and sail
      // over the ring like a log with a bedtime.
      s.turn -= dt;
      if (s.turn <= 0) {
        s.turn = 0.45 + Math.random() * 0.75;
        const pick = (Math.random() * 6) | 0;           // 4 compass points + up + down
        const DIRS = [[1,0,0], [-1,0,0], [0,0,1], [0,0,-1], [0,1,0], [0,-1,0]];
        const d = DIRS[pick];
        s.drift.set(d[0], d[1], d[2]).multiplyScalar(2.6 + Math.random() * 1.6);
        // ...with a nose for where you are. Mostly random, but he does lean
        // your way, so you can't just stand in a corner and wait him out.
        const tp = s.targetFn && s.targetFn();
        if (tp) {
          _v3.subVectors(tp, this.pos);
          if (_v3.lengthSq() > 0.04) s.drift.addScaledVector(_v3.normalize(), 1.5);
        }
      }
      // a sleeping man does not hover: he always sags back toward the canvas
      s.drift.y -= 2.4 * dt;
      if (s.freeT > 0) {
        // SMACKED: the strings are cut for a moment and he is a pure ragdoll,
        // whipping end over end. His position follows the body, not the drift.
        s.freeT -= dt;
        if (s.freeT <= 0) {
          for (const pt of this.ragdoll.pts) pt.pin = null;
          s.repin = true;
        }
      } else if (s.shoveT > 0) {
        s.shoveT -= dt;
        this.pos.addScaledVector(s.shove, dt);
        s.shove.multiplyScalar(Math.exp(-2.2 * dt));
        s.turn = 0.2;
      } else {
        this.pos.addScaledVector(s.drift, dt);
      }
      // the ropes and the lighting rig bound him whichever vector is driving
      const floor = groundYAt(this.pos.x, this.pos.z);
      const slim = RING.half - 0.2;
      const bounce = (ax, sign) => { s.drift[ax] = -sign * Math.abs(s.drift[ax]);
                                     s.shove[ax] = -sign * Math.abs(s.shove[ax]) * 0.6; };
      if (Math.abs(this.pos.x) > slim) {
        const sg = Math.sign(this.pos.x); this.pos.x = sg * slim; bounce('x', sg);
      }
      if (Math.abs(this.pos.z) > slim) {
        const sg = Math.sign(this.pos.z); this.pos.z = sg * slim; bounce('z', sg);
      }
      // he settles on the mat rather than bouncing off it — that's what kept
      // him permanently airborne before
      if (this.pos.y < floor) { this.pos.y = floor; s.drift.y = 0; s.shove.y = Math.max(0, s.shove.y); }
      if (this.pos.y > floor + 3.2) { this.pos.y = floor + 3.2; bounce('y', 1); }

      // anyone he drifts into gets a faceful of sleeping lumberjack
      if (s.hitCd <= 0 && this.onSleepBump) {
        if (this.onSleepBump(this)) s.hitCd = 0.8;
      }

      // REAL ragdoll physics while he sleeps: the hips are pinned to wherever
      // he has drifted to, and the rest of him hangs off them and flails. He
      // stays in state 'fight' throughout, so none of the ring-out, get-up or
      // grab logic treats him as a downed body.
      if (!s.seeded) {
        this.ragdoll.seed(this.root, this.scale,
          new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 0, 0));
        s.seeded = true;
        s.pinL = new THREE.Vector3();
        s.pinR = new THREE.Vector3();
        s.pinCL = new THREE.Vector3();
        s.pinCR = new THREE.Vector3();
        s.keep = new THREE.Vector3();
        // Pin the TRUNK (hips + shoulders) so he holds together, and let the
        // head, arms and legs hang off it and flail. Pinning the hips alone
        // let the torso outrun the constraint solver and he came apart.
        this.ragdoll.pts[3].pin = s.pinR;
        this.ragdoll.pts[4].pin = s.pinL;
        this.ragdoll.pts[1].pin = s.pinCR;
        this.ragdoll.pts[2].pin = s.pinCL;
      }
      if (s.freeT > 0) {
        // no pins at all while he's whipping
        for (const pt of this.ragdoll.pts) pt.pin = null;
        this.updateRagdoll(dt);
        // The smack throws him higher than the ropes can catch, so hold the
        // BODY in — clamping only this.pos let him fly out and snap back.
        // Scoped to this window, so there's no flag left set afterwards.
        const rin = RING.postHalf - 0.15;
        for (const pt of this.ragdoll.pts) {
          for (const ax of ['x', 'z']) {
            if (Math.abs(pt.p[ax]) > rin) {
              const sg = Math.sign(pt.p[ax]);
              const v = pt.p[ax] - pt.o[ax];
              pt.p[ax] = sg * rin;
              pt.o[ax] = pt.p[ax] + v * 0.7;   // springy: he bounces off the ropes
            }
          }
        }
        const c = this.ragdoll.center();
        this.pos.set(c.x, Math.max(groundYAt(c.x, c.z), c.y - RIG.hipY * this.scale), c.z);
        return;
      }
      if (s.repin) {
        // re-pin exactly where the body ended up, so nothing snaps
        s.repin = false;
        this.ragdoll.pts[3].pin = s.pinR; this.ragdoll.pts[4].pin = s.pinL;
        this.ragdoll.pts[1].pin = s.pinCR; this.ragdoll.pts[2].pin = s.pinCL;
      }
      // lying on his back: the trunk runs horizontally, head-end forward
      const sc = this.scale;
      const lean = Math.sin(s.left * 0.8) * 0.25;          // slow lazy roll
      const cy = Math.cos(lean), sy = Math.sin(lean);
      const baseY = this.pos.y + 0.34 * sc;
      const hx = RIG.hipX * sc;
      const trunk = (RIG.chestY - RIG.hipY) * sc;          // hips -> shoulders
      s.pinR.set(this.pos.x + hx * cy, baseY, this.pos.z + hx * sy);
      s.pinL.set(this.pos.x - hx * cy, baseY, this.pos.z - hx * sy);
      s.pinCR.set(this.pos.x + hx * cy, baseY + 0.06 * sc, this.pos.z + hx * sy + trunk);
      s.pinCL.set(this.pos.x - hx * cy, baseY + 0.06 * sc, this.pos.z - hx * sy + trunk);
      // updateRagdoll writes this.pos from the ragdoll root — which would feed
      // straight back into the pins next frame and send him climbing. The
      // drift is the authority here, so put it back afterwards.
      // NOTE: not _v1 — updateRagdoll uses the shared temps internally.
      s.keep.copy(this.pos);
      this.updateRagdoll(dt);
      this.pos.copy(s.keep);
      return;
    }

    if (this.feast) {
      // chomp first, then the sugar rush (handled as buffs below)
      const f = this.feast;
      f.time -= dt;
      if (f.eating > 0) {
        f.eating -= dt;
        this.pos.y = groundYAt(this.pos.x, this.pos.z);
        this.root.position.copy(this.pos);
        this.root.rotation.set(0, this.yaw, 0);
        this.root.quaternion.setFromEuler(this.root.rotation);
        const LF = dampFactor(15, dt);
        const chomp = Math.sin(f.eating * 26) * 0.12;
        P.torso.rotation.x += (0.12 - P.torso.rotation.x) * LF;
        P.neck.rotation.x += (0.25 + chomp - P.neck.rotation.x) * LF;
        // His gut sticks out further than his mouth does, so a burger held AT
        // the mouth is hidden behind his own belly head-on. He holds it up
        // beside his head instead — clear of the silhouette — and leans into it.
        P.armR.shoulder.rotation.x += (-0.48 - P.armR.shoulder.rotation.x) * LF;
        P.armR.shoulder.rotation.y += (0 - P.armR.shoulder.rotation.y) * LF;
        P.armR.shoulder.rotation.z += (1.92 - P.armR.shoulder.rotation.z) * LF;
        P.armR.elbow.rotation.x += (-2.0 - P.armR.elbow.rotation.x) * LF;
        P.neck.rotation.z += (-0.28 - chomp * 1.4 - P.neck.rotation.z) * LF;   // bite, bite, bite
        P.armL.shoulder.rotation.x += (-0.9 - P.armL.shoulder.rotation.x) * LF;
        if (P.burger) P.burger.visible = true;
        if (f.eating <= 0 && this.onFeastStart) this.onFeastStart(this);
        return;
      }
      if (P.burger) P.burger.visible = false;
      // the burger itself: 300 health over the 3 second boost
      const total = this.feastHeal;   // steroids don't boost the burger
      const heal = Math.min(total - f.healed, (total / 3) * dt);   // spread over the 3s boost
      if (heal > 0) {
        f.healed += heal;
        this.hp = Math.min(this.maxHp, this.hp + heal);
      }
      if (f.time <= 0) this.feast = null;
    } else if (P.burger) {
      P.burger.visible = false;
    }

    if (this.quake) {
      const q = this.quake;
      q.t += dt;
      this.pos.y = groundYAt(this.pos.x, this.pos.z);
      this.root.position.copy(this.pos);
      this.root.rotation.set(0, this.yaw, 0);
      this.root.quaternion.setFromEuler(this.root.rotation);
      const LQ = dampFactor(18, dt);
      const rise = q.t < q.windup;
      const setQ = (o, x = 0, y = 0, z = 0) => {
        o.rotation.x += (x - o.rotation.x) * LQ;
        o.rotation.y += (y - o.rotation.y) * LQ;
        o.rotation.z += (z - o.rotation.z) * LQ;
      };
      setQ(P.torso, rise ? -0.5 : 0.85);
      setQ(P.armL.shoulder, rise ? -3.0 : -0.15, 0, 0.35);
      setQ(P.armR.shoulder, rise ? -3.0 : -0.15, 0, -0.35);
      setQ(P.armL.elbow, -0.2); setQ(P.armR.elbow, -0.2);
      setQ(P.legL.hip, rise ? -0.1 : 0.5); setQ(P.legR.hip, rise ? -0.1 : 0.5);
      setQ(P.legL.knee, rise ? 0.15 : 0.9); setQ(P.legR.knee, rise ? 0.15 : 0.9);
      setQ(P.neck, rise ? -0.35 : 0.3);
      if (!q.fired && q.t >= q.windup) {
        q.fired = true;
        if (this.onQuake) this.onQuake(this);
      }
      if (q.t >= q.windup + 0.55) this.quake = null;
      return;
    }

    // ---------- standing update ----------
    let mv = _v2.copy(this.moveInput);
    if (!this.canAct && !this.barrage && !this.carrying) mv.multiplyScalar(0);
    if (this.barrage) mv.multiplyScalar(0.25);
    if (this.carrying) mv.multiplyScalar(0.55);

    const surge = (this.shield > 0 ? 2 : 1) * (this.feast && this.feast.eating <= 0 ? 2 : 1)
      * (this.rage ? 1.7 : 1);
    this.pos.addScaledVector(mv, dt * surge);   // Rising Tide / Burger Break
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.exp(-6 * dt));

    // stay in the ring while standing (ropes hold you in)
    // The ropes only hold you in while you're actually inside them. Testing
    // against the apron used to teleport a boxer standing outside the ropes
    // back into the middle of the ring instead of ruling them out.
    const inRing = Math.abs(this.pos.x) <= RING.postHalf && Math.abs(this.pos.z) <= RING.postHalf;
    if (inRing) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -RING.half, RING.half);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -RING.half, RING.half);
    } else {
      const bar = ARENA.barrier - 0.35;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -bar, bar);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -bar, bar);
    }
    const gy = groundYAt(this.pos.x, this.pos.z);
    if (this.jumpVel !== 0) {
      this.jumpVel -= 19 * dt;
      this.pos.y += this.jumpVel * dt;
      if (this.jumpVel < 0 && this.pos.y <= gy) { this.pos.y = gy; this.jumpVel = 0; }
    } else {
      this.pos.y += (gy - this.pos.y) * dampFactor(12, dt);
    }

    // gentle body collision vs opponent
    if (opponent && !opponent.isRagdolled && opponent.state === 'fight') {
      _v1.subVectors(this.pos, opponent.pos); _v1.y = 0;
      const d = _v1.length();
      if (d < 0.8 && d > 0.0001) {
        this.pos.addScaledVector(_v1.normalize(), (0.8 - d) * 0.5);
      }
    }

    this.root.position.copy(this.pos);
    if (this.isPlayer) {
      // first person: the body tracks the camera instantly so the gloves
      // never lag behind or sweep across the view
      this.root.rotation.y = this.yaw;
    } else {
      let dy = this.yaw - this.root.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.root.rotation.y += dy * dampFactor(14, dt);
    }
    this.root.rotation.x = 0; this.root.rotation.z = 0;
    this.root.quaternion.setFromEuler(this.root.rotation);

    // ---------- procedural animation ----------
    const speed = mv.length();
    this.walkPhase += dt * (4 + speed * 2.6);
    const wp = this.walkPhase;
    const moving = speed > 0.3;

    const L = dampFactor(this.state === 'fight' ? (this.isPlayer ? 26 : 16) : 8, dt);
    const lerpRot = (obj, x, y, z) => {
      obj.rotation.x += (x - obj.rotation.x) * L;
      obj.rotation.y += (y - obj.rotation.y) * L;
      obj.rotation.z += (z - obj.rotation.z) * L;
    };

    // legs (tucked while airborne)
    const airborne = this.jumpVel !== 0;
    const legSwing = moving ? Math.sin(wp) * 0.55 : 0;
    const idleBend = moving ? 0 : 0.06;
    lerpRot(P.legL.hip, airborne ? -0.55 : legSwing + idleBend, 0, 0.02);
    lerpRot(P.legR.hip, airborne ? -0.4 : -legSwing + idleBend, 0, -0.02);
    lerpRot(P.legL.knee, airborne ? 1.0 : (moving ? Math.max(0, -Math.sin(wp)) * 0.9 + 0.1 : 0.12), 0, 0);
    lerpRot(P.legR.knee, airborne ? 0.85 : (moving ? Math.max(0, Math.sin(wp)) * 0.9 + 0.1 : 0.12), 0, 0);

    // torso: bob + slight boxing sway + flinch
    const bob = moving ? Math.abs(Math.sin(wp)) * 0.05 : Math.sin(t * 2.2) * 0.02;
    P.torso.position.y = RIG.hipY + bob;
    let torsoTwist = Math.sin(t * 1.8) * 0.05 + this.flinch * this.flinchSide * 0.55;
    let torsoLean = 0.08 + this.flinch * -0.95;
    if (this.victoryT > 0) { torsoLean = -0.15; torsoTwist = Math.sin(t * 6) * 0.12; }

    // suplex windup pose (lean back hard)
    if (this.suplexAnim > 0) {
      this.suplexAnim -= dt;
      torsoLean = -1.15;
    }

    // punch animation
    let punchPoseL = null, punchPoseR = null;
    if (this.punchT >= 0) {
      this.punchT += dt * 3.4 * this.punchSpeed * (this.speed / 100);
      if (this.punchT >= 1) this.punchT = -1;
      else {
        const pt2 = this.punchT;
        const ext = pt2 < 0.42 ? (pt2 / 0.42) : 1 - (pt2 - 0.42) / 0.58; // extend then retract
        const e = ext * ext * (3 - 2 * ext);
        const pose = {
          // arm swings from the guard all the way to straight-out front
          shX: -1.05 - e * 0.72, shY: 0, shZ: 0.42 - e * 0.46,
          elX: -1.7 + e * 1.7,
          // cartoon reach: the whole arm extends as the punch lands
          stretch: 1 + e * 0.42
        };
        torsoTwist += (this.punchArm === 'R' ? 1 : -1) * e * 0.5;
        torsoLean += e * 0.16;
        if (this.punchArm === 'R') punchPoseR = pose; else punchPoseL = pose;
      }
    }
    lerpRot(P.torso, torsoLean, torsoTwist, 0);

    // arms: guard or punching or carrying
    const guard = { shX: -0.95, shZOut: 0.5, elX: -1.85 };
    const applyArm = (arm, side, pose) => { // side: +1 L, -1 R
      if (this.carrying) {
        lerpRot(arm.shoulder, -2.9, 0, side * 0.25);
        lerpRot(arm.elbow, -0.25, 0, 0);
      } else if (pose) {
        arm.shoulder.rotation.set(pose.shX, pose.shY, side * pose.shZ);
        arm.elbow.rotation.set(pose.elX, 0, 0);
        arm.shoulder.scale.y = pose.stretch;
        arm.glove.scale.y = 1.12 / pose.stretch; // keep the glove round
        return;
      } else if (this.displayPose) {
        // lat spread — shows off the physique instead of hiding it behind gloves
        const breathe = Math.sin(t * 1.7 + side) * 0.04;
        lerpRot(arm.shoulder, -0.42 + breathe, side * -0.15, side * (1.02 + breathe));
        lerpRot(arm.elbow, -0.72, 0, 0);
      } else if (this.victoryT > 0) {
        lerpRot(arm.shoulder, -2.9 + Math.sin(t * 6 + side) * 0.2, 0, side * 0.5);
        lerpRot(arm.elbow, -0.4, 0, 0);

      } else if (this.flinch > 0.3 && !this.isPlayer) {
        // arms fly open when rocked by a punch
        lerpRot(arm.shoulder, -0.25 - this.flinch * 0.4, 0, side * (0.9 + this.flinch * 0.5));
        lerpRot(arm.elbow, -0.45, 0, 0);
      } else {
        const sway = Math.sin(t * 2.6 + side * 2) * 0.06;
        lerpRot(arm.shoulder, guard.shX + sway, side * -0.3, side * guard.shZOut);
        lerpRot(arm.elbow, guard.elX, 0, 0);
      }
    };
    const relax = (arm) => {
      arm.shoulder.scale.y += (1 - arm.shoulder.scale.y) * L;
      arm.glove.scale.y += (1.12 - arm.glove.scale.y) * L;
    };
    applyArm(P.armL, 1, punchPoseL);
    applyArm(P.armR, -1, punchPoseR);
    if (!punchPoseL) relax(P.armL);
    if (!punchPoseR) relax(P.armR);

    // head: look forward, snap back hard when hit
    lerpRot(P.neck, -0.06 - torsoLean * 0.6 + this.flinch * -0.85, torsoTwist * -0.6, this.flinch * this.flinchSide * 0.3);

    if (this.victoryT > 0) this.victoryT -= 0; // stays in victory pose
  }

  // ---------------------------------------------------------
  updateRagdoll(dt) {
    const rd = this.ragdoll;

    // carried: pins are driven by the carrier (set externally)
    const res = rd.step(dt);

    // pose the rig from ragdoll points
    const pts = rd.pts;
    _v1.addVectors(pts[1].p, pts[2].p).multiplyScalar(0.5);           // chest
    const pelvis = _v2.addVectors(pts[3].p, pts[4].p).multiplyScalar(0.5);

    const ey = _v3.subVectors(_v1, pelvis).normalize();               // up
    const exv = new THREE.Vector3().subVectors(pts[1].p, pts[2].p);
    exv.addScaledVector(ey, -exv.dot(ey)).normalize();                // side (L)
    const ez = new THREE.Vector3().crossVectors(exv, ey).normalize(); // forward
    _m1.makeBasis(exv, ey, ez);
    this.root.quaternion.setFromRotationMatrix(_m1);
    this.root.rotation.setFromQuaternion(this.root.quaternion);

    const rootPos = pelvis.clone().addScaledVector(ey, -RIG.hipY * this.scale);
    this.root.position.copy(rootPos);
    this.pos.copy(rootPos);

    const P = this.parts;
    P.torso.position.y = RIG.hipY;
    P.torso.rotation.set(0, 0, 0);

    const invQ = _q1.copy(this.root.quaternion).invert();
    const chestW = _v1.clone();

    // head
    const headDir = new THREE.Vector3().subVectors(pts[0].p, chestW).applyQuaternion(invQ).normalize();
    P.neck.quaternion.setFromUnitVectors(UP, headDir);
    P.neck.rotation.setFromQuaternion(P.neck.quaternion);

    // limbs: aim shoulder/hip pivots at hand/foot points
    const aimLimb = (pivot, elbowOrKnee, fromPt, toPt, bend) => {
      const dir = new THREE.Vector3().subVectors(toPt.p, fromPt.p).applyQuaternion(invQ).normalize();
      pivot.quaternion.setFromUnitVectors(DOWN, dir);
      pivot.rotation.setFromQuaternion(pivot.quaternion);
      elbowOrKnee.rotation.set(bend, 0, 0);
    };
    aimLimb(P.armL.shoulder, P.armL.elbow, pts[1], pts[5], -0.5);
    aimLimb(P.armR.shoulder, P.armR.elbow, pts[2], pts[6], -0.5);
    aimLimb(P.legL.hip, P.legL.knee, pts[3], pts[7], 0.55);
    aimLimb(P.legR.hip, P.legR.knee, pts[4], pts[8], 0.55);

    // KO countdown runs even while flying/carried
    if (this.koTimer > 0) {
      this.koTimer -= dt;
      if (this.koTimer <= 0 && !this.eliminated) {
        // still flying through the air? wait for touchdown before recovering
        if (!this.carriedBy) {
          const c = this.ragdoll.center();
          if (c.y > groundYAt(c.x, c.z) + 0.6) { this.koTimer = 0.05; return; }
        }
        // Still past the ropes? Never stand up out there — hold the count and
        // let checkRingOut finish the job once the body settles.
        if (!this.carriedBy) {
          const cc = this.ragdoll.center();
          if (Math.abs(cc.x) > RING.postHalf || Math.abs(cc.z) > RING.postHalf) {
            this.koTimer = 0.05; return;
          }
        }
        this.koTimer = 0;
        if (this.carriedBy) {
          // wake up mid-carry: break free!
          const carrier = this.carriedBy;
          carrier.dropCarried();
          carrier.vel.add(new THREE.Vector3().subVectors(carrier.pos, this.pos).setY(0).normalize().multiplyScalar(4));
          this.ragdoll.addImpulse(new THREE.Vector3(0, 3, 0));
          this.hp = Math.round(this.maxHp * 0.40); this.sinceHit = 0;   // flat 40%, and the regen clock restarts
          this.tryGetUp();
          return;
        }
        this.hp = Math.round(this.maxHp * 0.40); this.sinceHit = 0;   // flat 40%, and the regen clock restarts
        this.tryGetUp();
        return;
      }
    } else if (this.state === 'ragdoll' && rd.landed && rd.airTime >= 0 && this.busy <= 0 && !this.eliminated) {
      // non-KO ragdoll (e.g. survived a suplex): get up once settled
      this.getupDelay = (this.getupDelay || 0.5) - dt;
      if (this.getupDelay <= 0) {
        this.getupDelay = 0.5;
        const cc = this.ragdoll.center();
        if (Math.abs(cc.x) > RING.postHalf || Math.abs(cc.z) > RING.postHalf) return;
        this.tryGetUp();
        return;
      }
    }
  }

  // ---------------------------------------------------------
  updateGetup(dt) {
    this.getupT += dt / 0.8;
    const k = Math.min(1, this.getupT);
    const ease = k * k * (3 - 2 * k);

    // rise from ragdoll pose to upright
    const gy = groundYAt(this.pos.x, this.pos.z);
    this.root.position.set(this.pos.x, gy + Math.sin(ease * Math.PI) * -0.0, this.pos.z);
    this.pos.y = gy;

    _q2.setFromEuler(new THREE.Euler(0, this.yaw, 0));
    this.root.quaternion.slerp(_q2, dampFactor(9, dt));

    const P = this.parts;
    const L = dampFactor(10, dt);
    const settle = (obj, x = 0, y = 0, z = 0) => {
      obj.rotation.x += (x - obj.rotation.x) * L;
      obj.rotation.y += (y - obj.rotation.y) * L;
      obj.rotation.z += (z - obj.rotation.z) * L;
    };
    settle(P.torso, ease < 0.5 ? 0.8 * (1 - ease * 2) : 0);
    settle(P.neck); settle(P.armL.shoulder, -0.95, 0, 0.5); settle(P.armR.shoulder, -0.95, 0, -0.5);
    settle(P.armL.elbow, -1.85); settle(P.armR.elbow, -1.85);
    settle(P.legL.hip, ease < 0.6 ? 1.1 * (1 - ease / 0.6) : 0); settle(P.legR.hip);
    settle(P.legL.knee, 0.12); settle(P.legR.knee, 0.12);
    P.torso.position.y += (RIG.hipY - P.torso.position.y) * L;

    if (k >= 1) {
      this.state = 'fight';
      this.root.rotation.setFromQuaternion(this.root.quaternion);
    }
  }

  resetFor(pos, yaw) {
    this.hp = this.maxHp;
    this.koTimer = 0;
    this.eliminated = false;
    this.state = 'fight';
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.root.position.copy(pos);
    this.root.rotation.set(0, yaw, 0);
    this.root.quaternion.setFromEuler(this.root.rotation);
    this.punchT = -1; this.punchCd = 0; this.specialCd = 0;
    this.meter = 0; this.meterHits = 0;   // you start every round with the special empty
    this.barrage = null; this.busy = 0; this.stun = 0; this.flinch = 0;
    this.carrying = null; this.carriedBy = null;
    this.victoryT = 0; this.suplexAnim = 0;
    this.pendingLandDmg = 0; this.thrownBy = null;
    this.sinceHit = 999; this.regen = false;
    this.jumpVel = 0; this.slam = null; this.roll = null;
    this.wall = null; this.charge = null; this.ricochet = null; this.rage = null;
    this.sleep = null; this.shield = 0;
    for (const pt of this.ragdoll.pts) pt.pin = null;   // never start a round strung up
    this.feast = null; this.quake = null; this.rage = false;
    this.setSteel(0);
    this.root.visible = true;
    this.root.rotation.order = 'YXZ';
  }
}
