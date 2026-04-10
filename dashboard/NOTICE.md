# NOTICE

This project — the Agent Command Center dashboard (`openclawsetup/dashboard`)
— incorporates patterns, ideas, and (in FASE 4.5) pixel art assets from the
following third-party sources. All attributions listed here will be preserved
in any redistribution.

## Architectural reference

**`kirillkuzin/clawboard`** — <https://github.com/kirillkuzin/clawboard>

The WebSocket JSON-RPC client, Ed25519 device identity flow, and v3 canonical
auth-payload format used by this dashboard are **adapted from** the clawboard
project by kirillkuzin. No source files were copied; patterns were
reimplemented clean-room after reading clawboard's code as reference. Credit
is given for protocol reverse-engineering work.

clawboard's README and GitHub sidebar claim MIT license, but as of the time
of this writing the repository has no `LICENSE` file committed in tree. We
treat clawboard as reference material only and do not vendor any of its
code. If a `LICENSE` file is later committed upstream we will revisit whether
any direct code reuse is appropriate.

## Pixel art assets (FASE 4.5 — to be added)

Character and tileset sprites used in the pixel world will be derived from:

**`a16z-infra/ai-town`** — <https://github.com/a16z-infra/ai-town> (MIT)

Specifically: `public/assets/32x32folk.png` (32×32 top-down character
spritesheet with 4-direction × 3-frame walk cycles) and associated tilemap
JSON. The ai-town repository aggregates sprites originally published on
OpenGameArt.org and itch.io by the following artists, to whom credit is due:

- **George Bailey** — *16x16 Game Assets* (OpenGameArt.org)
- **hilau** — *16x16 RPG Tileset* (OpenGameArt.org)
- **ansimuz** — *Tiny RPG Forest* (OpenGameArt.org)
- **Mounir Tohami** — *Pixel Art GUI Elements* (itch.io)

Each of the OpenGameArt entries carries its own Creative Commons license
(typically CC-BY 3.0 or CC0). This NOTICE file will be updated with exact
license links once the assets are actually vendored into `public/sprites/`.

## Inspiration (no code or assets used)

**`joonspk-research/generative_agents`** — <https://github.com/joonspk-research/generative_agents>
(Apache 2.0)

The "AI Town / Smallville" visual concept that inspired this dashboard's
pixel-world UI comes from Joon Sung Park et al.'s UIST'23 generative agents
paper. No code or assets from this repository are used in this project.
(The generative_agents asset bundle includes a commercial "Cute RPG World"
pack with a separate paid license; we avoid the entire bundle for clarity.)
