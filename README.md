# Skyworks Concourse

An isometric courier adventure that runs in the browser from a single `index.html`. Three decks of brass and glass hang over an endless cloud sea; the beacon that once guided every freighter home has gone dark, and you are carrying the micro‑core that can bring it back online.

Play it at <https://eoinfitzsimons.github.io/Skyworks-Concourse/>.

![Skyworks Concourse](thumbnail.png)

Every tile, building, character and cloud is drawn on a canvas in code, and every sound is synthesised with the Web Audio API. There are no image or audio files in the repository apart from the thumbnail, which is a screenshot of the game itself.

---

## The game

You are a courier who has just landed on the **Harbour Ring** with a micro‑core for the Harbour Chief. The beacon needs more than a core:

- **Harbour Ring** — deliver the core, cull the patrol drones, and calibrate three harmonic plates to raise the brass gate that seals the Observatory bridge. The Quartermaster's kiosk is here too.
- **Foundry Deck** — across the northern sky bridge. Foreman Okoro's crucible has gone cold; restart the three coolant pumps in the foundry buildings and lift the focusing lens free, while scuttlers charge along the grates.
- **Observatory Gardens** — through the harmonic gate. Archivist Vey has lost the star‑charts; recover the three fragments, read the headings, and turn the three mirrors until they agree.

With the core delivered, the lens fitted and the mirrors aligned, the beacon console will accept power. The ending sequence plays out on the deck and a summary of the run follows.

## How to play

| Key | Action |
|---|---|
| **W A S D** or **arrow keys** | Move |
| **E** | Interact: talk, use a console or pump, turn a mirror, set a plate, pick up an item, open the kiosk |
| **Space** | Strike with the arc blade (drones and scuttlers in reach) |
| **Q** | Show or hide the quest log |
| **N** | Show or hide the minimap |
| **M** | Sound on or off |
| **H** | Show or hide the controls card |
| **Esc** | Back to the title screen (progress is saved first) |

The mouse highlights the tile under the cursor. Clicking the **Save** pill stores progress straight away; the game also autosaves every twenty seconds, when a quest changes, when you enter a district and when you leave the kiosk.

### Tips

- Scuttlers stop and glow before they charge. Step aside and they hit the wall, where they are stunned and take double damage.
- Drones chase you across their own deck but will not follow you over a bridge.
- Floors change your handling: brass and bridge planks are quick, circuit decks are slightly quick, glass glides, rust and moss are slow.
- Shards are the currency. Each district holds several and every disabled enemy drops more. The Quartermaster sells plating, leg servos, arc‑blade levels, a cargo scanner for the minimap and single‑use repair kits.
- If your suit fails you can reload the last save from the game‑over screen.

## Features

- **Title screen** with a short introduction and a continue option for a saved run.
- **Three districts** on separate platforms joined by sky bridges, each with its own floor palette, building style, lighting colour and quest chain; a brass gate across one bridge is opened by the harmonic plates.
- **Nine quests** across story, puzzle, combat, exploration and collection types, listed in a quest log grouped by district.
- **Two enemy types**: hovering drones that patrol and chase, and scuttlers that telegraph a straight‑line charge and are stunned when they crash.
- **Shop and upgrades** bought with capacitor shards: suit plating, leg servos, arc blade, cargo scanner and repair kits.
- **Minimap** drawn in isometric projection from the tiles you have discovered, with markers for people, consoles, pickups and nearby enemies (and everything, once you own the scanner).
- **Save and load** through `localStorage`: the world is rebuilt from its seed and the quest state, inventory, upgrades, puzzle states, enemies, drops and discovered map are restored.
- **Ending sequence**: the beacon powers up, the camera closes in, the cloud sea lights, three lines of text play over the scene and a run summary follows.
- **Art drawn in code**: textured floor patterns, buildings with lit windows and roof detail, platform edges that drop away into the clouds, lamp posts, a lattice beacon tower, a three‑layer parallax cloud sea, per‑tile lighting with a lamp around the courier, and walls that turn translucent when you walk behind them.
- **Sound synthesised in the browser**: an ambient pad with a breathing filter and slow chord changes, band‑passed wind and occasional chimes, plus cues for strikes, hits, pickups, plates, the gate, pumps, district arrivals, purchases and the beacon. A mute toggle is remembered between visits.

## Running locally

The game is a static page with no build step.

```bash
git clone https://github.com/EoinFitzsimons/Skyworks-Concourse.git
cd Skyworks-Concourse
python3 -m http.server 8000
# open http://localhost:8000/
```

Opening `index.html` directly from the file system also works in current browsers. Audio starts after the first click on the title screen, which browsers require before they will play sound.

## Technical notes

- **Single file.** Markup, styles and about 1,700 lines of plain JavaScript live in `index.html`; there are no dependencies.
- **World generation.** A seeded `sfc32` generator and value noise build the three platforms, rails, bridges, non‑overlapping buildings with doors, floor variety and a static light map. Because everything derives from the seed, a saved run only needs to store the seed and the state that changed.
- **Rendering.** Floors are pre‑rendered once per type as diamond sprites and lit with a small set of shade sprites, so each visible tile costs two `drawImage` calls. Walls, rails and entities are merged into one list sorted by isometric depth so that buildings correctly occlude what stands behind them. Only tiles inside the camera view are drawn.
- **Lighting.** Each tile has an ambient level per district, boosted by emissive floors, lamps, pumps and the beacon, plus a dynamic lamp around the courier and a global lift when the beacon powers up.
- **Camera.** Smoothed follow with shake, a zoom used by the ending, and a conversion from canvas pixels to isometric tiles for the hover highlight.
- **Entities.** Small classes for the courier, drones, scuttlers (a four‑state machine: patrol, alert, charge, stunned), people, consoles, the beacon, plates, mirrors, the gate, pickups, crates and lamps. Collision is circle‑versus‑tile with solid entities pushed apart.
- **Audio.** One `AudioContext` with master, ambience and effects buses; oscillators, filtered noise buffers and gain envelopes make every cue.
- **Persistence.** `localStorage` key `skyworks.save.v2`; the discovered‑tile bitmap is packed into base64.

## Licence

MIT — see `LICENSE`.
