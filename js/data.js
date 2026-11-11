/* Skyworks Concourse — static content: tile types, unit types, maps, quests, shop */
'use strict';

const TILES = {
  '~': { id: 'sky',     name: 'Open sky',      passable: false, cost: Infinity, blocksSight: false },
  '.': { id: 'deck',    name: 'Deck plating',  passable: true,  cost: 1 },
  '=': { id: 'catwalk', name: 'Catwalk',       passable: true,  cost: 1, exposed: true },
  '#': { id: 'cover',   name: 'Cargo cover',   passable: false, cost: Infinity, blocksSight: true, cover: true },
  '^': { id: 'vent',    name: 'Steam vent',    passable: true,  cost: 2, hazard: 2 },
  'L': { id: 'lift',    name: 'Lift pad',      passable: true,  cost: 1, lift: true },
  '!': { id: 'marker',  name: 'Quest marker',  passable: true,  cost: 1, marker: true }
};

/* Characters in map rows that stand on plating but mean something else */
const SPAWN_CHARS = { P: 'player', d: 'drone', s: 'scuttler', t: 'turret', k: 'skimmer', W: 'warden' };
const PICKUP_CHARS = { '$': 'shard', '@': 'item' };

const UNIT_TYPES = {
  courier: { name: 'Courier', hp: 16, move: 4, init: 7, attack: 3, range: 1, armour: 0, sight: 99, colour: '#39ffb8' },
  drone: {
    name: 'Patrol drone', hp: 5, move: 3, init: 6, attack: 2, range: 1, armour: 0, sight: 5, shards: 2, colour: '#ff6b6b',
    blurb: 'Patrols its beat, closes in when it spots you, and limps away once badly damaged.', ai: 'drone'
  },
  scuttler: {
    name: 'Scuttler', hp: 4, move: 5, init: 9, attack: 2, range: 1, armour: 0, sight: 7, shards: 2, colour: '#ffb36b',
    blurb: 'Fast and reckless. Charges straight at you the moment it sees you and never retreats.', ai: 'scuttler'
  },
  turret: {
    name: 'Sentry turret', hp: 6, move: 0, init: 3, attack: 2, range: 4, armour: 1, sight: 4, shards: 3, colour: '#d7a74a',
    blurb: 'Bolted to the deck. Fires at anything in line of sight within four hexes.', ai: 'turret'
  },
  skimmer: {
    name: 'Skimmer', hp: 4, move: 4, init: 8, attack: 2, range: 3, armour: 0, sight: 7, shards: 3, colour: '#8ad0ff',
    blurb: 'A ranged drone that keeps its distance, slipping away if you close to melee.', ai: 'skimmer'
  },
  warden: {
    name: 'Beacon Warden', hp: 14, move: 2, init: 5, attack: 4, range: 1, armour: 0, sight: 9, shards: 10, colour: '#c678ff',
    blurb: 'The spire\'s armoured custodian. Slow, heavily plated, and furious once wounded.', ai: 'warden'
  }
};

const ABILITIES = [
  { id: 'strike', key: '1', name: 'Arc Blade', desc: 'Melee strike on an adjacent enemy for your full attack.', range: 1, cooldown: 0, action: true },
  { id: 'bolt', key: '2', name: 'Arc Bolt', desc: 'Ranged shot (3 hexes, needs line of sight) for attack −1. Cooldown 2 rounds.', range: 3, cooldown: 2, action: true, los: true },
  { id: 'kit', key: '3', name: 'Repair Kit', desc: 'Restore 5 HP. Uses your action and one kit.', cooldown: 0, action: true, item: 'kit' },
  { id: 'overclock', key: '4', name: 'Overclock', desc: 'Gain +2 movement this turn and reset the Arc Bolt. Free action. Cooldown 3 rounds.', cooldown: 3, action: false, locked: true }
];

const SHOP_ITEMS = [
  { id: 'plating', name: 'Suit plating', desc: '+2 maximum HP (and heals 2).', cost: 6, max: 4, apply: g => { g.player.maxHp += 2; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 2); } },
  { id: 'servos', name: 'Leg servos', desc: '+1 movement each turn.', cost: 8, max: 3, apply: g => { g.player.move += 1; } },
  { id: 'coil', name: 'Reflex coil', desc: '+1 initiative: act earlier in the round.', cost: 7, max: 3, apply: g => { g.player.init += 1; } },
  { id: 'edge', name: 'Blade edge', desc: '+1 attack for the Arc Blade and Arc Bolt.', cost: 9, max: 3, apply: g => { g.player.attack += 1; } },
  { id: 'overclock', name: 'Overclock module', desc: 'Unlocks ability 4: +2 movement and an instant bolt recharge.', cost: 10, max: 1, apply: g => { g.upgrades.overclock = 1; } },
  { id: 'kit', name: 'Repair kit', desc: 'A single-use kit for ability 3 (+5 HP).', cost: 4, max: 9, apply: g => { g.items.kit = (g.items.kit || 0) + 1; } }
];

/* Maps use odd-r offset rows: odd rows are shifted half a hex to the right.
   ~ sky  . deck  = catwalk  # cover  ^ steam vent  1-3 paired lift pads
   A-F quest markers  P courier  d drone  s scuttler  t turret  k skimmer  W warden
   $ shard pickup  @ quest item pickup */
const MAPS = [
  {
    id: 'harbour', name: 'Harbour Ring', subtitle: 'District one',
    palette: { deck: '#2b3a4a', deckLine: '#1b2733', catwalk: '#8a6a2e', glow: '#39ffb8', sky: '#4a5a6e' },
    intro: 'You have landed on the Harbour Ring with the micro-core the beacon needs. The Harbour Chief waits in the office on the east platform, but the patrol drones have stopped answering to anyone.',
    rows: [
      '~~~~~~~~~~~~~~~~',
      '~~..#....~~~~~~~',
      '~.P....d.~~~~~~~',
      '~..$.#...==~~~~~',
      '~~......d.==~~~~',
      '~~.#.$...^.A.~~~',
      '~~~==~~~..#..$~~',
      '~~~~=~~~.s...~~~',
      '~~~==~~~..#.^.~~',
      '~~~~.$~~~..B.~~~',
      '~~~~~~~~~~~~~~~~'
    ],
    markers: { A: { label: 'Harbour office', kind: 'console' }, B: { label: 'Foundry lift', kind: 'exit' } },
    startItems: [{ id: 'microcore', name: 'Micro-core' }],
    quests: [
      { id: 'h1', title: 'Deliver the micro-core', text: 'Carry the micro-core to the Harbour office.', type: 'deliver', item: 'microcore', at: 'A', done: 'The Chief takes the core. "It needs a lens and a bearing before the beacon will take it. The drones went feral last week; clear them and I\'ll open the lift."' },
      { id: 'h2', title: 'Cull the feral patrol', text: 'Disable every drone and scuttler on the Harbour Ring.', type: 'defeat', group: 'all', done: 'The ring falls quiet. The Foundry lift hums into life.' },
      { id: 'h3', title: 'Take the Foundry lift', text: 'Reach the lift on the south platform.', type: 'reach', at: 'B', done: 'The lift drops you into the heat of the Foundry Deck.' }
    ]
  },
  {
    id: 'foundry', name: 'Foundry Deck', subtitle: 'District two',
    palette: { deck: '#3d3028', deckLine: '#241a16', catwalk: '#7a5a2a', glow: '#ff9a3c', sky: '#5a4a46' },
    intro: 'Foreman Okoro\'s crucible has gone cold and the focusing lens is seized inside it. A coolant cell sits on the far island beyond the lift pad; the pump at the crucible needs it, and the scuttlers nesting in the grates need clearing.',
    rows: [
      '~~~~~~~~~~~~~~~~',
      '~~P..^..#~~~~~~~',
      '~....#.^.d~~~~~~',
      '~.$^....^..1~~~~',
      '~~..s..^.#..~~~~',
      '~~~#..^...~~~.$~',
      '~~~~~~~~~~~~1.~~',
      '~~~~~~~~~~~.@.t~',
      '~~~~~~~~~~..^s.~',
      '~~~~~~~~~~A.$.s~',
      '~~~~~~~~~~..B.~~'
    ],
    markers: { A: { label: 'Coolant pump', kind: 'console' }, B: { label: 'Observatory lift', kind: 'exit' } },
    items: { '@': { id: 'coolant', name: 'Coolant cell' } },
    quests: [
      { id: 'f1', title: 'Restart the coolant pump', text: 'Pick up the coolant cell on the far island and carry it to the pump.', type: 'deliver', item: 'coolant', at: 'A', done: 'The pump shudders and the crucible cools. Okoro prises the lens free and hands it over.' },
      { id: 'f2', title: 'Clear the grates', text: 'Disable every scuttler on the Foundry Deck.', type: 'defeat', group: 'scuttler', done: 'The grates are empty. Okoro waves you towards the Observatory lift.' },
      { id: 'f3', title: 'Ride to the Observatory', text: 'Reach the Observatory lift.', type: 'reach', at: 'B', done: 'Cool air and starlight. The Observatory Gardens.' }
    ]
  },
  {
    id: 'observatory', name: 'Observatory Gardens', subtitle: 'District three',
    palette: { deck: '#24383a', deckLine: '#152426', catwalk: '#6a7a4a', glow: '#8ad0ff', sky: '#44586a' },
    intro: 'Archivist Vey needs the beacon\'s bearing. The mirror console must be held while it calibrates, and the star-chart has been dropped somewhere near the old sentry post. Skimmers drift between the terraces, keeping their distance.',
    rows: [
      '~~~~~~~~~~~~~~~~',
      '~P...#..~~~.k..~',
      '~.....d.~~~..#.~',
      '~~.$..#.1~~2...~',
      '~~~.....~~~~.$.~',
      '~~~~=~~~~~~~~=~~',
      '~~~~=~~~~~~~~=~~',
      '~~~.A..=====.$1~',
      '~~..#.#..^..k.~~',
      '~~.@.t..#..d..~~',
      '~~~.$..2..B.C..~'
    ],
    markers: { A: { label: 'Mirror console', kind: 'console' }, B: { label: 'Archivist Vey', kind: 'npc' }, C: { label: 'Spire lift', kind: 'exit' } },
    items: { '@': { id: 'starchart', name: 'Star-chart' } },
    quests: [
      { id: 'o1', title: 'Reach the mirror console', text: 'Cross the catwalk to the mirror console on the lower terrace.', type: 'reach', at: 'A', done: 'The mirrors begin to turn. They will need three turns to settle.' },
      { id: 'o2', title: 'Hold the console', text: 'End your turn on the mirror console for 3 turns in a row.', type: 'hold', at: 'A', turns: 3, done: 'The mirrors lock on the beacon\'s bearing.' },
      { id: 'o3', title: 'Recover the star-chart', text: 'Find the star-chart near the sentry post and bring it to Archivist Vey.', type: 'deliver', item: 'starchart', at: 'B', done: '"Lens, bearing and core," Vey says, packing all three into your satchel; the Chief sent the micro-core up on the lift behind you. "The spire will fight you for them. Go."' },
      { id: 'o4', title: 'Ascend to the spire', text: 'Reach the spire lift.', type: 'reach', at: 'C', done: 'The lift climbs through the cloud deck towards the dark beacon.' }
    ]
  },
  {
    id: 'spire', name: 'Beacon Spire', subtitle: 'Finale',
    palette: { deck: '#2a2a44', deckLine: '#17172a', catwalk: '#6e5a8a', glow: '#c678ff', sky: '#3c3a5a' },
    intro: 'The beacon is a lattice of dead brass at the summit. Its Warden has not let anyone near the console since the light went out. Bring it down, then carry the core, lens and bearing to the console.',
    rows: [
      '~~~~~~~~~~~~~~~~',
      '~~~~~..P..~~~~~~',
      '~~~~.#....#.~~~~',
      '~~~..^.s..^..~~~',
      '~~~.=.~~~~.=.~~~',
      '~~..=..~~..=..~~',
      '~~.k.#..t.#...~~',
      '~~..$......$..~~',
      '~~~.#..W..#.~~~~',
      '~~~~..^A^..~~~~~',
      '~~~~~~~~~~~~~~~~'
    ],
    markers: { A: { label: 'Beacon console', kind: 'beacon' } },
    startItems: [{ id: 'microcore', name: 'Micro-core' }, { id: 'lens', name: 'Focusing lens' }, { id: 'bearing', name: 'Beacon bearing' }],
    quests: [
      { id: 's1', title: 'Bring down the Warden', text: 'Defeat the Beacon Warden guarding the summit.', type: 'defeat', group: 'warden', done: 'The Warden collapses in a shower of sparks. The console is unguarded.' },
      { id: 's2', title: 'Light the beacon', text: 'Carry the core, lens and bearing to the beacon console.', type: 'deliver', item: 'microcore', at: 'A', done: 'The beacon takes the core.' }
    ]
  }
];

const ENDING_LINES = [
  'The core seats itself with a sound like a struck bell.',
  'Light climbs the lattice, catches the lens, and swings onto the bearing the mirrors found.',
  'Far below, the cloud sea turns gold. Somewhere out there, a freighter changes course for home.'
];

const HELP_SECTIONS = [
  { title: 'Your turn', lines: [
    'Click a highlighted hex to move along the shown path. Each hex costs movement points; steam vents cost two and scald anyone stepping on them while they are venting.',
    'Click an adjacent enemy to strike it with the Arc Blade, or press 2 then click an enemy within three hexes and in line of sight to fire an Arc Bolt.',
    'You may move and take one action each turn, in either order. End the turn with Enter, Space or the button.'
  ] },
  { title: 'Terrain', lines: [
    'Deck plating is open ground. Catwalks leave you exposed: attacks against a unit on a catwalk deal one extra damage.',
    'Cargo cover blocks movement and line of sight; a unit standing next to cover takes one less damage from ranged attacks.',
    'Lift pads come in pairs and carry the courier to the matching pad, ending the move. Gold markers are quest objectives.'
  ] },
  { title: 'Enemies and rounds', lines: [
    'Every unit acts once per round in initiative order, shown in the bar at the top. Hover a portrait to see who it is.',
    'Drones patrol and flee when hurt, scuttlers charge, turrets snipe from a fixed spot, skimmers kite at range and the Warden simply advances.',
    'Shards pay for upgrades between districts. Progress is saved at the end of each of your turns.'
  ] }
];
