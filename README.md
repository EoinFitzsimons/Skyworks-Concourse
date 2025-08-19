
# Skyworks Concourse — Isometric JS Game

A browser‑playable, single‑file isometric game set in a retro‑futuristic cargo concourse suspended above the clouds. Explore modular buildings and corridors, complete multi‑type quests, dodge and disable drones, and bring the beacon online. All code, styles, and visuals are embedded in one `index.html`.

---

## Overview
- **Setting**: Brass catwalks, glass inlays, neon conduits, and circuit decks – clean, industrial, and optimistic.
- **Engine**: Custom JavaScript loop, input, camera, collision system (no external libraries required).
- **Procedural layout**: Structures (rooms + corridors) generated per run; themed floors apply movement effects.
- **Quests**: Story, Puzzle, Combat, Exploration, and Collection – finish them all to win.
- **Combat**: Melee strikes and roaming drones that can damage the player; health and game‑over state included.
- **Audio**: Optional generative synth background music.

---

## How to Run
1. Save the provided `index.html` to your machine.
2. Open it directly in any modern desktop browser (Chrome, Edge, Firefox, Safari).
   - No server required; everything is embedded in the file.

> Tip: If you resize the window, the game scales to fit. The mouse‑to‑tile selection remains aligned even when scaled.

---

## Controls
| Key | Action |
|---|---|
| **W / A / S / D** or **Arrow Keys** | Move |
| **E** | Interact (talk to NPC, use terminal, toggle puzzle plates, pick up shards) |
| **Space** | Attack (melee) |
| **Q** | Toggle Quest Log |
| **M** | Toggle ambient music on/off |

---

## Objectives & Progress
- **Story**
  - Find the **Harbor Chief** and deliver the micro‑core.
  - Energize the **Beacon Terminal**.
- **Puzzle**
  - Calibrate three harmonic **Switch Plates** to open the brass **Gate**.
- **Combat**
  - Disable the required number of **drones** patrolling the concourse.
- **Exploration**
  - Reveal 75% of the map via line‑of‑sight discovery.
- **Collection**
  - Gather all **Capacitor Shards** (they spawn on reachable tiles).

**Victory**: When all quests are complete, the **Departure Achieved** screen appears.  
**Game Over**: If your HP reaches zero, you’ll see **Systems Overload**.

---

## Floor Types & Movement Effects
Different deck materials subtly change how you move:
- **Steel**: Neutral baseline movement.
- **Brass**: +10% speed boost (catwalks & conduits).
- **Circuit**: +5% speed boost (power deck traces).
- **Glass**: Low friction; a gentle glide when changing direction.
- **Rust**: −15% speed (heavy, worn plates).
- **Walls**: Non‑walkable boundaries (room perimeters, rails, structure exteriors).

---

## Entities
- **Player**: HP bar, animated suit, melee attack with cooldown.
- **Drones**: Patrol/chase behavior; contact damage; can be disabled.
- **NPC (Harbor Chief)**: Dialogue and delivery target for the micro‑core.
- **Terminal (Beacon)**: Powers up for the story quest.
- **Switch Plates**: Puzzle toggles for the harmonic gate.
- **Gate**: Opens after plates are correctly set.
- **Crates**: Solid obstacles to route around.
- **Capacitor Shards**: Collectibles placed only on **reachable** tiles.

---

## Tips
- Floors subtly affect handling – brass and circuit are faster; rust slows; glass glides.
- Use corridors to funnel drones; your melee range is short, so close distance safely.
- If music does not start, press **M** or any key/click once (browsers require user interaction to start audio).

---

## Troubleshooting
- **Mouse/tile highlight misaligned?** Ensure the page zoom is 100%. The game accounts for CSS scaling, but browser zoom can still affect cursor accuracy on some systems.
- **Performance**: Close other heavy tabs, reduce the browser window size, or try a different browser.
- **Audio**: Browser autoplay policies may suspend audio; press **M** or click once to enable.

---

## License
You may modify and distribute this game with attribution. All code and procedurally generated visuals are embedded in the single HTML file you received.
