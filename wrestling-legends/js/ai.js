// ============================================================
// WRESTLING LEGENDS — ai.js
// Opponent brain: footwork, punch timing, specials, and
// grab-and-hurl-you-out-of-the-ring when you're KO'd.
// ============================================================

class AIController {
  constructor(boxer, target, game) {
    this.b = boxer;
    this.t = target;
    this.game = game;

    this.strafeDir = 1;
    this.strafeTimer = 2;
    this.decideTimer = 0;
    this.comboLeft = 0;
    this.comboPause = 0;
    this.dodgeTimer = 0;
    this.dodgeDir = 1;
    this.aggression = 0.65; // amateur: eager but sloppy
    // Bronze plays exactly as it always has (heat 0). Silver and gold press
    // harder: quicker combos, less standing about, less dodging. The AI was
    // only landing ~20% of its theoretical damage, which is why the upper
    // tiers felt like a walk.
    const HEAT = { bronze: 0.3, silver: 0.65, gold: 1 };
    const diff = (window.difficultyHeat && window.difficultyHeat()) || 1;
    this.heat = (HEAT[(window.game && window.game.tournament) || 'bronze'] || 0) * diff;
    this.specialReady = false;
    this.specialDelay = 3 + Math.random() * 4; // won't reach for a special the instant it's up
  }

  update(dt, t) {
    const b = this.b, tgt = this.t, game = this.game;
    b.moveInput.set(0, 0, 0);

    if (b.eliminated || tgt.eliminated) return;
    if (b.state !== 'fight') return;
    // If they go down mid-spin, the win is right there — break off the spin
    // rather than whirling out the clock while the body lies there.
    if (b.roll && (tgt.isKO || tgt.state === 'carried')) b.endRoll();
    if (b.slam || b.roll) return; // scripted special in progress

    const toTgt = new THREE.Vector3().subVectors(tgt.pos, b.pos);
    toTgt.y = 0;
    const dist = toTgt.length();
    const dir = dist > 0.001 ? toTgt.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // always face the fight
    b.yaw = Math.atan2(dir.x, dir.z);

    this.decideTimer -= dt;
    this.strafeTimer -= dt;
    this.dodgeTimer -= dt;
    this.comboPause -= dt;
    // Hold the special for a while AFTER it comes off cooldown, so the AI
    // doesn't fire it the instant it's available every single cycle.
    if (b.specialCd > 0) {
      this.specialReady = false;
    } else if (!this.specialReady) {
      this.specialReady = true;
      this.specialDelay = 2.0 + Math.random() * 4.4;
    }
    this.specialDelay -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.2 + Math.random() * 2.2;
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    }

    // ================= opponent is KO'd: PICK UP AND THROW, ON REPEAT =================
    // No careful carrying — the instant it has you overhead it hurls you toward
    // the nearest ropes from wherever it stands, then sprints after your body
    // and does it again. Near the edge a throw rings you out; mid-ring you just
    // get launched around until the clock saves you.
    if (tgt.isKO || tgt.state === 'carried') {
      if (b.carrying === tgt) {
        // Carries the body to the closest edge first, squares up, then heaves.
        // Much better odds than hurling from wherever it happened to grab you.
        const p = b.pos;
        const out = Math.abs(p.x) > Math.abs(p.z)
          ? new THREE.Vector3(Math.sign(p.x) || 1, 0, 0)
          : new THREE.Vector3(0, 0, Math.sign(p.z) || 1);
        const edge = out.clone().multiplyScalar(RING.half - 0.25);
        if (Math.abs(out.x) > 0) edge.z = THREE.MathUtils.clamp(p.z, -2.5, 2.5);
        else edge.x = THREE.MathUtils.clamp(p.x, -2.5, 2.5);
        const toEdge = new THREE.Vector3().subVectors(edge, p); toEdge.y = 0;
        this.carryTime = (this.carryTime || 0) + dt;

        if (toEdge.length() > 0.45 && this.carryTime < 3.2) {
          b.moveInput.copy(toEdge.normalize()).multiplyScalar(b.moveSpeed);
          b.yaw = Math.atan2(toEdge.x, toEdge.z);
          return;
        }
        // square up on the ropes before letting go
        b.yaw = Math.atan2(out.x, out.z);
        let dyaw = b.yaw - b.root.rotation.y;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        if (Math.abs(dyaw) > 0.3 && this.carryTime < 3.6) return;
        const wild = (Math.random() - 0.5) * 0.3;      // barely any waver now
        const cos = Math.cos(wild), sin = Math.sin(wild);
        const vx = out.x * cos - out.z * sin, vz = out.x * sin + out.z * cos;
        const power = 8.3 + Math.random() * 1.2;
        const vel = new THREE.Vector3(vx * power, 4.2 + Math.random() * 0.6, vz * power);
        this.carryTime = 0;
        game.throwCarried(b, vel);
        return;
      }
      this.carryTime = 0;
      this.holdTimer = null;
      // sprint to the body and scoop it up
      const bodyC = tgt.isRagdolled ? tgt.ragdoll.center().clone() : tgt.pos.clone();
      const toBody = new THREE.Vector3().subVectors(bodyC, b.pos); toBody.y = 0;
      const bd = toBody.length();
      b.yaw = Math.atan2(toBody.x, toBody.z);
      if (bd > 1.15) {
        b.moveInput.copy(toBody.normalize()).multiplyScalar(b.moveSpeed);
      } else if (b.canAct) {
        game.tryGrab(b, tgt);
      }
      return;
    }
    this.holdTimer = null;

    // Prime Hound loses it below 400
    if (b.cfg.rageAt != null && !b.rage && b.hp <= b.maxHp * b.cfg.rageAt && !b.roll) {
      b.rage = true;
      game.doHoundSpin(b, tgt);
      return;
    }

    // hurt and there's money on the canvas? go get it.
    // NOTE: `game` here is the combat API, not the game state — the live coin
    // list lives on the global, so reach for that explicitly.
    const G = window.game;
    if (b.hp < b.maxHp * 0.97 && G.coins && G.coins.length) {
      let best = null, bestD = 1e9;
      for (const c of G.coins) {
        const cd = b.pos.distanceTo(c.home);
        if (cd < bestD) { bestD = cd; best = c; }
      }
      if (best && bestD < 14) {   // anywhere in the arena is worth the walk
        const toCoin = new THREE.Vector3().subVectors(best.home, b.pos); toCoin.y = 0;
        b.moveInput.copy(toCoin.normalize()).multiplyScalar(b.moveSpeed);
        b.yaw = Math.atan2(toCoin.x, toCoin.z);
        if (bestD > 1.0) return;
      }
    }

    // ================= regular fight =================
    const inReach = dist < 1.55 + 0.35 * (b.cfg.bulk || 1) + 0.35 * Math.max(0, 100 - b.speed) / 100;

    // recovering with low HP? play defensive until healthier
    const scared = b.regen && b.hp < b.maxHp * 0.5;

    const sp = b.cfg.special;
    // a charger needs room — back off and paw the canvas before the rush
    const wantsRunUp = sp === 'charge' && b.specialCd <= 0 && this.specialDelay <= 0 && dist < 3.4;

    // reads the fight: press harder when ahead, swing desperate when cornered
    const aggr = THREE.MathUtils.clamp(
      0.6 + 0.12 * this.heat + (b.hp - tgt.hp) / 150 + (b.hp < b.maxHp * 0.3 && !b.regen ? 0.25 : 0),
      0.4, 0.95);

    // slip incoming punches — reads your windup and steps off the line
    const dodgeTime = 0.9 - 0.3 * this.heat;
    if (tgt.punchT >= 0 && tgt.punchT < 0.3 && dist < 2.6 && this.dodgeTimer <= 0 &&
        Math.random() < 0.55 - 0.2 * this.heat) {
      this.dodgeTimer = dodgeTime;
      this.dodgeDir = Math.random() < 0.5 ? -1 : 1;
    }

    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const move = new THREE.Vector3();

    if (this.dodgeTimer > dodgeTime * 0.62) {
      // quick burst sidestep
      move.addScaledVector(side, this.dodgeDir * 1.6);
      move.addScaledVector(dir, -0.4);
    } else if (wantsRunUp) {
      move.addScaledVector(dir, -1);
      move.addScaledVector(side, this.strafeDir * 0.35);
    } else if (scared) {
      move.addScaledVector(dir, dist < 3.4 ? -1 : 0);
      move.addScaledVector(side, this.strafeDir * 0.8);
    } else if (dist > 1.75) {
      move.addScaledVector(dir, 1);
      move.addScaledVector(side, this.strafeDir * 0.35 * Math.sin(t * 1.7));
    } else if (dist < 1.05) {
      move.addScaledVector(dir, -0.7);
      move.addScaledVector(side, this.strafeDir * 0.5);
    } else {
      move.addScaledVector(side, this.strafeDir * 0.75);
      move.addScaledVector(dir, 0.15);
    }
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(b.moveSpeed *
        (this.dodgeTimer > dodgeTime * 0.62 ? 1.15 : 0.85 + 0.1 * this.heat));
      b.moveInput.copy(move);
    }

    if (!b.canAct) return;

    // -------- special move --------
    // `scared` normally shelves the special while a hurt wrestler backs off and
    // regens — but for Slumberjack the nap IS the retreat, so don't block it.
    const shelved = scared && sp !== 'sleep';
    if (b.specialCd <= 0 && this.specialDelay <= 0 && !shelved && tgt.state === 'fight') {
      if (sp === 'suplex' && !tgt.roll && dist < 2.3 && Math.random() < dt * 1.4) {
        // slam them somewhere across the canvas (doSuplex keeps it in the ring)
        const ang = Math.random() * Math.PI * 2;
        this.specialReady = false;
        game.doSuplex(b, tgt, new THREE.Vector3(Math.sin(ang) * 3.2, RING.top, Math.cos(ang) * 3.2));
        return;
      }
      // Blaze closes distance with the meteor drop rather than plodding over
      if (sp === 'slam' && dist > 0.8 && dist < 8.5 && Math.random() < dt * 1.3) {
        game.doSlam(b, tgt);
        return;
      }
      // Slumberjack will lie down anywhere, any time — the only thing that
      // stops him is having nothing to heal back
      if (sp === 'sleep' && b.hp < b.maxHp && Math.random() < dt * 1.5) {
        this.specialReady = false;
        game.doSleep(b);
        return;
      }
      // Presto doesn't need room — the ropes do the aiming for him
      if (sp === 'ricochet' && Math.random() < dt * 1.4) {
        this.specialReady = false;
        game.doRicochet(b, tgt);
        return;
      }
      if (sp === 'feast' && b.hp < b.maxHp * 0.8 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doFeast(b);
        return;
      }
      if (sp === 'coins' && Math.random() < dt * 1.5) {
        this.specialReady = false;
        game.doCoins(b);
        return;
      }
      if (sp === 'quake' && dist < 4.0 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doQuake(b, tgt);
        return;
      }
      if (sp === 'piledriver' && dist < 2.5 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doPiledriver(b, tgt);
        return;
      }
      // Brick raises the wall when you're in his face and swinging
      if (sp === 'wall' && dist < 2.6 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doWall(b, tgt);
        return;
      }
      // Bully Bull needs a run-up
      if (sp === 'charge' && dist > 2.2 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doCharge(b, tgt);
        return;
      }
      // Mitchell plates up before he wades in — the stun is worthless at range
      if (sp === 'steel' && dist < 3.4 && Math.random() < dt * 1.6) {
        this.specialReady = false;
        game.doSteel(b);
        return;
      }
      // Big Wave shields when you're close enough to be punching him
      if (sp === 'shield' && dist < 3.0 && Math.random() < dt * 1.5) {
        this.specialReady = false;
        game.doShield(b);
        return;
      }
      if (sp === 'roll' && dist < 9 && Math.random() < dt * 1.4) {
        game.doRoll(b, tgt);
        return;
      }
      // flurries: on an opening, or when Vicious needs the healing
      if ((sp === 'barrage' || sp === 'ultimate') && dist < 2.0 &&
        (tgt.stun > 0.05 || tgt.flinch > 0.35 ||
          (sp === 'ultimate' && b.hp < b.maxHp * 0.65) || Math.random() < dt * 0.65)) {
        game.startFlurry(b);
        return;
      }
    }

    // -------- jabs, combos, and punishes --------
    if (inReach && !scared) {
      // opening: you whiffed, you're stunned, or you're reeling — PUNISH
      const opening = tgt.stun > 0.05 || tgt.flinch > 0.4 ||
        (tgt.punchT > 0.55 && dist > 1.2);
      if (this.comboLeft > 0) {
        if (b.startPunch()) {
          this.comboLeft--;
          if (this.comboLeft === 0) {
            this.comboPause = (0.9 - 0.5 * this.heat) + Math.random() * (1.4 - 0.7 * this.heat);
          }
        }
      } else if (opening && this.comboPause <= -0.3) {
        this.comboLeft = 2 + ((Math.random() * 2) | 0); // punish combo
      } else if (this.comboPause <= 0 && this.decideTimer <= 0) {
        this.decideTimer = 0.28 - 0.08 * this.heat;
        if (Math.random() < aggr * (0.5 + 0.4 * this.heat)) {
          this.comboLeft = 1 + Math.round(this.heat) + ((Math.random() * 2) | 0);
        }
      }
    }
  }
}
