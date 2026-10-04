// ============================================================
// ONLINE 1V1
// Host-authoritative: the HOST's browser runs the whole fight — physics,
// damage, ring-outs, everything. The GUEST sends its controls ~30 times a
// second and draws whatever the host says happened. The two browsers talk
// directly (WebRTC through PeerJS), so there is no game server at all.
// Online is always a clean fight: any wrestler, no steroids, best of three.
// ============================================================
const ONLINE_PREFIX = 'frogarcade-wl-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I to misread
const SNAP_RATE = 1 / 25;     // host → guest pictures per second
const INPUT_RATE = 1 / 30;    // guest → host controls per second
const LOCAL_ONLY_ANNOUNCE = /READY!$|^TOO FAR$|^\+50$|^HEAVE!$/;   // the host's own business

const Online = {
  role: null,              // 'host' | 'guest' | null
  peer: null, conn: null, code: null,
  myPick: 'joe', theirPick: null,
  // host side
  inp: { mx: 0, mz: 0, yaw: 0 }, acts: [], outbox: [], sendT: 0, sndDepth: 0, roundTimer: null,
  // guest side
  tgt: null, meta: null, sendInT: 0, lastKO: false, lastHp: null, coinMeshes: [],

  // ---------------------------------------------------------- lobby
  open() {
    hide('menu');
    show('online');
    game.state = 'online';
    Music.play('menu');
    this.renderRoster();
    this.renderStatus();
  },
  renderRoster() {
    const box = $('ol-roster');
    box.innerHTML = '';
    for (const id of ROSTER) {
      const d = BOXER_DEFS[id];
      const b = document.createElement('button');
      b.className = 'ol-chip' + (id === this.myPick ? ' on' : '');
      b.innerHTML = '<span class="ol-face">' + (CHIP_FACE[id] || '🥊') + '</span><span class="ol-nm">' + d.name + '</span>';
      b.addEventListener('click', () => {
        AudioFX.init(); AudioFX.whoosh();
        this.myPick = id;
        this.renderRoster();
        this.send({ k: 'pick', id });
        this.renderStatus();
      });
      box.appendChild(b);
    }
    const d = BOXER_DEFS[this.myPick];
    $('ol-picked').innerHTML = '<b>' + d.name + '</b> — ' + (d.specialName || '') +
      '<span class="ol-stats">' + (d.playerHp || d.maxHp) + ' HP · ' + (d.playerDmg || d.dmg) + ' DMG · ' + d.speed + ' SPD</span>';
  },
  renderStatus(msg) {
    if (msg) $('ol-status').textContent = msg;
    const live = this.conn && this.conn.open;
    $('ol-vs').classList.toggle('hidden', !live);
    if (live) {
      const mine = BOXER_DEFS[this.myPick].name;
      const theirs = this.theirPick ? BOXER_DEFS[this.theirPick].name : '…picking…';
      $('ol-vs').innerHTML = '<span class="me">' + mine + '</span> <i>VS</i> <span class="them">' + theirs + '</span>';
    }
    $('ol-start').classList.toggle('hidden', !(live && this.role === 'host'));
    $('ol-start').disabled = !this.theirPick;
    $('ol-host').disabled = !!live;
    $('ol-join').disabled = !!live;
  },

  host() {
    if (typeof Peer === 'undefined') { this.renderStatus('Online needs an internet connection (PeerJS did not load).'); return; }
    this.reset();
    this.role = 'host';
    this.code = Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
    this.renderStatus('Opening a room…');
    const peer = this.peer = new Peer(ONLINE_PREFIX + this.code);
    peer.on('open', () => {
      $('ol-codebig').textContent = this.code;
      $('ol-codebig').classList.remove('hidden');
      $('ol-copy').classList.remove('hidden', 'done'); $('ol-copy').textContent = '📋 COPY CODE';
      this.renderStatus('Your code is ' + this.code + ' — tell your friend to JOIN with it.');
    });
    peer.on('connection', (c) => {
      if (this.conn && this.conn.open) { c.on('open', () => c.close()); return; }   // one guest only
      this.attach(c);
    });
    peer.on('error', (err) => {
      if (err && err.type === 'unavailable-id') { this.host(); return; }       // code taken: roll another
      this.renderStatus('Connection problem: ' + (err && err.type || err) + '. Try HOST again.');
    });
  },
  join() {
    if (typeof Peer === 'undefined') { this.renderStatus('Online needs an internet connection (PeerJS did not load).'); return; }
    const code = ($('ol-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 4) { this.renderStatus('Codes are 4 letters/numbers — check with your friend.'); return; }
    this.reset();
    this.role = 'guest';
    this.code = code;
    this.renderStatus('Looking for room ' + code + '…');
    const peer = this.peer = new Peer();
    peer.on('open', () => this.attach(peer.connect(ONLINE_PREFIX + code, { reliable: true })));
    peer.on('error', (err) => {
      this.renderStatus(err && err.type === 'peer-unavailable'
        ? 'No room called ' + code + '. Check the code — your friend must press HOST first.'
        : 'Connection problem: ' + (err && err.type || err) + '.');
    });
  },
  attach(c) {
    this.conn = c;
    c.on('open', () => {
      // a heartbeat both ways: if nothing at all arrives for a while, the other side is gone
      // (a closed tab or dropped Wi-Fi doesn't always fire 'close' straight away)
      this.everOpen = true; this.lastRx = performance.now();
      clearInterval(this.hb);
      this.hb = setInterval(() => {
        this.send({ k: 'hb' });
        if (performance.now() - this.lastRx > 12000) this.lost();
      }, 1000);
      this.renderStatus(this.role === 'host' ? 'Your friend joined! Press START MATCH when you are both ready.'
                                             : 'Connected! Waiting for the host to start…');
      this.send({ k: 'pick', id: this.myPick });
    });
    c.on('data', (m) => this.onMsg(m));
    c.on('close', () => this.lost());
    c.on('error', () => this.lost());
  },
  send(m) { if (this.conn && this.conn.open) this.conn.send(m); },
  reset() {
    clearTimeout(this.roundTimer);
    clearInterval(this.hb); this.hb = null;
    if (this.conn) { try { this.conn.close(); } catch (e) {} }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    this.conn = null; this.peer = null; this.role = null; this.theirPick = null;
    $('ol-codebig').classList.add('hidden');
    $('ol-copy').classList.add('hidden');
  },
  copyCode() {
    const code = this.code, btn = $('ol-copy');
    const ok = () => { btn.textContent = '✔ COPIED!'; btn.classList.add('done');
      clearTimeout(this.copyT); this.copyT = setTimeout(() => { btn.textContent = '📋 COPY CODE'; btn.classList.remove('done'); }, 1800); };
    const fallback = () => {             // older browsers / no clipboard permission: copy through a hidden box
      const t = document.createElement('textarea'); t.value = code; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { btn.textContent = 'CODE: ' + code; }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, fallback);
    else fallback();
  },
  lost() {
    if (!this.role) return;
    const wasPlaying = !!game.online, wasOpen = !!this.everOpen;
    this.everOpen = false;
    this.reset();
    this.endOnline();
    if (wasPlaying || game.state !== 'online') {
      hide('versus'); hide('end-screen'); hide('hud');
      show('online'); game.state = 'online'; Music.play('menu');
    }
    this.renderRoster();
    this.renderStatus('Your friend left the match.');
    if (wasOpen) {                       // say it loudly, not just in the small status line
      $('ol-lost-s').textContent = wasPlaying
        ? 'Your opponent left or lost their internet connection, so the match was stopped.'
        : 'Your friend left the room. Host again or join a new code.';
      show('ol-lost');
    }
  },
  leave() { this.reset(); this.endOnline(); },
  endOnline() {
    clearTimeout(this.roundTimer);
    if (document.pointerLockElement) document.exitPointerLock();
    game.online = null;
    cleanupMatch();
    this.clearCoins();
  },

  // ---------------------------------------------------------- messages
  onMsg(m) {
    this.lastRx = performance.now();
    if (!m || !m.k) return;
    switch (m.k) {
      case 'pick': this.theirPick = m.id; this.renderStatus(); break;
      case 'start': this.beginMatch(m.h, m.g); break;
      case 'round': if (this.role === 'guest') this.guestStartRound(m); break;
      case 'rend': if (this.role === 'guest') this.afterRound(m.re, m.rp, m.done); break;
      case 'lobby': this.backToLobby(true); break;
      case 'i': if (this.role === 'host') { this.inp.mx = m.mx; this.inp.mz = m.mz; this.inp.yaw = m.yaw; } break;
      case 'a': if (this.role === 'host') this.acts.push(m); break;
      case 's': if (this.role === 'guest') this.onSnap(m); break;
    }
  },

  // ---------------------------------------------------------- match flow
  start() {   // host pressed START MATCH
    if (this.role !== 'host' || !this.theirPick) return;
    this.send({ k: 'start', h: this.myPick, g: this.theirPick });
    this.beginMatch(this.myPick, this.theirPick);
  },
  beginMatch(hostPick, guestPick) {
    game.online = this.role;
    game.selectedId = this.role === 'host' ? hostPick : guestPick;
    this.theirPick = this.role === 'host' ? guestPick : hostPick;
    game.tournament = 'bronze';
    game.isTitleFight = false;
    game.roundsToWin = 2;
    game.roundP = 0; game.roundE = 0; game.round = 1;
    game.team = null; game.teamDown = []; game.enemyTeam = null; game.enemyDown = [];
    game.carryMeter = null;
    hide('online'); hide('end-screen');
    this.showVersus('🌐 ONLINE 1V1 · BEST OF 3');
    if (this.role === 'host') this.queueRound();
  },
  showVersus(label) {
    $('vs-left').textContent = BOXER_DEFS[game.selectedId].name;
    $('vs-right').textContent = BOXER_DEFS[this.theirPick].name;
    $('tourney-label').textContent = label;
    $('ladder').classList.add('hidden');
    show('versus');
    game.state = 'versus';
    AudioFX.setCrowd(0.14);
    AudioFX.versus();
    $('versus').classList.add('waiting');
    $('vs-go').textContent = 'CLICK TO GET READY';
  },
  readyClick() { $('vs-go').textContent = 'READY — THE BELL IS COMING'; $('versus').classList.remove('waiting'); },
  queueRound() {
    clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => {
      if (game.online === 'host' && game.state === 'versus') this.hostStartRound();
    }, 4000);
  },

  // host: build the ring — you in the near corner, your friend in the far one
  hostStartRound() {
    cleanupMatch();
    game.player = new Boxer(game.selectedId, scene, true);
    const g = new Boxer(this.theirPick, scene, true);   // player-side numbers, no steroids (online)
    g.isPlayer = false;        // drawn and turned like an opponent on this screen...
    g.remote = true;           // ...but driven by your friend, and earns a meter like a player
    game.enemy = g;
    game.player.resetFor(new THREE.Vector3(0, RING.top, 1.9), Math.PI);
    g.resetFor(new THREE.Vector3(0, RING.top, -1.9), 0);
    wireBoxer(game.player); wireBoxer(g);
    game.ai = null;
    this.inp = { mx: 0, mz: 0, yaw: 0 }; this.acts = []; this.sendT = 0;
    this.send({ k: 'round', n: game.round });
    beginRoundCommon();
    this.outbox.length = 0;    // the guest rings its own bell
  },
  // guest: the same two wrestlers, as puppets — the host moves them
  guestStartRound(m) {
    cleanupMatch();
    this.clearCoins();
    game.round = m.n;
    game.player = new Boxer(game.selectedId, scene, true);
    game.enemy = new Boxer(this.theirPick, scene, false);
    game.player.resetFor(new THREE.Vector3(0, RING.top, -1.9), 0);
    game.enemy.resetFor(new THREE.Vector3(0, RING.top, 1.9), Math.PI);
    game.player.puppet = game.enemy.puppet = true;
    this.tgt = null; this.meta = null; this.lastKO = false; this.lastHp = null;
    beginRoundCommon();
  },

  // host: the round's over (called where finishRound would score it)
  hostRoundOver() {
    if (game.playerWon) game.roundP++; else game.roundE++;
    const done = game.roundP >= 2 || game.roundE >= 2;
    this.send({ k: 'rend', rp: game.roundP, re: game.roundE, done });
    this.afterRound(game.roundP, game.roundE, done);
  },
  afterRound(mine, theirs, done) {
    if (document.pointerLockElement) document.exitPointerLock();
    hide('ko-overlay'); container.classList.remove('ko-grey'); Music.muffle(false);
    game.roundP = mine; game.roundE = theirs;
    renderRoundHud();
    hide('hud');
    if (done) { this.showEnd(mine > theirs); return; }
    game.round++;
    this.showVersus('ROUND ' + game.round + ' · YOU ' + mine + ' — ' + theirs + ' THEM');
    if (this.role === 'host') this.queueRound();
  },
  showEnd(won) {
    cleanupMatch();
    this.clearCoins();
    $('end-medal').textContent = won ? '🏆' : '💀';
    $('end-title').textContent = won ? 'YOU WIN!' : 'YOU LOSE';
    $('end-sub').textContent = BOXER_DEFS[game.selectedId].name + ' vs ' + BOXER_DEFS[this.theirPick].name +
      ' · ' + game.roundP + '–' + game.roundE + ' · online';
    $('btn-rematch').textContent = this.role === 'host' ? 'REMATCH' : 'WAITING FOR HOST…';
    $('btn-rematch').disabled = this.role !== 'host';
    $('btn-reselect').textContent = 'CHANGE WRESTLER';
    $('btn-menu').textContent = 'LEAVE';
    show('end-screen');
    game.state = 'end';
    Music.sting(won);
  },
  rematch() {
    if (this.role !== 'host') return;
    $('btn-rematch').disabled = false;
    this.start();
  },
  backToLobby(fromThem) {
    if (!fromThem) this.send({ k: 'lobby' });
    clearTimeout(this.roundTimer);
    game.online = null;
    cleanupMatch(); this.clearCoins();
    $('btn-rematch').disabled = false; $('btn-menu').textContent = 'MAIN MENU';
    hide('end-screen'); hide('versus');
    show('online'); game.state = 'online'; Music.play('menu');
    this.renderRoster(); this.renderStatus(this.role === 'host' ? 'Pick again, then START MATCH.' : 'Pick again — the host starts the next match.');
  },

  // ---------------------------------------------------------- host: drive the guest's wrestler
  hostInput(dt) {
    const b = game.enemy, e = game.player;
    if (!b || !b.remote) return;
    b.moveInput.set(0, 0, 0);
    if (b.state === 'fight' && !game.matchOver) {
      const I = this.inp, m = Math.hypot(I.mx, I.mz);
      if (m > 0.01) b.moveInput.set(I.mx / m, 0, I.mz / m).multiplyScalar(b.moveSpeed * Math.min(1, m));
      b.yaw = I.yaw;
    }
    for (const a of this.acts.splice(0)) {
      if (game.matchOver) break;
      if (a.a === 'punch') playerAction(b);
      else if (a.a === 'grab') playerGrabThrow(b, e, new THREE.Vector3(a.d[0], a.d[1], a.d[2]));
      else if (a.a === 'special') playerSpecial(b, e, a.aim ? new THREE.Vector3(a.aim[0], a.aim[1], a.aim[2]) : null);
    }
    // the automatic bits a local player gets
    if (b.roll && downForTheCount(e)) b.endRoll();
    if (b.cfg.rageAt != null && !b.rage && b.state === 'fight' && !b.roll && b.hp > 0 &&
        b.hp <= b.maxHp * b.cfg.rageAt && !downForTheCount(e)) {
      b.rage = true;
      combatAPI.doHoundSpin(b, e, true);
    }
  },
  toGuest(...evs) { if (this.role === 'host') for (const ev of evs) this.outbox.push(ev); },

  // ---------------------------------------------------------- the picture: transforms + state
  objsOf(b) {
    if (!b._objs) { b._objs = []; b.root.traverse(o => b._objs.push(o)); }
    return b._objs;
  },
  pack(list) {
    let n = 0;
    for (const b of list) n += this.objsOf(b).length;
    const a = new Float32Array(n * 11);
    let i = 0;
    for (const b of list) for (const o of this.objsOf(b)) {
      a[i++] = o.position.x; a[i++] = o.position.y; a[i++] = o.position.z;
      a[i++] = o.quaternion.x; a[i++] = o.quaternion.y; a[i++] = o.quaternion.z; a[i++] = o.quaternion.w;
      a[i++] = o.scale.x; a[i++] = o.scale.y; a[i++] = o.scale.z;
      a[i++] = o.visible ? 1 : 0;
    }
    return a;
  },
  metaOf(b) {
    const hd = b.ragdoll.pts[0].p, ce = b.ragdoll.center();
    const r2 = (v) => Math.round(v * 1000) / 1000;
    return {
      hp: b.hp, mx: b.maxHp, me: b.meter, st: b.state, ko: b.koTimer, wp: r2(b.walkPhase), v: b.victoryT,
      rl: b.roll ? (b.roll.upright ? 2 : 1) : 0, sl: b.steel || 0, ca: b.carrying ? 1 : 0,
      hd: [r2(hd.x), r2(hd.y), r2(hd.z)], ce: [r2(ce.x), r2(ce.y), r2(ce.z)],
      so: b.parts.shieldMesh ? b.parts.shieldMesh.material.opacity : 0,
      fo: b.parts.feastAura ? b.parts.feastAura.material.opacity : 0
    };
  },
  hostSend(dt) {
    this.sendT -= dt;
    if (this.sendT > 0 || !this.conn || !this.conn.open) return;
    this.sendT = SNAP_RATE;
    const H = game.player, G = game.enemy;
    this.send({
      k: 's', b: this.pack([H, G]).buffer,
      m: {
        h: this.metaOf(H), g: this.metaOf(G), mo: game.matchOver, rw: game.ringWarp || 0,
        cx: world.crowd.excitement,
        coins: game.coins.map(c => [c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, c.mesh.rotation.z]),
        ev: this.outbox.splice(0)
      }
    });
  },

  // ---------------------------------------------------------- guest: draw what the host saw
  onSnap(m) {
    if (game.state !== 'fight' || !game.player) return;
    const P = game.player, E = game.enemy;
    const arr = new Float32Array(m.b instanceof ArrayBuffer ? m.b : m.b.buffer || m.b);
    const need = (this.objsOf(E).length + this.objsOf(P).length) * 11;
    if (arr.length !== need) return;                 // not the same wrestlers (round changing over)
    this.tgt = arr;
    this.meta = m.m;
    const mm = m.m;
    this.setFrom(E, mm.h);
    this.setFrom(P, mm.g);
    game.matchOver = mm.mo;
    game.ringWarp = mm.rw;
    world.crowd.excitement = mm.cx;
    this.syncCoins(mm.coins || []);
    // your feedback is yours: a hit you took, a knockout you're in
    if (this.lastHp != null && P.hp < this.lastHp - 0.5) {
      flashVignette(); game.kickP += 0.12; game.shake = Math.max(game.shake, 0.25);
    }
    this.lastHp = P.hp;
    if (P.isKO && !this.lastKO) { container.classList.add('ko-grey'); show('ko-overlay'); Music.muffle(true); }
    this.lastKO = P.isKO;
    for (const ev of mm.ev || []) this.playEvent(ev);
  },
  setFrom(b, s) {
    b.hp = s.hp; b.maxHp = s.mx; b.meter = s.me; b.state = s.st; b.koTimer = s.ko;
    b.walkPhase = s.wp; b.victoryT = s.v;
    if ((b.steel || 0) !== s.sl) b.setSteel(s.sl);   // steel-plated gloves show on both screens
    b.roll = s.rl ? { upright: s.rl === 2 } : null;
    b.carrying = s.ca ? {} : null;
    b.ragdoll.pts[0].p.set(s.hd[0], s.hd[1], s.hd[2]);
    b.ragdoll.pts[3].p.set(s.ce[0], s.ce[1], s.ce[2]);
    b.ragdoll.pts[4].p.set(s.ce[0], s.ce[1], s.ce[2]);
    if (b.parts.shieldMesh) b.parts.shieldMesh.material.opacity = s.so;
    if (b.parts.feastAura) b.parts.feastAura.material.opacity = s.fo;
  },
  playEvent(ev) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    switch (ev[0]) {
      case 'snd': if (typeof AudioFX[ev[1]] === 'function') AudioFX[ev[1]](...(ev[2] || [])); break;
      case 'ann': announce(ev[1], ev[2]); break;
      case 'hint': subhint(ev[1]); setTimeout(() => updateHints(), 900); break;
      case 'spark': spawnSpark(V(ev[1], ev[2], ev[3]), ev[4]); break;
      case 'crack': spawnCracks(V(ev[1], ev[2], ev[3]), ev[4]); break;
      case 'pop': world.crowd.pop(V(ev[1], ev[2], ev[3])); break;
      case 'ringout': game.ringOutCam = { loser: ev[1] === 'g' ? game.player : game.enemy, t: 0 }; game.camEye = null; break;
    }
  },
  syncCoins(list) {
    while (this.coinMeshes.length < list.length) {
      const mesh = new THREE.Mesh(coinGeo, coinMat); mesh.rotation.x = Math.PI / 2; scene.add(mesh); this.coinMeshes.push(mesh);
    }
    while (this.coinMeshes.length > list.length) scene.remove(this.coinMeshes.pop());
    list.forEach((c, i) => { this.coinMeshes[i].position.set(c[0], c[1], c[2]); this.coinMeshes[i].rotation.z = c[3]; });
  },
  clearCoins() { for (const m of this.coinMeshes) scene.remove(m); this.coinMeshes.length = 0; },

  guestFrame(dt, t) {
    const P = game.player, E = game.enemy;
    if (!P) return;
    if (game.fightIntro > 0) game.fightIntro -= dt;
    // your controls, on their way to the host
    let f = 0, r = 0;
    if (game.locked && P.state === 'fight' && !game.matchOver) {
      if (keys['KeyW'] || keys['ArrowUp']) f += 1;
      if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) r -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) r += 1;
    }
    const fw = camForward(), side = new THREE.Vector3(-fw.z, 0, fw.x);
    const mv = new THREE.Vector3().addScaledVector(fw, f).addScaledVector(side, r);
    if (mv.lengthSq() > 0) mv.normalize();
    P.moveInput.copy(mv).multiplyScalar(P.moveSpeed);   // only the camera bob reads this here
    this.sendInT -= dt;
    if (this.sendInT <= 0) {
      this.sendInT = INPUT_RATE;
      this.send({ k: 'i', mx: Math.round(mv.x * 1000) / 1000, mz: Math.round(mv.z * 1000) / 1000, yaw: game.camYaw });
    }
    // slide every part toward the host's latest picture (smooths 25 updates/s into 60fps)
    if (this.tgt) {
      const k = 1 - Math.exp(-24 * dt);
      const a = this.tgt;
      let i = 0;
      for (const b of [E, P]) {
        for (const o of this.objsOf(b)) {
          o.position.x += (a[i] - o.position.x) * k; o.position.y += (a[i + 1] - o.position.y) * k; o.position.z += (a[i + 2] - o.position.z) * k;
          TMP.q = TMP.q || new THREE.Quaternion();
          TMP.q.set(a[i + 3], a[i + 4], a[i + 5], a[i + 6]);
          o.quaternion.slerp(TMP.q, k);
          o.scale.set(a[i + 7], a[i + 8], a[i + 9]);
          o.visible = a[i + 10] > 0.5;
          i += 11;
        }
        b.pos.copy(b.root.position);
        b.root.rotation.setFromQuaternion(b.root.quaternion, 'YXZ');
      }
      P.bodyHidden = null;     // the camera decides what of you to hide, every frame
      // the host hides its OWN head and body for its first-person camera (and its whole body when
      // it's down) — on this screen that wrestler is the opponent, so show all of them
      E.root.visible = true;
      E.bodyHidden = null; E.setBodyHidden(false);
    }
    updateHUD();
  },
  guestAction(a) {
    const m = { k: 'a', a };
    if (a === 'grab') { const d = new THREE.Vector3(); camera.getWorldDirection(d); m.d = [d.x, d.y, d.z]; }
    if (a === 'special') {
      if (game.player && game.player.meter < 1) { subhint('SPECIAL NOT CHARGED — LAND MORE PUNCHES!'); setTimeout(() => updateHints(), 900); return; }
      const p = crosshairGroundPoint(); m.aim = [p.x, p.y, p.z];
    }
    this.send(m);
  },
  isHostLive() { return this.role === 'host' && game.online === 'host' && game.state === 'fight'; }
};

// ---- the host tells the guest about everything it hears and sees ----
(function forwardToGuest() {
  for (const k of Object.keys(AudioFX)) {
    const f = AudioFX[k];
    if (typeof f !== 'function' || k === 'init' || k === 'blip') continue;
    AudioFX[k] = function (...args) {
      // composite sounds call other sounds: forward only the outermost one
      if (Online.sndDepth === 0 && Online.isHostLive()) Online.outbox.push(['snd', k, args]);
      Online.sndDepth++;
      try { return f.apply(this, args); } finally { Online.sndDepth--; }
    };
  }
  const _announce = announce;
  announce = function (text, color) {
    if (Online.isHostLive() && !LOCAL_ONLY_ANNOUNCE.test(String(text))) Online.outbox.push(['ann', text, color]);
    return _announce(text, color);
  };
  const _spark = spawnSpark;
  spawnSpark = function (pos, big) {
    if (Online.isHostLive()) Online.outbox.push(['spark', pos.x, pos.y, pos.z, !!big]);
    return _spark(pos, big);
  };
  const _cracks = spawnCracks;
  spawnCracks = function (pos, size) {
    if (Online.isHostLive()) Online.outbox.push(['crack', pos.x, pos.y, pos.z, size]);
    return _cracks(pos, size);
  };
  const _pop = world.crowd.pop.bind(world.crowd);
  world.crowd.pop = function (at) {
    if (Online.isHostLive() && at) Online.outbox.push(['pop', at.x, at.y, at.z]);
    return _pop(at);
  };
  const _elim = eliminate;
  eliminate = function (loser) {
    if (Online.isHostLive()) Online.outbox.push(['ringout', loser === game.player ? 'h' : 'g']);
    return _elim(loser);
  };
})();

// ---- buttons ----
$('btn-online').addEventListener('click', () => { AudioFX.init(); Online.open(); });
$('ol-host').addEventListener('click', () => Online.host());
$('ol-join').addEventListener('click', () => Online.join());
$('ol-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') Online.join(); });
$('ol-start').addEventListener('click', () => Online.start());
$('ol-copy').addEventListener('click', () => { AudioFX.init(); AudioFX.whoosh(); Online.copyCode(); });
$('ol-lost-ok').addEventListener('click', () => hide('ol-lost'));
$('ol-back').addEventListener('click', () => {
  Online.leave();
  hide('online'); show('menu'); game.state = 'menu'; Music.play('menu');
});
