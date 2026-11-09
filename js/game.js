/* Skyworks Concourse — turn-based hex tactics: state, turn order, player actions, enemy AI, quests, shop, saves, UI */
'use strict';

const SAVE_KEY = 'skyworks.tactics.v1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const STEP_MS = 170;

class Game {
  constructor() {
    this.canvas = $('c'); this.mini = $('minimap');
    this.audio = makeAudio();
    this.renderer = makeRenderer(this.canvas, this.mini, this);
    this.map = null; this.units = []; this.effects = []; this.sel = null; this.hoverHex = null;
    this.phase = 'title'; this.busy = false; this.paused = false; this.beaconLit = 0;
    this.turn = { round: 0, order: [], index: -1 };
    this.nextId = 1; this.logLines = [];
    this.bindUi();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.fitStage(); addEventListener('resize', () => this.fitStage());
    this.updateMutePill();
    $('btnContinue').disabled = !loadSave();
  }

  /* ---------------- stage, loop, helpers ---------------- */
  fitStage() {
    const w = innerWidth, h = innerHeight - 50, s = Math.min(w / 1280, h / 720);
    const st = $('stage'); st.style.transform = `scale(${s})`; st.style.left = ((w - 1280 * s) / 2) + 'px'; st.style.top = ((h - 720 * s) / 2) + 'px';
    this.stageScale = s;
  }
  loop(now) {
    this.now = now;
    this.renderer.draw(now);
    if ((now - (this.lastMini || 0)) > 120) { this.lastMini = now; this.renderer.drawMinimap(); }
    requestAnimationFrame(this.loop);
  }
  tileAt(h) { return this.map.tiles.get(Hex.key(h.q, h.r)); }
  unitAt(h) { return this.units.find(u => u.alive && u.q === h.q && u.r === h.r); }
  activeUnit() { return this.units.find(u => u.id === this.turn.order[this.turn.index]); }
  enemies() { return this.units.filter(u => u.alive && !u.isPlayer); }
  hasLos(a, b) {
    const ln = Hex.line(a, b);
    for (let i = 1; i < ln.length - 1; i++) { const t = this.tileAt(ln[i]); if (t && t.def.blocksSight) return false; }
    return true;
  }
  adjacentToCover(h) { return Hex.neighbours(h).some(n => { const t = this.tileAt(n); return t && t.def.cover; }); }
  log(text, cls = '') {
    this.logLines.push({ text, cls }); if (this.logLines.length > 6) this.logLines.shift();
    $('log').innerHTML = this.logLines.map(l => `<div class="${l.cls}">${l.text}</div>`).join('');
  }
  toast(text, cls = '') {
    const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  floatText(h, text, colour, size) { const p = this.renderer.hexToScreen(h); this.effects.push({ type: 'text', x: p.x, y: p.y - 30, text, colour, size, t0: this.now, life: 900 }); }
  banner(title, sub) {
    $('bannerTitle').textContent = title; $('bannerSub').textContent = sub; $('banner').classList.add('show');
    clearTimeout(this._bannerT); this._bannerT = setTimeout(() => $('banner').classList.remove('show'), 2800);
  }
  flash() { const f = $('flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 130); }

  /* ---------------- run and map setup ---------------- */
  makeUnit(type, h, isPlayer = false) {
    const d = UNIT_TYPES[type];
    return { id: this.nextId++, type, q: h.q, r: h.r, hp: d.hp, maxHp: d.hp, move: d.move, init: d.init, attack: d.attack, range: d.range, armour: d.armour,
      alive: true, isPlayer, state: isPlayer ? null : 'patrol', home: { q: h.q, r: h.r }, anim: null, acted: false, mp: 0 };
  }
  newRun() {
    this.player = this.makeUnit('courier', { q: 0, r: 0 }, true);
    this.shards = 0; this.items = { kit: 1 }; this.upgrades = {}; this.cooldowns = {}; this.carried = [];
    this.stats = { kills: 0, rounds: 0, dealt: 0, taken: 0, shards: 0, districts: 0, bought: 0 };
    this.beaconLit = 0; this.logLines = []; $('log').innerHTML = '';
    this.loadMap(0);
  }
  parseMap(def) {
    const tiles = new Map(), lifts = {}, markers = {}, pickups = [], spawns = [];
    def.rows.forEach((row, rr) => {
      for (let cc = 0; cc < row.length; cc++) {
        const ch = row[cc], h = Hex.offsetToAxial(cc, rr);
        let tdef = TILES[ch], lift = null, marker = null;
        if (!tdef) {
          if (/[1-3]/.test(ch)) { tdef = TILES.L; lift = Number(ch); (lifts[lift] = lifts[lift] || []).push({ q: h.q, r: h.r }); }
          else if (/[A-F]/.test(ch)) { tdef = TILES['!']; marker = ch; markers[ch] = Object.assign({ hex: { q: h.q, r: h.r }, done: false }, def.markers[ch]); }
          else if (SPAWN_CHARS[ch]) { tdef = TILES['.']; spawns.push({ type: SPAWN_CHARS[ch], hex: { q: h.q, r: h.r } }); }
          else if (PICKUP_CHARS[ch]) { tdef = TILES['.']; pickups.push(ch === '$' ? { kind: 'shard', hex: { q: h.q, r: h.r }, amount: 3 } : { kind: 'item', hex: { q: h.q, r: h.r }, item: def.items['@'] }); }
          else tdef = TILES['~'];
        }
        tiles.set(Hex.key(h.q, h.r), { q: h.q, r: h.r, ch, def: tdef, lift, marker });
      }
    });
    return { def, tiles, lifts, markers, pickups, spawns };
  }
  loadMap(index, restore = null) {
    this.mapIndex = index;
    const def = MAPS[index];
    this.map = this.parseMap(def);
    this.units = [this.player];
    const start = this.map.spawns.find(s => s.type === 'player');
    this.player.q = start.hex.q; this.player.r = start.hex.r; this.player.alive = true; this.player.anim = null;
    for (const s of this.map.spawns) if (s.type !== 'player') this.units.push(this.makeUnit(s.type, s.hex));
    this.carried = (def.startItems || []).map(i => ({ ...i }));
    this.quests = def.quests.map((q, i) => ({ def: q, status: i === 0 ? 'active' : 'locked', progress: 0 }));
    this.turn = { round: 0, order: [], index: -1 };
    this.cooldowns = {}; this.sel = null; this.hoverHex = null; this.effects = []; this.phase = 'between';
    this.mapSnapshot = JSON.stringify({ player: this.player, shards: this.shards, items: this.items, upgrades: this.upgrades });
    this.renderer.clearTiles(); this.renderer.fit();
    if (restore) this.applySave(restore);
    $('district').textContent = def.name;
    this.hideOverlays();
    this.banner(def.name, def.subtitle);
    this.log(def.intro, 'brass');
    this.audio.play('district');
    this.refreshHud();
    if (!restore) { this.startRound(); this.save(true); }
    else {
      this.buildTurnBar();
      const active = this.activeUnit();
      if (active && active.isPlayer) this.beginPlayerTurn(true);
      else { this.turn.index--; this.nextTurn(); }
    }
  }

  /* ---------------- rounds and turns ---------------- */
  startRound() {
    this.turn.round++; this.stats.rounds++;
    this.ventsActive = this.turn.round % 2 === 1;
    const alive = this.units.filter(u => u.alive);
    alive.sort((a, b) => b.init - a.init || (a.isPlayer ? -1 : b.isPlayer ? 1 : a.id - b.id));
    this.turn.order = alive.map(u => u.id); this.turn.index = -1;
    for (const u of alive) u.acted = false;
    $('round').textContent = this.turn.round; $('roundTb').textContent = this.turn.round;
    this.buildTurnBar();
    if (this.turn.round > 1) this.audio.play('round');
    if (this.ventsActive && this.map.tiles.size && [...this.map.tiles.values()].some(t => t.def.hazard)) this.log('The steam vents open.', 'warn');
    this.nextTurn();
  }
  nextTurn() {
    if (this.phase === 'gameover' || this.phase === 'ending' || this.phase === 'cleared') return;
    this.turn.index++;
    if (this.turn.index >= this.turn.order.length) { this.startRound(); return; }
    const u = this.activeUnit();
    if (!u || !u.alive) { this.nextTurn(); return; }
    this.updateTurnBar();
    if (u.isPlayer) this.beginPlayerTurn(); else this.enemyTurn(u);
  }
  beginPlayerTurn(restored = false) {
    const p = this.player;
    if (!restored) {
      p.mp = p.move; p.acted = false;
      for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
    }
    this.phase = 'player'; this.busy = false;
    $('phase').textContent = 'Your turn'; $('phase').classList.remove('enemy');
    this.audio.play('turn');
    this.setMode('move');
    this.refreshHud();
    this.updateTurnBar();
    if (!restored) this.save(true);
  }
  endPlayerTurn() {
    if (this.phase !== 'player' || this.busy) return;
    const p = this.player;
    // Hold objectives count turns ended on the marker
    for (const q of this.quests) if (q.status === 'active' && q.def.type === 'hold') {
      const m = this.map.markers[q.def.at];
      if (Hex.equals(p, m.hex)) { q.progress++; this.floatText(p, `Holding ${q.progress}/${q.def.turns}`, '#ffd45e', 13); if (q.progress >= q.def.turns) this.completeQuest(q); }
      else if (q.progress > 0) { q.progress = 0; this.log('You left the console; the calibration resets.', 'warn'); }
    }
    p.acted = true; this.sel = null; this.phase = 'between';
    $('phase').textContent = '';
    this.refreshHud(); this.updateTurnBar();
    if (this.phase === 'between') this.nextTurn();
  }

  /* ---------------- player selection and actions ---------------- */
  setMode(mode) {
    const p = this.player;
    if (mode === 'move') {
      const reach = Hex.reachable(p, p.mp, h => this.moveCost(h, p), h => { const t = this.tileAt(h); return t && t.def.lift; });
      this.sel = { mode: 'move', reach, path: null };
    } else if (mode === 'strike' || mode === 'bolt') {
      const ab = ABILITIES.find(a => a.id === mode);
      const rangeHexes = Hex.within(p, ab.range).filter(h => this.tileAt(h) && this.tileAt(h).def.id !== 'sky' && !Hex.equals(h, p) && (!ab.los || this.hasLos(p, h)));
      const targets = this.enemies().filter(e => Hex.distance(p, e) <= ab.range && (!ab.los || this.hasLos(p, e)));
      this.sel = { mode, rangeHexes, targets };
    }
    this.refreshAbilities();
  }
  moveCost(h, unit) {
    const t = this.tileAt(h);
    if (!t || !t.def.passable) return Infinity;
    if (this.unitAt(h)) return Infinity;
    return t.def.cost;
  }
  onHover(h) {
    this.hoverHex = h;
    if (this.sel && this.sel.mode === 'move' && this.sel.reach && this.phase === 'player') {
      const d = this.sel.reach.get(Hex.key(h.q, h.r));
      this.sel.path = d && d.cost > 0 ? Hex.pathFrom(this.sel.reach, h) : null;
    }
    this.refreshHover();
  }
  async onClick(h) {
    if (this.phase !== 'player' || this.busy || this.paused) return;
    const t = this.tileAt(h); if (!t || t.def.id === 'sky') return;
    const target = this.unitAt(h);
    if (this.sel && (this.sel.mode === 'strike' || this.sel.mode === 'bolt')) {
      if (target && !target.isPlayer && this.sel.targets.includes(target)) { await this.playerAttack(target, this.sel.mode); return; }
      this.audio.play('denied'); this.toast('No target there. Esc to cancel.', 'muted'); return;
    }
    if (target && !target.isPlayer) {
      if (this.player.acted) { this.audio.play('denied'); this.toast('You have already acted this turn.', 'muted'); return; }
      if (Hex.distance(this.player, target) <= 1) { await this.playerAttack(target, 'strike'); return; }
      if (!this.cooldowns.bolt && Hex.distance(this.player, target) <= 3 && this.hasLos(this.player, target)) { await this.playerAttack(target, 'bolt'); return; }
      this.audio.play('denied'); this.toast('Out of reach. Move closer or use the Arc Bolt (2).', 'muted'); return;
    }
    if (this.sel && this.sel.mode === 'move') {
      const d = this.sel.reach.get(Hex.key(h.q, h.r));
      if (!d || d.cost === 0) { this.audio.play('denied'); return; }
      const path = Hex.pathFrom(this.sel.reach, h);
      this.busy = true; this.sel.path = null;
      await this.moveAlong(this.player, path);
      if (this.phase === 'player') { this.busy = false; this.setMode('move'); this.refreshHud(); }
    }
  }
  async moveAlong(u, path) {
    for (let i = 1; i < path.length; i++) {
      const h = path[i], t = this.tileAt(h);
      const from = this.renderer.hexToScreen(u), to = this.renderer.hexToScreen(h);
      u.anim = { from, to, t0: performance.now(), dur: STEP_MS };
      u.q = h.q; u.r = h.r;
      if (u.isPlayer) u.mp = Math.max(0, u.mp - t.def.cost);
      this.audio.play('step');
      await sleep(STEP_MS);
      if (t.def.hazard && this.ventsActive) {
        this.damage(u, t.def.hazard, null, 'steam');
        if (!u.alive) return;
      }
      if (u.isPlayer) {
        this.collectPickups(h);
        this.checkMarker(h);
        if (t.def.lift && this.map.lifts[t.lift] && this.map.lifts[t.lift].length === 2) {
          const other = this.map.lifts[t.lift].find(x => !Hex.equals(x, h));
          if (other && !this.unitAt(other)) {
            await sleep(120); this.audio.play('lift'); this.effects.push({ type: 'ring', hex: { q: h.q, r: h.r }, colour: '#39ffb8', t0: this.now, life: 500 });
            u.q = other.q; u.r = other.r; u.anim = null; u.mp = 0;
            this.effects.push({ type: 'ring', hex: other, colour: '#39ffb8', t0: this.now, life: 600 });
            this.log('The lift pad carries you across.', 'accent');
            this.collectPickups(other); this.checkMarker(other);
          } else this.toast('The lift pad is blocked at the far end.', 'muted');
          return;
        }
      }
      if (this.phase === 'gameover' || this.phase === 'ending' || this.phase === 'cleared') return;
    }
  }
  collectPickups(h) {
    const idx = this.map.pickups.findIndex(p => Hex.equals(p.hex, h));
    if (idx < 0) return;
    const pk = this.map.pickups.splice(idx, 1)[0];
    if (pk.kind === 'shard') { this.shards += pk.amount; this.stats.shards += pk.amount; this.floatText(h, `+${pk.amount} shards`, '#39ffb8', 14); this.audio.play('pickup'); }
    else { this.carried.push({ ...pk.item }); this.floatText(h, pk.item.name, '#ffd45e', 14); this.log(`Picked up the ${pk.item.name.toLowerCase()}.`, 'warn'); this.audio.play('item'); }
    this.refreshHud();
  }
  checkMarker(h) {
    const t = this.tileAt(h); if (!t || !t.marker) return;
    const m = this.map.markers[t.marker];
    const q = this.quests.find(x => x.status === 'active' && (x.def.type === 'reach' || x.def.type === 'deliver') && x.def.at === t.marker);
    if (!q) {
      const later = this.quests.find(x => x.status === 'locked' && x.def.at === t.marker);
      if (later) this.toast(m.kind === 'exit' ? 'The lift stays locked until your current quest is done.' : `${m.label}: nothing to do here yet.`, 'muted');
      return;
    }
    if (q.def.type === 'deliver') {
      const i = this.carried.findIndex(c => c.id === q.def.item);
      if (i < 0) { this.toast(`You need the ${q.def.item === 'coolant' ? 'coolant cell' : q.def.item === 'starchart' ? 'star-chart' : 'item'} first.`, 'warn'); return; }
      this.carried.splice(i, 1);
    }
    this.completeQuest(q);
  }
  async playerAttack(target, kind) {
    const p = this.player;
    if (p.acted) { this.audio.play('denied'); return; }
    if (kind === 'bolt' && this.cooldowns.bolt) { this.audio.play('denied'); this.toast('Arc Bolt is recharging.', 'muted'); return; }
    this.busy = true; p.acted = true; this.sel = null;
    if (kind === 'bolt') this.cooldowns.bolt = ABILITIES.find(a => a.id === 'bolt').cooldown;
    await this.performAttack(p, target, kind);
    if (this.phase === 'player') { this.busy = false; this.setMode('move'); this.refreshHud(); }
  }
  async performAttack(att, def, kind) {
    const ranged = Hex.distance(att, def) > 1;
    const a = this.renderer.hexToScreen(att), b = this.renderer.hexToScreen(def);
    if (ranged) {
      this.audio.play('bolt');
      this.effects.push({ type: 'bolt', from: { x: a.x, y: a.y - 14 }, to: { x: b.x, y: b.y - 12 }, colour: att.isPlayer ? '#39ffb8' : UNIT_TYPES[att.type].colour, t0: this.now, life: 320 });
      if (att.type === 'turret') att.aim = Math.atan2(b.y - a.y, b.x - a.x);
      await sleep(260);
    } else {
      this.audio.play('swing');
      const from = this.renderer.hexToScreen(att);
      att.anim = { from, to: { x: from.x + (b.x - a.x) * 0.35, y: from.y + (b.y - a.y) * 0.35 }, t0: performance.now(), dur: 110 };
      await sleep(110);
      att.anim = { from: { x: from.x + (b.x - a.x) * 0.35, y: from.y + (b.y - a.y) * 0.35 }, to: from, t0: performance.now(), dur: 140 };
      this.effects.push({ type: 'slash', x: b.x, y: b.y, t0: this.now, life: 220 });
    }
    let dmg = att.attack + (kind === 'bolt' ? -1 : 0) + (att.enraged ? 1 : 0);
    const tile = this.tileAt(def);
    const notes = [];
    if (tile && tile.def.exposed) { dmg += 1; notes.push('exposed'); }
    if (ranged && this.adjacentToCover(def)) { dmg -= 1; notes.push('cover'); }
    if (def.armour) { dmg -= def.armour; notes.push('armour'); }
    dmg = Math.max(1, dmg);
    this.damage(def, dmg, att, kind, notes);
    await sleep(240);
  }
  damage(u, dmg, source, kind, notes = []) {
    u.hp = Math.max(0, u.hp - dmg);
    this.effects.push({ type: 'flash', hex: { q: u.q, r: u.r }, colour: kind === 'steam' ? '#ff9a3c' : '#ffffff', t0: this.now, life: 260 });
    this.floatText(u, `−${dmg}${notes.length ? ' (' + notes.join(', ') + ')' : ''}`, u.isPlayer ? '#ff6b6b' : '#ffe9a8', u.isPlayer ? 18 : 16);
    if (kind === 'steam') { this.audio.play('steam'); this.log(`${u.isPlayer ? 'You are' : UNIT_TYPES[u.type].name + ' is'} scalded by the vent for ${dmg}.`, 'warn'); }
    else { this.audio.play(u.isPlayer ? 'hurt' : 'hit'); this.log(`${source && source.isPlayer ? 'You hit' : UNIT_TYPES[source.type].name + ' hits'} ${u.isPlayer ? 'you' : 'the ' + UNIT_TYPES[u.type].name.toLowerCase()} for ${dmg}.`, u.isPlayer ? 'danger' : ''); }
    if (source && source.isPlayer) this.stats.dealt += dmg;
    if (u.isPlayer) { this.stats.taken += dmg; this.flash(); }
    if (u.hp <= 0) this.kill(u, source);
    this.refreshHud();
  }
  kill(u, source) {
    u.alive = false; u.anim = null;
    if (u.isPlayer) { this.gameOver(source); return; }
    const d = UNIT_TYPES[u.type];
    this.stats.kills++; this.shards += d.shards; this.stats.shards += d.shards;
    this.audio.play('enemyDown');
    this.effects.push({ type: 'ring', hex: { q: u.q, r: u.r }, colour: d.colour, t0: this.now, life: 600 });
    setTimeout(() => this.floatText(u, `+${d.shards} shards`, '#39ffb8', 14), 300);
    this.log(`${d.name} disabled.`, 'accent');
    this.updateTurnBar();
    this.checkDefeatQuests();
  }
  checkDefeatQuests() {
    for (const q of this.quests) if (q.status === 'active' && q.def.type === 'defeat') {
      const left = this.enemies().filter(e => q.def.group === 'all' || e.type === q.def.group).length;
      if (left === 0) this.completeQuest(q);
    }
  }
  useAbility(i) {
    if (this.phase !== 'player' || this.busy || this.paused) return;
    const ab = ABILITIES[i], p = this.player;
    if (!ab) return;
    if (ab.id === 'overclock' && !this.upgrades.overclock) { this.audio.play('denied'); this.toast('Overclock is sold by the Quartermaster.', 'muted'); return; }
    if (this.cooldowns[ab.id]) { this.audio.play('denied'); this.toast(`${ab.name} is recharging (${this.cooldowns[ab.id]} rounds).`, 'muted'); return; }
    if (ab.action && p.acted) { this.audio.play('denied'); this.toast('You have already acted this turn.', 'muted'); return; }
    if (ab.id === 'strike' || ab.id === 'bolt') {
      if (this.sel && this.sel.mode === ab.id) { this.setMode('move'); this.audio.play('cancel'); return; }
      this.setMode(ab.id); this.audio.play('select');
      if (!this.sel.targets.length) this.toast(ab.id === 'bolt' ? 'No enemy within three hexes and line of sight.' : 'No adjacent enemy.', 'muted');
      return;
    }
    if (ab.id === 'kit') {
      if (!(this.items.kit > 0)) { this.audio.play('denied'); this.toast('No repair kits. The Quartermaster sells them.', 'muted'); return; }
      if (p.hp >= p.maxHp) { this.audio.play('denied'); this.toast('Suit is already at full integrity.', 'muted'); return; }
      this.items.kit--; p.acted = true; const heal = Math.min(5, p.maxHp - p.hp); p.hp += heal;
      this.audio.play('heal'); this.floatText(p, `+${heal} HP`, '#39ffb8', 16); this.log('Repair kit applied.', 'accent');
      this.effects.push({ type: 'ring', hex: { q: p.q, r: p.r }, colour: '#39ffb8', t0: this.now, life: 600 });
      this.setMode('move'); this.refreshHud(); return;
    }
    if (ab.id === 'overclock') {
      p.mp += 2; this.cooldowns.overclock = ab.cooldown; this.cooldowns.bolt = 0;
      this.audio.play('overclock'); this.floatText(p, 'Overclock +2 MP', '#ffd45e', 16); this.log('Overclock: +2 movement, Arc Bolt recharged.', 'warn');
      this.setMode('move'); this.refreshHud();
    }
  }
  cancel() {
    if (this.phase === 'player' && this.sel && this.sel.mode !== 'move') { this.setMode('move'); this.audio.play('cancel'); return true; }
    return false;
  }

  /* ---------------- enemy AI ---------------- */
  async enemyTurn(u) {
    this.phase = 'enemy'; this.busy = true;
    $('phase').textContent = `${UNIT_TYPES[u.type].name} acts`; $('phase').classList.add('enemy');
    this.audio.play('enemyTurn');
    await sleep(260);
    try { await this.runAi(u); } catch (e) { console.error(e); }
    u.acted = true;
    this.updateTurnBar();
    await sleep(180);
    if (this.phase === 'enemy') this.nextTurn();
  }
  enemyCost(h, u) {
    const t = this.tileAt(h);
    if (!t || !t.def.passable) return Infinity;
    if (this.unitAt(h)) return Infinity;
    return t.def.cost + (t.def.hazard && this.ventsActive ? 4 : 0);
  }
  canAttack(u, target) { return Hex.distance(u, target) <= u.range && (u.range === 1 || this.hasLos(u, target)); }
  async enemyMoveTowards(u, goal, stopAt = 1) {
    const path = Hex.astar(u, goal, h => this.enemyCost(h, u), true);
    if (!path || path.length < 2) return false;
    const steps = [path[0]];
    let budget = u.move;
    for (let i = 1; i < path.length; i++) {
      const h = path[i];
      if (Hex.distance(h, goal) < stopAt) break;
      if (this.unitAt(h)) break;
      const c = this.tileAt(h).def.cost;
      if (c > budget) break;
      budget -= c; steps.push(h);
    }
    if (steps.length < 2) return false;
    await this.moveAlong(u, steps);
    return true;
  }
  async enemyMoveToBest(u, score) {
    const reach = Hex.reachable(u, u.move, h => this.enemyCost(h, u));
    let best = null, bestScore = score({ q: u.q, r: u.r }, 0);
    for (const d of reach.values()) { const sc = score(d.hex, d.cost); if (sc > bestScore) { bestScore = sc; best = d.hex; } }
    if (!best) return false;
    await this.moveAlong(u, Hex.pathFrom(reach, best));
    return true;
  }
  async enemyPatrol(u) {
    const reach = Hex.reachable(u, Math.min(2, u.move), h => this.enemyCost(h, u));
    const options = [...reach.values()].filter(d => d.cost > 0 && Hex.distance(d.hex, u.home) <= 2 && !(this.tileAt(d.hex).def.hazard && this.ventsActive));
    if (!options.length || Math.random() < 0.35) return;
    const pick = options[(Math.random() * options.length) | 0];
    await this.moveAlong(u, Hex.pathFrom(reach, pick.hex));
  }
  async runAi(u) {
    const p = this.player, d = UNIT_TYPES[u.type], dist = Hex.distance(u, p);
    // Patrolling units need line of sight to notice the courier; once alerted they track by distance
    const sees = dist <= d.sight && (u.state !== 'patrol' || this.hasLos(u, p));
    switch (u.type) {
      case 'drone': {
        if (u.hp <= 2) {
          if (u.state !== 'flee') { u.state = 'flee'; this.log('The drone breaks off, trailing smoke.', 'warn'); }
          await this.enemyMoveToBest(u, (h, c) => Hex.distance(h, p) * 2 - c * 0.1);
          return;
        }
        if (!sees) { u.state = 'patrol'; await this.enemyPatrol(u); return; }
        if (u.state === 'patrol') { u.state = 'alert'; this.audio.play('alert'); this.floatText(u, '!', '#ff6b6b', 20); await sleep(200); }
        if (!this.canAttack(u, p)) await this.enemyMoveTowards(u, p, 1);
        if (this.canAttack(u, p)) await this.performAttack(u, p, 'melee');
        return;
      }
      case 'scuttler': {
        if (!sees) { u.state = 'patrol'; await this.enemyPatrol(u); return; }
        if (u.state !== 'charge') { u.state = 'charge'; this.audio.play('charge'); this.floatText(u, 'charge!', '#ffb36b', 14); await sleep(200); }
        if (!this.canAttack(u, p)) await this.enemyMoveTowards(u, p, 1);
        if (this.canAttack(u, p)) await this.performAttack(u, p, 'melee');
        return;
      }
      case 'turret': {
        const a = this.renderer.hexToScreen(u), b = this.renderer.hexToScreen(p);
        if (dist <= d.sight) u.aim = Math.atan2(b.y - a.y, b.x - a.x);
        if (this.canAttack(u, p)) { u.state = 'alert'; await this.performAttack(u, p, 'ranged'); }
        else { u.state = 'patrol'; await sleep(120); }
        return;
      }
      case 'skimmer': {
        if (u.hp <= 1) { u.state = 'flee'; await this.enemyMoveToBest(u, (h, c) => Hex.distance(h, p) * 2 - c * 0.1); return; }
        if (!sees) { u.state = 'patrol'; await this.enemyPatrol(u); return; }
        u.state = 'alert';
        // Prefer a hex at distance 2–3 with line of sight to the courier
        await this.enemyMoveToBest(u, (h, c) => {
          const dd = Hex.distance(h, p), los = this.hasLos(h, p);
          let sc = 0;
          if (dd >= 2 && dd <= 3) sc += 10; else if (dd === 1) sc -= 6; else sc -= (dd - 3) * 3;
          if (los && dd <= 3) sc += 6;
          if (this.adjacentToCover(h)) sc += 1.5;
          return sc - c * 0.2;
        });
        if (this.canAttack(u, p)) await this.performAttack(u, p, 'ranged');
        return;
      }
      case 'warden': {
        if (u.hp <= 5 && !u.enraged) { u.enraged = true; this.log('The Warden\'s core overloads. Its strikes grow heavier.', 'danger'); this.floatText(u, 'ENRAGED', '#c678ff', 16); this.audio.play('alert'); await sleep(300); }
        u.state = sees ? 'alert' : 'patrol';
        if (!sees) { await sleep(150); return; }
        if (!this.canAttack(u, p)) await this.enemyMoveTowards(u, p, 1);
        if (this.canAttack(u, p)) await this.performAttack(u, p, 'melee');
        return;
      }
    }
  }

  /* ---------------- quests, districts, ending ---------------- */
  completeQuest(q) {
    q.status = 'done';
    if (q.def.at) this.map.markers[q.def.at].done = true;
    this.audio.play('quest');
    this.toast(`Quest complete: ${q.def.title}`, 'accent');
    this.log(q.def.done, 'accent');
    const next = this.quests.find(x => x.status === 'locked');
    if (next) { next.status = 'active'; this.log(`New objective: ${next.def.text}`, 'brass'); }
    this.refreshHud();
    if (next && next.def.type === 'defeat') { this.checkDefeatQuests(); return; }
    if (!next) {
      if (this.mapIndex === MAPS.length - 1) this.startEnding(); else this.clearDistrict();
    }
  }
  clearDistrict() {
    this.phase = 'cleared'; this.busy = true; this.stats.districts++;
    this.audio.play('cleared');
    setTimeout(() => {
      $('clearedTitle').textContent = this.map.def.name;
      $('clearedStats').innerHTML = `<dt>Rounds</dt><dd>${this.turn.round}</dd><dt>Enemies disabled</dt><dd>${this.units.filter(u => !u.isPlayer && !u.alive).length}</dd><dt>Suit integrity</dt><dd>${this.player.hp} / ${this.player.maxHp}</dd><dt>Shards</dt><dd>${this.shards}</dd>`;
      $('cleared').classList.remove('hidden');
      this.save(true, 'shop');
    }, 900);
  }
  openShop() {
    this.phase = 'shop';
    $('cleared').classList.add('hidden'); $('shop').classList.remove('hidden');
    $('shopNext').textContent = MAPS[this.mapIndex + 1].name;
    this.renderShop();
  }
  renderShop() {
    $('shopShards').textContent = this.shards;
    const owned = id => this.upgrades[id] || 0;
    $('shopRows').innerHTML = '';
    for (const it of SHOP_ITEMS) {
      const lvl = it.id === 'kit' ? (this.items.kit || 0) : owned(it.id);
      const row = document.createElement('div'); row.className = 'shop-row';
      const ico = document.createElement('canvas'); ico.width = ico.height = 34; ico.className = 'ico'; this.drawShopIcon(ico, it.id);
      row.appendChild(ico);
      const txt = document.createElement('div'); txt.className = 'txt'; txt.innerHTML = `<b>${it.name}</b><small>${it.desc}</small>`; row.appendChild(txt);
      const lv = document.createElement('div'); lv.className = 'lvl'; lv.textContent = it.id === 'kit' ? `held ${lvl}` : it.max === 1 ? (lvl ? 'owned' : '') : `lvl ${lvl}/${it.max}`; row.appendChild(lv);
      const cost = document.createElement('div'); cost.className = 'cost'; cost.textContent = `${it.cost} ◆`; row.appendChild(cost);
      const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = 'Buy';
      const maxed = it.id !== 'kit' && lvl >= it.max;
      btn.disabled = maxed || this.shards < it.cost;
      if (maxed) btn.textContent = 'Max';
      btn.onclick = () => this.buy(it);
      row.appendChild(btn);
      $('shopRows').appendChild(row);
    }
  }
  drawShopIcon(c, id) {
    const g = c.getContext('2d'); g.clearRect(0, 0, 34, 34);
    g.fillStyle = 'rgba(57,255,184,.08)'; g.fillRect(0, 0, 34, 34);
    g.strokeStyle = '#39ffb8'; g.fillStyle = '#39ffb8'; g.lineWidth = 2;
    switch (id) {
      case 'plating': g.beginPath(); g.moveTo(17, 5); g.lineTo(28, 10); g.lineTo(26, 22); g.lineTo(17, 29); g.lineTo(8, 22); g.lineTo(6, 10); g.closePath(); g.stroke(); break;
      case 'servos': g.beginPath(); g.moveTo(10, 8); g.lineTo(14, 20); g.lineTo(8, 27); g.moveTo(14, 20); g.lineTo(24, 20); g.lineTo(26, 27); g.moveTo(24, 20); g.lineTo(24, 8); g.stroke(); break;
      case 'coil': g.beginPath(); for (let i = 0; i < 4; i++) g.arc(17, 8 + i * 6, 6, Math.PI, 0, i % 2 === 1); g.stroke(); break;
      case 'edge': g.beginPath(); g.moveTo(8, 27); g.lineTo(26, 7); g.lineTo(28, 12); g.lineTo(12, 29); g.closePath(); g.fill(); break;
      case 'overclock': g.beginPath(); g.moveTo(19, 4); g.lineTo(9, 19); g.lineTo(17, 19); g.lineTo(15, 30); g.lineTo(26, 14); g.lineTo(18, 14); g.closePath(); g.fill(); break;
      case 'kit': g.fillRect(14, 6, 6, 22); g.fillRect(6, 14, 22, 6); break;
    }
  }
  buy(it) {
    if (this.shards < it.cost) { this.audio.play('denied'); return; }
    this.shards -= it.cost; this.stats.bought++;
    if (it.id !== 'kit') this.upgrades[it.id] = (this.upgrades[it.id] || 0) + 1;
    it.apply(this);
    this.audio.play('buy'); this.renderShop(); this.refreshHud();
    this.save(true, 'shop');
  }
  leaveShop() {
    $('shop').classList.add('hidden');
    this.loadMap(this.mapIndex + 1);
  }
  startEnding() {
    this.phase = 'ending'; this.busy = true; this.sel = null;
    this.beaconLit = this.now; this.audio.play('ignite');
    $('phase').textContent = '';
    const ov = $('ending'); ov.classList.remove('hidden');
    ENDING_LINES.forEach((line, i) => { const el = $('end' + (i + 1)); el.textContent = line; el.classList.remove('show'); setTimeout(() => el.classList.add('show'), 1200 + i * 2600); });
    setTimeout(() => {
      ov.classList.add('hidden');
      $('creditStats').innerHTML = `<dt>Rounds fought</dt><dd>${this.stats.rounds}</dd><dt>Enemies disabled</dt><dd>${this.stats.kills}</dd><dt>Damage dealt</dt><dd>${this.stats.dealt}</dd><dt>Damage taken</dt><dd>${this.stats.taken}</dd><dt>Shards gathered</dt><dd>${this.stats.shards}</dd><dt>Upgrades bought</dt><dd>${this.stats.bought}</dd>`;
      $('credits').classList.remove('hidden');
      clearSave(); $('btnContinue').disabled = true;
    }, 1200 + ENDING_LINES.length * 2600 + 1500);
  }
  gameOver(source) {
    this.phase = 'gameover'; this.busy = true; this.sel = null;
    this.audio.play('gameover');
    $('phase').textContent = '';
    setTimeout(() => {
      $('goText').textContent = source ? `${UNIT_TYPES[source.type].name} brought the courier down on round ${this.turn.round} of the ${this.map.def.name}.` : `The steam vents of the ${this.map.def.name} finished the courier on round ${this.turn.round}.`;
      $('btnGoLoad').disabled = !loadSave();
      $('gameover').classList.remove('hidden');
    }, 900);
  }
  retryMap() {
    const snap = JSON.parse(this.mapSnapshot);
    Object.assign(this.player, snap.player, { alive: true }); this.player.hp = this.player.maxHp; this.shards = snap.shards; this.items = snap.items; this.upgrades = snap.upgrades;
    this.loadMap(this.mapIndex);
  }

  /* ---------------- save / load ---------------- */
  serialise(stage = 'battle') {
    return {
      v: 1, stage, mapIndex: this.mapIndex, round: this.turn.round, order: this.turn.order, index: this.turn.index, ventsActive: this.ventsActive,
      nextId: this.nextId, shards: this.shards, items: this.items, upgrades: this.upgrades, cooldowns: this.cooldowns, carried: this.carried, stats: this.stats,
      units: this.units.map(u => ({ id: u.id, type: u.type, q: u.q, r: u.r, hp: u.hp, maxHp: u.maxHp, move: u.move, init: u.init, attack: u.attack, range: u.range, armour: u.armour, alive: u.alive, isPlayer: u.isPlayer, state: u.state, home: u.home, acted: u.acted, mp: u.mp, enraged: !!u.enraged })),
      quests: this.quests.map(q => ({ status: q.status, progress: q.progress })),
      pickups: this.map.pickups.map(p => p.hex), markers: Object.fromEntries(Object.entries(this.map.markers).map(([k, m]) => [k, m.done])),
      mapSnapshot: this.mapSnapshot
    };
  }
  save(quiet = false, stage = 'battle') {
    if (!this.map || this.phase === 'gameover' || this.phase === 'ending') return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialise(stage))); $('btnContinue').disabled = false; if (!quiet) this.toast('Progress saved.', 'accent'); }
    catch (e) { if (!quiet) this.toast('Could not save (storage unavailable).', 'danger'); }
  }
  applySave(d) {
    this.nextId = d.nextId; this.shards = d.shards; this.items = d.items; this.upgrades = d.upgrades; this.cooldowns = d.cooldowns || {}; this.carried = d.carried; this.stats = d.stats;
    this.units = d.units.map(s => Object.assign({ anim: null }, s));
    this.player = this.units.find(u => u.isPlayer);
    this.turn = { round: d.round, order: d.order, index: d.index }; this.ventsActive = d.ventsActive;
    this.quests.forEach((q, i) => { if (d.quests[i]) { q.status = d.quests[i].status; q.progress = d.quests[i].progress; } });
    this.map.pickups = this.map.pickups.filter(p => d.pickups.some(h => Hex.equals(h, p.hex)));
    for (const k in d.markers) if (this.map.markers[k]) this.map.markers[k].done = d.markers[k];
    this.mapSnapshot = d.mapSnapshot;
    $('round').textContent = this.turn.round; $('roundTb').textContent = this.turn.round;
  }
  continueRun() {
    const d = loadSave(); if (!d) return;
    this.beaconLit = 0; this.logLines = []; $('log').innerHTML = '';
    if (d.stage === 'shop') {
      // Saved at the kiosk: rebuild the cleared map silently, then reopen the shop
      this.mapIndex = d.mapIndex; this.map = this.parseMap(MAPS[d.mapIndex]); this.quests = MAPS[d.mapIndex].quests.map(q => ({ def: q, status: 'done', progress: 0 }));
      this.applySave(d); this.renderer.clearTiles(); this.renderer.fit(); $('district').textContent = MAPS[d.mapIndex].name;
      this.hideOverlays(); this.refreshHud(); this.openShop(); return;
    }
    this.player = Object.assign({ anim: null }, d.units.find(u => u.isPlayer));
    this.loadMap(d.mapIndex, d);
  }

  /* ---------------- UI ---------------- */
  hideOverlays() { for (const id of ['title', 'help', 'pause', 'cleared', 'shop', 'gameover', 'ending', 'credits']) $(id).classList.add('hidden'); this.paused = false; }
  buildTurnBar() {
    const bar = $('turnbar');
    bar.querySelectorAll('.tb-unit').forEach(e => e.remove());
    for (const id of this.turn.order) {
      const u = this.units.find(x => x.id === id); if (!u || !u.alive) continue;
      const el = document.createElement('div'); el.className = 'tb-unit' + (u.isPlayer ? ' player' : ''); el.dataset.id = id;
      el.dataset.tip = `${UNIT_TYPES[u.type].name} · initiative ${u.init} · HP ${u.hp}/${u.maxHp}`;
      const c = document.createElement('canvas'); c.width = c.height = 56; this.renderer.drawPortrait(c, u); el.appendChild(c);
      const ini = document.createElement('span'); ini.className = 'ini'; ini.textContent = u.init; el.appendChild(ini);
      el.addEventListener('mouseenter', () => { this.hoverUnit = u; this.refreshUnitCard(); });
      el.addEventListener('mouseleave', () => { this.hoverUnit = null; this.refreshUnitCard(); });
      bar.appendChild(el);
    }
    this.updateTurnBar();
  }
  updateTurnBar() {
    const cur = this.turn.order[this.turn.index];
    $('turnbar').querySelectorAll('.tb-unit').forEach(el => {
      const u = this.units.find(x => x.id === Number(el.dataset.id));
      el.classList.toggle('active', Number(el.dataset.id) === cur);
      el.classList.toggle('done', !!(u && (u.acted || !u.alive)) && Number(el.dataset.id) !== cur);
      el.classList.toggle('pending', !!(u && !u.acted && Number(el.dataset.id) !== cur));
      if (u && !u.alive) el.style.display = 'none';
      if (u) el.dataset.tip = `${UNIT_TYPES[u.type].name} · initiative ${u.init} · HP ${u.hp}/${u.maxHp}`;
    });
  }
  refreshHud() {
    const p = this.player; if (!p) return;
    $('hp').textContent = `${p.hp}/${p.maxHp}`; $('hpfill').style.width = (100 * p.hp / p.maxHp) + '%'; $('hpfill').classList.toggle('low', p.hp <= p.maxHp / 3);
    $('shards').textContent = this.shards;
    $('mpinfo').innerHTML = this.phase === 'player' ? `Movement <b>${p.mp}</b> / ${p.move}<br>Action <b>${p.acted ? 'used' : 'ready'}</b>` : `<span class="muted">Enemy phase</span>`;
    const et = $('endturn'); et.disabled = this.phase !== 'player' || this.busy; et.classList.toggle('ready', this.phase === 'player' && p.acted && p.mp === 0);
    $('quests').innerHTML = this.quests.map(q => `<div class="quest q-${q.status === 'done' ? 'complete' : q.status}"><h3>${q.def.title}<span class="tag">${q.status === 'done' ? 'done' : q.def.type}</span></h3><div class="q-text">${q.status === 'locked' ? '…' : q.def.text}</div>${q.def.type === 'hold' && q.status === 'active' ? `<div class="q-prog">Held ${q.progress} / ${q.def.turns} turns</div>` : ''}${q.def.type === 'defeat' && q.status === 'active' ? `<div class="q-prog">${this.enemies().filter(e => q.def.group === 'all' || e.type === q.def.group).length} remaining</div>` : ''}</div>`).join('');
    const inv = [...this.carried.map(c => c.name)]; if (this.items.kit) inv.push(`Repair kit ×${this.items.kit}`);
    $('inv').innerHTML = inv.length ? inv.map(n => `<span>${n}</span>`).join('') : '<span class="muted">Nothing</span>';
    this.refreshAbilities(); this.refreshUnitCard(); this.refreshHover();
  }
  refreshAbilities() {
    const p = this.player, host = $('abilities'); host.innerHTML = '';
    ABILITIES.forEach((ab, i) => {
      const el = document.createElement('div'); el.className = 'ab';
      const locked = ab.id === 'overclock' && !this.upgrades.overclock;
      const cd = this.cooldowns[ab.id] || 0;
      const noKit = ab.id === 'kit' && !(this.items.kit > 0);
      const disabled = this.phase !== 'player' || locked || cd > 0 || noKit || (ab.action && p && p.acted);
      el.classList.toggle('disabled', disabled);
      el.classList.toggle('active', !!(this.sel && this.sel.mode === ab.id));
      el.innerHTML = `<span class="k">${ab.key}</span><span class="n">${ab.name}</span><span class="s">${locked ? 'locked' : ab.id === 'kit' ? `×${this.items.kit || 0} · +5 HP` : ab.id === 'strike' ? `${p ? p.attack : 3} dmg · adjacent` : ab.id === 'bolt' ? `${p ? p.attack - 1 : 2} dmg · 3 hexes` : '+2 MP · free'}</span>${cd > 0 ? `<div class="cd">${cd}</div>` : ''}`;
      el.title = ab.desc;
      el.onclick = () => this.useAbility(i);
      host.appendChild(el);
    });
  }
  refreshUnitCard() {
    const u = this.hoverUnit || (this.hoverHex && this.map && this.unitAt(this.hoverHex)) || this.player;
    if (!u) { $('unitcard').innerHTML = ''; return; }
    const d = UNIT_TYPES[u.type];
    const inRange = !u.isPlayer && this.player ? Hex.distance(this.player, u) : null;
    $('unitcard').innerHTML = `<div class="name"><i style="background:${d.colour}"></i>${d.name}${u.isPlayer ? ' (you)' : ''}</div>
      <div class="row"><span>HP</span><b>${u.hp} / ${u.maxHp}</b></div>
      <div class="row"><span>Attack</span><b>${u.attack}${u.enraged ? ' +1' : ''}</b></div>
      <div class="row"><span>Range</span><b>${u.range}${u.type === 'courier' ? ' (bolt 3)' : ''}</b></div>
      <div class="row"><span>Movement</span><b>${u.move}</b></div>
      <div class="row"><span>Initiative</span><b>${u.init}</b></div>
      ${u.armour ? `<div class="row"><span>Armour</span><b>${u.armour}</b></div>` : ''}
      ${!u.isPlayer ? `<div class="row"><span>Distance</span><b>${inRange} hex${inRange === 1 ? '' : 'es'}${this.hasLos(this.player, u) ? '' : ' · no line of sight'}</b></div><div class="row"><span>Behaviour</span><b>${u.state || 'patrol'}</b></div><div class="blurb">${d.blurb}</div>` : ''}`;
  }
  refreshHover() {
    const h = this.hoverHex, el = $('hover');
    if (!h || !this.map) { el.innerHTML = '<span class="muted">Hover a hex for details.</span>'; return; }
    const t = this.tileAt(h);
    if (!t || t.def.id === 'sky') { el.innerHTML = `<span class="mono">(${h.q}, ${h.r})</span> <span class="muted">Open sky — impassable</span>`; return; }
    const off = Hex.axialToOffset(h.q, h.r);
    const bits = [`<b>${t.def.name}</b> <span class="mono">(${h.q}, ${h.r})</span> <span class="muted">col ${off.col} row ${off.row}</span>`];
    if (t.def.passable) {
      bits.push(`Enter cost ${t.def.cost}${t.def.hazard ? ` · scalds for ${t.def.hazard} when venting${this.ventsActive ? ' (venting now)' : ''}` : ''}${t.def.exposed ? ' · exposed: +1 damage taken' : ''}${t.def.lift ? ` · lift pad ${t.lift}` : ''}`);
      if (this.adjacentToCover(h)) bits.push('Next to cover: −1 ranged damage');
    } else bits.push(t.def.cover ? 'Blocks movement and line of sight' : 'Impassable');
    if (t.marker) bits.push(`<span class="warn">${this.map.markers[t.marker].label}</span>`);
    const d = this.sel && this.sel.mode === 'move' && this.sel.reach && this.sel.reach.get(Hex.key(h.q, h.r));
    if (d && d.cost > 0) bits.push(`<span class="accent">Path cost ${d.cost} of ${this.player.mp} MP (${Hex.distance(this.player, h)} hex${Hex.distance(this.player, h) === 1 ? '' : 'es'} away)</span>`);
    const u = this.unitAt(h);
    if (u && !u.isPlayer) { const dist = Hex.distance(this.player, u); bits.push(`<span class="danger">${UNIT_TYPES[u.type].name}</span> · ${dist <= 1 ? 'in blade range' : dist <= 3 && this.hasLos(this.player, u) ? 'in bolt range' : 'out of range'}`); }
    el.innerHTML = bits.join('<br>');
    this.refreshUnitCard();
  }
  updateMutePill() { $('pillMute').textContent = this.audio.muted ? 'Sound off' : 'Sound on'; }
  togglePause() {
    if (this.phase === 'title' || this.phase === 'ending' || this.phase === 'gameover') return;
    this.paused = !this.paused;
    $('pauseTitle').textContent = this.map ? this.map.def.name : 'Skyworks Concourse';
    $('pauseText').textContent = this.map ? `Round ${this.turn.round} · ${this.enemies().length} enemies remain.` : '';
    $('pause').classList.toggle('hidden', !this.paused);
  }
  showHelp(show) {
    if (show) $('helpBody').innerHTML = HELP_SECTIONS.map(s => `<h3>${s.title}</h3><ul>${s.lines.map(l => `<li>${l}</li>`).join('')}</ul>`).join('');
    $('help').classList.toggle('hidden', !show);
  }
  toTitle() {
    if (this.map && this.phase !== 'gameover' && this.phase !== 'ending') this.save(true, this.phase === 'shop' ? 'shop' : 'battle');
    this.hideOverlays(); this.phase = 'title'; this.map = null; this.units = []; this.sel = null; this.busy = false;
    $('title').classList.remove('hidden'); $('btnContinue').disabled = !loadSave();
    $('district').textContent = ''; $('phase').textContent = '';
  }
  bindUi() {
    const canvasPoint = ev => { const r = this.canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (this.canvas.width / r.width), y: (ev.clientY - r.top) * (this.canvas.height / r.height) }; };
    this.canvas.addEventListener('mousemove', ev => { if (!this.map) return; const p = canvasPoint(ev); this.onHover(this.renderer.hexAt(p.x, p.y)); });
    this.canvas.addEventListener('mouseleave', () => { this.hoverHex = null; if (this.sel) this.sel.path = null; this.refreshHover(); });
    this.canvas.addEventListener('click', ev => { if (!this.map) return; const p = canvasPoint(ev); this.onClick(this.renderer.hexAt(p.x, p.y)); });
    this.canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); this.cancel(); });
    $('endturn').onclick = () => this.endPlayerTurn();
    $('btnNew').onclick = () => { this.audio.start(); this.hideOverlays(); this.newRun(); };
    $('btnContinue').onclick = () => { this.audio.start(); this.hideOverlays(); this.continueRun(); };
    $('btnHelpTitle').onclick = () => { this.audio.start(); this.showHelp(true); };
    $('btnHelpClose').onclick = () => this.showHelp(false);
    $('pillHelp').onclick = () => this.showHelp(true);
    $('pillPause').onclick = () => this.togglePause();
    $('pillSave').onclick = () => { if (this.map && (this.phase === 'player' || this.phase === 'shop')) this.save(false, this.phase === 'shop' ? 'shop' : 'battle'); else this.toast('Save during your own turn.', 'muted'); };
    $('pillMute').onclick = () => { this.audio.start(); this.audio.toggle(); this.updateMutePill(); };
    $('pillMap').onclick = () => $('minimapWrap').classList.toggle('hidden');
    $('btnResume').onclick = () => this.togglePause();
    $('btnPauseSave').onclick = () => { if (this.phase === 'player') this.save(false); else this.toast('Save during your own turn.', 'muted'); };
    $('btnPauseHelp').onclick = () => this.showHelp(true);
    $('btnPauseTitle').onclick = () => this.toTitle();
    $('btnShop').onclick = () => this.openShop();
    $('btnShopDone').onclick = () => this.leaveShop();
    $('btnRetry').onclick = () => { this.hideOverlays(); this.retryMap(); };
    $('btnGoLoad').onclick = () => { this.hideOverlays(); this.continueRun(); };
    $('btnGoTitle').onclick = () => this.toTitle();
    $('btnCreditsTitle').onclick = () => this.toTitle();
    addEventListener('keydown', ev => {
      if (ev.repeat) return;
      const k = ev.key;
      if (!$('help').classList.contains('hidden')) { if (k === 'Escape' || k === 'h' || k === 'H') this.showHelp(false); return; }
      if (k === 'Escape') { ev.preventDefault(); if (!this.cancel()) this.togglePause(); return; }
      if (this.paused || this.phase === 'title') return;
      if (k === 'Enter' || k === ' ') { ev.preventDefault(); this.endPlayerTurn(); }
      else if (k >= '1' && k <= '4') this.useAbility(Number(k) - 1);
      else if (k === 'm' || k === 'M') { this.audio.start(); this.audio.toggle(); this.updateMutePill(); }
      else if (k === 'h' || k === 'H') this.showHelp(true);
      else if (k === 'n' || k === 'N') $('minimapWrap').classList.toggle('hidden');
      else if (k === 'q' || k === 'Q') $('ql').classList.toggle('hidden');
    });
  }
}

function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const d = JSON.parse(raw); return d && d.v === 1 ? d : null; } catch (e) { return null; } }
function clearSave() { localStorage.removeItem(SAVE_KEY); }

window.__game = new Game();
