# Agent Command Center — Dashboard (Bloque 3)

Read-only visualizer for the OpenClaw AI-agent runtime that drives Javier
Cámara's "empresa virtual" (25 agents, 13 heartbeats, OpenRouter + Ollama).

This subdir (`openclawsetup/dashboard`) is the **Next.js app** that renders
agents as sprites in a pixel world and surfaces tasks / costs / conversations.
The agent runtime itself lives in `~/.openclaw/` on the Mac Mini and is
provisioned by the scripts in `../scripts/` and configs in `../config/`.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (app router, turbopack) | Latest stable as of April 2026 |
| Runtime | React 19 | Required by Next 16 |
| Styling | Tailwind CSS 4 | Installed via `@tailwindcss/postcss` plugin |
| UI primitives | shadcn/ui (new-york, neutral) | Copy-paste registry, no runtime dep |
| Charts | Recharts | Cost Center area/bar charts |
| Graphics | PixiJS 8 + @pixi/react | Pixel world canvas |
| State | Zustand | Tiny, no context boilerplate |
| Cache DB | Supabase (cloud hosted) | Write-through cache of gateway events |
| Auth to gateway | Ed25519 (tweetnacl) | Matches OpenClaw 2026.4.5 |
| WebSocket | browser-native + `ws` (server-side) | No socket.io |

## Architecture (one-liner)

```
Browser ──WS JSON-RPC──► OpenClaw gateway (ws://127.0.0.1:18789)
   │
   └──HTTPS──► Supabase cloud (historical cache, task board own-table)
```

OpenClaw is the **single source of truth** for agents, skills, sessions,
crons, costs, and conversations. This dashboard never mutates OpenClaw state
and never calls OpenRouter directly. Its only owned data is the `tasks` table
in Supabase.

## Development

```bash
# From openclawsetup/dashboard/
cp .env.local.example .env.local
# edit .env.local with your real Supabase keys

npm install
npm run dev          # http://localhost:3000
```

Requires Node.js 20.9+ (Javier runs 25.6.1; sandbox tested on 22.22.2).

## Project structure

```
src/
├── app/              Next.js App Router (pages + layouts)
├── lib/
│   ├── gateway/      OpenClaw WebSocket JSON-RPC client (FASE 2)
│   ├── supabase/     Browser + server Supabase clients (FASE 1)
│   ├── sprites/      Sprite manager for the pixel world (FASE 4.5)
│   └── utils.ts      shadcn cn() helper
├── components/
│   ├── ui/           shadcn primitives (run `npx shadcn add …`)
│   ├── pixel-world/  PixiJS canvas + agent sprites (FASE 5)
│   ├── task-board/   Kanban screen (FASE 6)
│   ├── cost-center/  Cost breakdown screen (FASE 6)
│   ├── comm-log/     Conversation stream screen (FASE 6)
│   ├── activity-feed/ Sidebar ticker (FASE 6)
│   └── layout/       App shell + header (FASE 6)
├── hooks/            Gateway React hooks (FASE 2)
├── store/            Zustand stores (FASE 2+)
└── types/            Shared TS types
```

## Adding shadcn components

The shadcn registry (`ui.shadcn.com/r/...`) was not reachable from the
sandbox where FASE 0 was scaffolded. On Javier's Mac, run:

```bash
cd dashboard
npx shadcn@latest add button card input badge tabs table dialog \
  dropdown-menu select separator sheet tooltip progress scroll-area avatar
```

The `components.json` is already configured (`new-york` style, `neutral` base
color, Lucide icons, CSS variables enabled).

## What's read-only vs owned

| Data | Source of truth | Dashboard access |
|---|---|---|
| Agents (25) | OpenClaw gateway | Read-only |
| Skills (50) | OpenClaw gateway | Read-only |
| Heartbeats (13) | OpenClaw gateway | Read-only |
| Sessions + messages | OpenClaw gateway | Read-only + cached in Supabase |
| Cost / usage | OpenClaw gateway | Read-only + cached in Supabase |
| Tasks (kanban) | **Supabase (dashboard-owned)** | Read/write |

## Attribution

See `NOTICE.md` for pixel art assets and architectural references.
