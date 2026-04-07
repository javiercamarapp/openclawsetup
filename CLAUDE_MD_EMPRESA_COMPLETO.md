# CLAUDE.md — Agent Command Center (DASHBOARD LAYER)
# Claude Code: ejecuta fase por fase. No saltes fases. Cada checkpoint debe pasar.

## ⚠️ PRERREQUISITO OBLIGATORIO

**ANTES de empezar este CLAUDE.md, Javier debe tener OpenClaw instalado, corriendo, con los 50 skills cargados, y WhatsApp conectado.** Eso vive en un documento separado:

> **`OPENCLAW_INSTALL_GUIDE.md`** — ejecuta TODOS sus pasos primero (PASO 1 al PASO 10 + checkpoint final). Sin OpenClaw corriendo en `localhost:18789`, este dashboard no tiene de dónde leer datos.

Verificación previa: antes de FASE 0 de este archivo, confirma que:
```bash
openclaw gateway status                       # Runtime: running
curl -s http://localhost:18789/health          # {"status":"ok"}
ls ~/.openclaw/workspace/skills/*.md | wc -l   # 50
openclaw doctor                                # todo verde
```

Si algo de eso falla, **alto** y manda al usuario a ejecutar `OPENCLAW_INSTALL_GUIDE.md` primero.

## CONTEXTO
- Owner: Javier Cámara, Mérida, Yucatán, Mac Mini M4 16GB
- Proyecto: Dashboard de visualización ("empresa virtual" con pixel world) sobre OpenClaw
- Stack: Next.js 15 + PixiJS 8 + Supabase (cache local) + cliente OpenClaw HTTP/WebSocket
- Repo: `~/agent-command-center`
- **Source of truth de los 50 agentes**: OpenClaw (`~/.openclaw/workspace/skills/*.md`). Este dashboard NO redefine agentes ni los corre — solo los visualiza.

## ARQUITECTURA (post-decisión: OpenClaw runtime, dashboard visualizer)

```
┌────────────────────────────────────────────────────────┐
│ DASHBOARD (Next.js 15 — solo visualización)            │
│ ┌──────────────┐ ┌──────────┐ ┌──────────────────────┐│
│ │ Pixel World   │ │ Task     │ │ Stats / Costs /      ││
│ │ (PixiJS 8)    │ │ Board    │ │ Calendar / Config-RO ││
│ └──────┬───────┘ └────┬─────┘ └──────────┬───────────┘│
│        │              │                   │            │
│ ┌──────▼──────────────▼───────────────────▼──────────┐│
│ │ Supabase cache (read-side store)                    ││
│ │ tablas: world_events, conv_log, msg_log, costs_log, ││
│ │         tasks (única tabla "owned" por dashboard)   ││
│ └──────┬─────────────────────────────────────────────┘│
│        │                                              │
│ ┌──────▼─────────────────────────────────────────────┐│
│ │ OpenClaw Subscriber (WebSocket → INSERT en cache)   ││
│ └──────┬─────────────────────────────────────────────┘│
└────────▼──────────────────────────────────────────────┘
         │ ws://127.0.0.1:18789  +  HTTP localhost:18789
┌────────▼──────────────────────────────────────────────┐
│ OPENCLAW GATEWAY (single source of truth)             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 50 skills (~/.openclaw/workspace/skills/*.md)    │ │
│ │ heartbeats (~/.openclaw/heartbeats.json)         │ │
│ │ WhatsApp channel + cost tracking + LLM routing   │ │
│ └──────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       OpenRouter (cloud)          Ollama (local)
```

**Reglas duras** (Claude Code: no las violes):
1. El dashboard NO escribe en `~/.openclaw/`. Es read-only contra OpenClaw.
2. El dashboard NO define agentes propios. Si necesitas el roster, lo pides vía API a OpenClaw (`GET localhost:18789/skills`).
3. El dashboard NO llama OpenRouter directamente. Si quieres correr una conversación, le pides a OpenClaw que la corra (`POST localhost:18789/run`).
4. Las únicas escrituras del dashboard a su propia DB son: cache de eventos que llegan por WebSocket, y la tabla `tasks` (que es value-add del dashboard, OpenClaw no la tiene).

---

## FASE 0: SETUP INFRAESTRUCTURA

### Preguntar al usuario
- [ ] "¿Tienes Homebrew instalado? `brew --version`"
- [ ] "¿Confirmas que ya completaste **OPENCLAW_INSTALL_GUIDE.md** y `openclaw gateway status` reporta `Runtime: running`?"

### 0.1 — Instalar dependencias sistema
```bash
brew install node@22
# Redis y Ollama NO se instalan aquí — el dashboard no los usa directamente.
# OpenClaw ya gestiona Ollama (instalado en el install guide).
```

### 0.2 — (eliminada) Modelos Ollama
No aplica para el dashboard. Los modelos los descarga OpenClaw desde su propio install guide. El dashboard nunca llama Ollama directamente.

### 0.3 — Crear proyecto
```bash
cd ~
npx create-next-app@latest agent-command-center \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd agent-command-center
```

### 0.4 — Instalar dependencias
```bash
# UI
npx shadcn@latest init -d
npx shadcn@latest add card button input badge tabs table dialog \
  dropdown-menu select separator sheet tooltip progress scroll-area avatar

# Core
npm install @supabase/supabase-js @pixi/react pixi.js@^8.0.0 \
  zustand recharts lucide-react react-markdown ws
# NOTA: dropped @mastra/*, bullmq, ioredis, socket.io, node-cron — el dashboard NO orquesta
# nada (lo hace OpenClaw). Solo necesitamos: Supabase (cache), PixiJS (pixel world),
# Recharts (Cost Center), zustand (estado UI), ws (WebSocket subscriber al gateway).

# Dev
npm install -D @types/node @types/ws tsx
```

### 0.5 — Supabase local
```bash
npx supabase init
npx supabase start
# Anotar SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY del output
```

### 0.6 — Variables de entorno
```bash
cat > .env.local << 'EOF'
# Supabase local (cache del dashboard)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# OpenClaw Gateway (single source of truth — instalado vía OPENCLAW_INSTALL_GUIDE.md)
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_WS_URL=ws://127.0.0.1:18789/events
EOF
```
Pedir al usuario las keys de Supabase del output del paso 0.5 y reemplazar los `xxx`.

**No hay `OPENROUTER_API_KEY` aquí**: el dashboard no llama OpenRouter directo. Esa key vive en `~/.openclaw/openclaw.json` (configurada en el install guide).

### CHECKPOINT FASE 0
- [ ] `node --version` → v22+
- [ ] `redis-cli ping` → PONG
- [ ] `ollama list` → 3 modelos
- [ ] `npx supabase status` → running
- [ ] `npm run dev` → localhost:3000 carga

---

## FASE 1: BASE DE DATOS

### 1.1 — Schema (cache local del dashboard)

**Importante**: este schema NO es el "estado autoritativo" del sistema. OpenClaw es la fuente de verdad. Estas tablas son CACHES del dashboard alimentados por el subscriber de FASE 3, más una tabla `tasks` que es value-add del dashboard (OpenClaw no tiene tareas).

Crear `supabase/migrations/001_schema.sql`:

```sql
-- AGENT POSITIONS (cache local de los 50 sprites en el pixel world)
-- Una fila por skill de OpenClaw, con su posición pixel-world.
-- Se popula con `scripts/sync-agents.ts` (FASE 1.2) leyendo `GET /skills` de OpenClaw.
CREATE TABLE agent_positions (
  code VARCHAR(40) PRIMARY KEY,           -- mismo código que el skill OpenClaw (FORGE, HUNTER, ...)
  division INTEGER NOT NULL,
  division_name VARCHAR(50) NOT NULL,
  world_x DECIMAL(8,2) NOT NULL,
  world_y DECIMAL(8,2) NOT NULL,
  world_target_x DECIMAL(8,2) NOT NULL,
  world_target_y DECIMAL(8,2) NOT NULL,
  world_state VARCHAR(20) DEFAULT 'idle', -- idle | walking | talking | active
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATIONS LOG (cache de eventos `conversation_*` de OpenClaw)
CREATE TABLE conv_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openclaw_session_id VARCHAR(64),         -- correlation id que OpenClaw nos da
  agent_a_code VARCHAR(40),
  agent_b_code VARCHAR(40),
  trigger_type VARCHAR(20),                -- heartbeat | whatsapp | manual | ghost
  trigger_context TEXT,
  status VARCHAR(20) DEFAULT 'active',     -- active | completed
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  summary TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- MESSAGES LOG (cache de mensajes individuales)
CREATE TABLE msg_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conv_id UUID REFERENCES conv_log(id) ON DELETE CASCADE,
  speaker VARCHAR(40),                     -- agent code, or "JAVIER" for ghost
  role VARCHAR(20),                        -- agent_a | agent_b | javier
  content TEXT NOT NULL,
  model_used VARCHAR(100),
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS (la única tabla "owned" por el dashboard — no existe en OpenClaw)
-- Las tasks se crean cuando el dashboard parsea el output de una conversación
-- y detecta acciones explícitas. También se pueden crear manualmente desde la UI.
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conv_id UUID REFERENCES conv_log(id),
  assigned_to_code VARCHAR(40),            -- código del agente o NULL si es Javier
  assigned_to_javier BOOLEAN DEFAULT false,
  type VARCHAR(20) NOT NULL,               -- todo | decision | followup | deploy | alert
  priority VARCHAR(5) NOT NULL,            -- P0 | P1 | P2 | P3
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',    -- pending | in_progress | completed | cancelled
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY COSTS (cache; OpenClaw es la fuente, snapshot cada N minutos)
CREATE TABLE costs_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  agent_code VARCHAR(40),
  model VARCHAR(100),
  tokens_in BIGINT DEFAULT 0,
  tokens_out BIGINT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  UNIQUE(date, agent_code, model)
);

-- WORLD EVENTS (eventos del pixel world: agent_move, conv_start, conv_end, ghost_*)
-- Alimentado por el OpenClaw subscriber de FASE 3.
CREATE TABLE world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conv_log_status ON conv_log(status);
CREATE INDEX idx_msg_log_conv ON msg_log(conv_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_code);
CREATE INDEX idx_costs_log_date ON costs_log(date);
CREATE INDEX idx_world_events_created ON world_events(created_at);
```

```bash
npx supabase db push
```

### 1.2 — Sincronizar `agent_positions` desde OpenClaw

Crear `scripts/sync-agents.ts`. El script:
1. Hace `GET http://localhost:18789/skills` y obtiene los 50 skills (cada uno con name + division — puedes usar un mapeo division→number basado en el directorio o el frontmatter del skill).
2. Para cada skill, calcula una posición random dentro de la zona de su división y hace un upsert en `agent_positions`.

Las 8 zonas (mismo objeto `ZONES` que usa el sprite-factory en FASE 4.5):

```typescript
// scripts/sync-agents.ts
import { createClient } from '@supabase/supabase-js';

const ZONES: Record<number, { x: number; y: number; w: number; h: number; name: string }> = {
  1: { x: 20,  y: 30,  w: 195, h: 145, name: "Code Ops" },
  2: { x: 230, y: 30,  w: 220, h: 145, name: "Revenue Engine" },
  3: { x: 465, y: 30,  w: 130, h: 145, name: "Personal Brand" },
  4: { x: 610, y: 30,  w: 120, h: 145, name: "Ops & Finance" },
  5: { x: 20,  y: 200, w: 195, h: 135, name: "Product & Growth" },
  6: { x: 230, y: 200, w: 110, h: 135, name: "AI Operations" },
  7: { x: 355, y: 200, w: 150, h: 135, name: "Strategy" },
  8: { x: 520, y: 200, w: 210, h: 135, name: "Comms & Language" },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const res = await fetch('http://localhost:18789/skills');
  if (!res.ok) throw new Error(`OpenClaw /skills returned ${res.status}`);
  const skills: Array<{ name: string; division: number }> = await res.json();
  console.log(`Found ${skills.length} skills in OpenClaw`);

  for (const skill of skills) {
    const zone = ZONES[skill.division];
    if (!zone) {
      console.warn(`⚠️  ${skill.name}: unknown division ${skill.division}`);
      continue;
    }
    const x = zone.x + Math.random() * zone.w;
    const y = zone.y + Math.random() * zone.h;
    const { error } = await supabase.from('agent_positions').upsert({
      code: skill.name,
      division: skill.division,
      division_name: zone.name,
      world_x: x,
      world_y: y,
      world_target_x: x,
      world_target_y: y,
      world_state: 'idle',
    }, { onConflict: 'code' });
    if (error) console.error(`❌ ${skill.name}:`, error.message);
    else console.log(`✅ ${skill.name} → (${x.toFixed(0)}, ${y.toFixed(0)}) in ${zone.name}`);
  }
}
main().catch(console.error);
```

```bash
npx tsx scripts/sync-agents.ts
```

**Si OpenClaw no expone `/skills`** (depende de la versión), el script puede leer directamente `~/.openclaw/workspace/skills/*.md` con `fs.readdirSync` y parsear el frontmatter YAML. Claude Code: implementa el fallback solo si el primer intento falla con 404.

**Sobre las divisiones**: el directorio de skills de OpenClaw no tiene "división" como concepto built-in. La asignación división → skill vive en este dashboard, no en OpenClaw. Claude Code: hardcodea el mapeo de los 50 nombres → división dentro de `sync-agents.ts` (lista en orden: Code Ops 8, Revenue 10, Brand 5, Ops/Fin 7, Product 8, AI Ops 4, Strategy 5, Comms 3 = 50). Los nombres canónicos de los 50 skills están en `OPENCLAW_INSTALL_GUIDE.md` y en `MASTER_v6_FINAL (2).md` (solo como referencia — no copiar los system prompts ni los modelos, eso vive en OpenClaw).

### CHECKPOINT FASE 1
- [ ] `SELECT count(*) FROM agent_positions;` → 50
- [ ] `SELECT division, count(*) FROM agent_positions GROUP BY division ORDER BY division;` → 8,10,5,7,8,4,5,3
- [ ] Cada fila tiene `world_x`/`world_y` distintos de 0 (no hay sprites apilados en el origen)
- [ ] `SELECT count(*) FROM tasks;` → 0 (todavía no hay tareas, eso viene cuando empiecen a correr conversaciones)

---

## FASE 2: OPENCLAW CLIENT (read-only contra el Gateway)

El dashboard NO llama OpenRouter ni Ollama directamente. Toda la inteligencia (LLM routing, cost tracking, fallbacks, prompt caching) ya vive dentro de OpenClaw. El dashboard solo:
- **Lee** el estado de los skills, conversaciones activas, y métricas de costo
- **Pide** a OpenClaw correr una conversación específica (FASE 7 ghost mode)
- **No** mantiene su propia tabla de pricing ni de presupuestos

### 2.1 — Cliente HTTP del Gateway
Crear `src/lib/openclaw-client.ts`:

```typescript
const OC_BASE = process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789';

export interface Skill {
  name: string;             // "FORGE", "HUNTER", ...
  description: string;
  model: string;            // primary model from skill frontmatter
  fallbackModel?: string;
  triggers: string[];
  temperature: number;
  maxTokens: number;
}

export interface OpenClawConvSnapshot {
  sessionId: string;
  participants: string[];   // skill names
  status: 'active' | 'completed';
  startedAt: string;
  totalTokens: number;
  totalCost: number;
}

export interface OpenClawCostSnapshot {
  date: string;             // YYYY-MM-DD
  bySkill: Record<string, { tokensIn: number; tokensOut: number; cost: number; requests: number }>;
  byModel: Record<string, { tokensIn: number; tokensOut: number; cost: number }>;
  totalCost: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${OC_BASE}${path}`);
  if (!res.ok) throw new Error(`OpenClaw ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OC_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenClaw ${path} → ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Check the gateway is alive. */
export async function health(): Promise<{ status: string }> {
  return get('/health');
}

/** List all 50 skills loaded by OpenClaw. */
export async function listSkills(): Promise<Skill[]> {
  return get('/skills');
}

/** Get the active conversations right now. */
export async function listActiveConversations(): Promise<OpenClawConvSnapshot[]> {
  return get('/conversations?status=active');
}

/** Today's cost snapshot, broken down by skill and model. */
export async function getCostsToday(): Promise<OpenClawCostSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  return get(`/stats/costs?date=${today}`);
}

/**
 * Trigger OpenClaw to run a conversation. Used by Ghost Mode (FASE 7) when
 * Javier writes a message into an active conversation, and by manual UI runs.
 *
 * Returns the OpenClaw session id so the dashboard can correlate the events
 * that arrive via the WebSocket subscriber.
 */
export async function triggerRun(args: {
  skill: string;             // primary skill to invoke
  prompt: string;            // user input
  channel?: 'internal' | 'whatsapp';
  context?: Record<string, unknown>;
}): Promise<{ sessionId: string }> {
  return post('/run', args);
}

/**
 * Inject a Javier message into an existing conversation (ghost mode).
 * The skill on the other end will see it as the next user turn.
 */
export async function injectGhostMessage(args: {
  sessionId: string;
  text: string;
}): Promise<{ ok: true }> {
  return post('/ghost', args);
}
```

**Si OpenClaw no expone alguno de estos endpoints exactos** (depende de la versión instalada), Claude Code: corre `openclaw --help` y `curl -s localhost:18789/` para descubrir las rutas reales y ajustar este cliente. NO inventes endpoints. Si una ruta no existe, déjala como TODO con un comentario.

### 2.2 — Adapter de costos hacia el cache local
Crear `src/lib/cost-snapshot.ts`. Cada N segundos (default 60s), el dashboard hace `getCostsToday()` y actualiza la tabla `costs_log` para que las pantallas de Cost Center puedan hacer JOIN sin pegarle al gateway en cada render.

```typescript
import { createClient } from '@supabase/supabase-js';
import { getCostsToday } from './openclaw-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SNAPSHOT_INTERVAL_MS = 60_000;

export function startCostSnapshotter() {
  const tick = async () => {
    try {
      const snap = await getCostsToday();
      const date = snap.date;
      const rows = Object.entries(snap.bySkill).flatMap(([skill, agg]) => {
        return Object.entries(snap.byModel).map(([model, modelAgg]) => ({
          date,
          agent_code: skill,
          model,
          tokens_in: agg.tokensIn,
          tokens_out: agg.tokensOut,
          cost: agg.cost,
          request_count: agg.requests,
          error_count: 0,
        }));
      });
      // Simpler: one row per skill, model column = "*"
      const flatRows = Object.entries(snap.bySkill).map(([skill, agg]) => ({
        date, agent_code: skill, model: '*',
        tokens_in: agg.tokensIn, tokens_out: agg.tokensOut, cost: agg.cost,
        request_count: agg.requests, error_count: 0,
      }));
      await supabase.from('costs_log').upsert(flatRows, { onConflict: 'date,agent_code,model' });
    } catch (e) {
      console.error('[cost-snapshotter] failed:', (e as Error).message);
    }
  };
  tick();
  return setInterval(tick, SNAPSHOT_INTERVAL_MS);
}
```

Llama `startCostSnapshotter()` desde el bootstrap del dashboard (FASE 8 incluye el wiring exacto).

### CHECKPOINT FASE 2
- [ ] `curl -s localhost:18789/health` → `{"status":"ok"}` desde el lado de OpenClaw
- [ ] `npx tsx -e "import('./src/lib/openclaw-client.ts').then(m => m.health()).then(console.log)"` imprime el JSON
- [ ] `listSkills()` devuelve 50 skills
- [ ] `getCostsToday()` devuelve un objeto con `totalCost: number`, aunque sea $0
- [ ] La tabla `costs_log` recibe filas tras correr el snapshotter por 1 minuto

---

## FASE 3: OPENCLAW EVENT SUBSCRIBER

OpenClaw corre las conversaciones reales (LLM calls, fallbacks, cost tracking, prompt caching). El dashboard solo se SUSCRIBE a los eventos que OpenClaw emite por su WebSocket y los proyecta a las tablas de cache (`conv_log`, `msg_log`, `world_events`).

### 3.1 — Mapping de eventos de OpenClaw

OpenClaw emite eventos en el WebSocket en este formato (verificar contra el dashboard built-in en `localhost:18789` o `openclaw events --tail`):

```jsonc
{ "type": "conversation.started",  "sessionId": "...", "skill": "HUNTER",
  "trigger": "heartbeat",          "timestamp": "2026-04-07T..." }
{ "type": "conversation.message",  "sessionId": "...", "skill": "HUNTER",
  "role": "agent", "content": "...", "model": "x-ai/grok-4.1-fast",
  "tokensIn": 120, "tokensOut": 80, "cost": 0.00006, "latencyMs": 850 }
{ "type": "conversation.handoff",  "sessionId": "...", "from": "HUNTER", "to": "FILTER" }
{ "type": "conversation.completed","sessionId": "...", "summary": "...", "totalCost": 0.0003 }
{ "type": "agent.error",           "skill": "...", "error": "...", "model": "..." }
```

Si el formato real difiere, Claude Code: ajusta el mapping pero mantén los mismos nombres de columna en `world_events.payload` (lo consume el pixel world en FASE 5).

### 3.2 — Subscriber WebSocket
Crear `src/lib/openclaw-subscriber.ts`:

```typescript
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OC_WS = process.env.OPENCLAW_WS_URL || 'ws://127.0.0.1:18789/events';

let ws: WebSocket | null = null;
let reconnectDelay = 1000;

export function startOpenClawSubscriber() {
  function connect() {
    console.log(`[oc-sub] connecting to ${OC_WS}...`);
    ws = new WebSocket(OC_WS);

    ws.on('open', () => {
      console.log('[oc-sub] connected');
      reconnectDelay = 1000; // reset backoff
    });

    ws.on('message', async (raw) => {
      let evt: any;
      try { evt = JSON.parse(raw.toString()); } catch { return; }
      try { await handleEvent(evt); } catch (e) {
        console.error('[oc-sub] handler failed:', (e as Error).message, evt);
      }
    });

    ws.on('close', () => {
      console.warn(`[oc-sub] disconnected, retrying in ${reconnectDelay}ms`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000); // exponential backoff, cap 30s
    });

    ws.on('error', (e) => console.error('[oc-sub] socket error:', e.message));
  }
  connect();
}

async function handleEvent(evt: any) {
  switch (evt.type) {
    case 'conversation.started': {
      const { error } = await supabase.from('conv_log').insert({
        openclaw_session_id: evt.sessionId,
        agent_a_code: evt.skill,
        trigger_type: evt.trigger ?? 'unknown',
        status: 'active',
      });
      if (error) throw error;
      await supabase.from('world_events').insert({
        event_type: 'conversation_start',
        payload: { sessionId: evt.sessionId, agent: evt.skill },
      });
      // Mark agent as 'talking' in agent_positions
      await supabase.from('agent_positions').update({ world_state: 'talking' }).eq('code', evt.skill);
      break;
    }
    case 'conversation.message': {
      // Lookup the conv id by openclaw_session_id (cache could optimize this)
      const { data: conv } = await supabase
        .from('conv_log')
        .select('id')
        .eq('openclaw_session_id', evt.sessionId)
        .single();
      if (!conv) return;
      await supabase.from('msg_log').insert({
        conv_id: conv.id,
        speaker: evt.skill,
        role: evt.role === 'javier' ? 'javier' : 'agent_a',
        content: evt.content,
        model_used: evt.model,
        tokens_in: evt.tokensIn ?? 0,
        tokens_out: evt.tokensOut ?? 0,
        cost: evt.cost ?? 0,
        latency_ms: evt.latencyMs ?? 0,
      });
      // Bump conv totals
      await supabase.rpc('bump_conv_totals', {
        p_conv_id: conv.id,
        p_tokens: (evt.tokensIn ?? 0) + (evt.tokensOut ?? 0),
        p_cost: evt.cost ?? 0,
      });
      break;
    }
    case 'conversation.handoff': {
      await supabase.from('world_events').insert({
        event_type: 'agent_move',
        payload: { from: evt.from, to: evt.to, sessionId: evt.sessionId },
      });
      // Both skills enter walking state for the pixel world animation
      await supabase.from('agent_positions').update({ world_state: 'walking' })
        .in('code', [evt.from, evt.to]);
      break;
    }
    case 'conversation.completed': {
      await supabase.from('conv_log')
        .update({ status: 'completed', summary: evt.summary, total_cost: evt.totalCost, ended_at: new Date().toISOString() })
        .eq('openclaw_session_id', evt.sessionId);
      await supabase.from('world_events').insert({
        event_type: 'conversation_end',
        payload: { sessionId: evt.sessionId, summary: evt.summary },
      });
      // Optionally: parse evt.summary for tasks. For now, leave that to a separate
      // task-extractor (can be its own micro-skill in OpenClaw, or a dashboard cron).
      break;
    }
    case 'agent.error': {
      await supabase.from('world_events').insert({
        event_type: 'agent_error',
        payload: { skill: evt.skill, error: evt.error, model: evt.model },
      });
      break;
    }
    default:
      // Unknown event type — log but don't crash
      console.debug('[oc-sub] unhandled event type:', evt.type);
  }
}
```

### 3.3 — RPC helper en Supabase
```sql
CREATE OR REPLACE FUNCTION bump_conv_totals(p_conv_id UUID, p_tokens INT, p_cost NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE conv_log SET
    total_tokens = total_tokens + p_tokens,
    total_cost = total_cost + p_cost
  WHERE id = p_conv_id;
END;
$$ LANGUAGE plpgsql;
```

### 3.4 — Instalar dependencia `ws`
```bash
npm install ws
npm install -D @types/ws
```

### CHECKPOINT FASE 3
- [ ] `startOpenClawSubscriber()` se conecta a `ws://127.0.0.1:18789/events` sin error
- [ ] Disparar manualmente una conversación: `curl -X POST localhost:18789/run -d '{"skill":"HUNTER","prompt":"test"}'`
- [ ] Aparece una fila nueva en `conv_log` con `status='active'`
- [ ] Aparecen rows en `msg_log` con el contenido real
- [ ] Cuando termina, `conv_log.status` cambia a `completed` y `total_cost` se llena
- [ ] `world_events` tiene `conversation_start` y `conversation_end` con el `sessionId`

---

## FASE 4: ORCHESTRATOR — DELEGADO A OPENCLAW

**No hay nada que construir en esta fase del lado del dashboard.** OpenClaw ya tiene todo lo que antes íbamos a construir aquí:

| Antes (dashboard runtime) | Ahora (OpenClaw runtime) |
|---|---|
| `src/lib/scheduler.ts` con node-cron | `~/.openclaw/heartbeats.json` (PASO 7 del install guide) |
| `src/lib/event-bus.ts` con BullMQ | OpenClaw event loop interno |
| `src/lib/trigger-rules.ts` con handoffs | Skill-to-skill triggers configurables en cada `.md` skill file |
| `runConversation()` orquestando turnos | OpenClaw runtime |

### 4.1 — Verificar heartbeats activos en OpenClaw
```bash
openclaw heartbeats list      # debe imprimir los 13 heartbeats del install guide
openclaw heartbeats status    # último run + próximo run de cada uno
```

Si faltan heartbeats, edita `~/.openclaw/heartbeats.json` y corre `openclaw gateway restart`. Los 13 schedules canónicos están en `OPENCLAW_INSTALL_GUIDE.md` PASO 7.

### 4.2 — Trigger rules entre skills (OpenClaw nativo)
Las cadenas tipo HUNTER→FILTER→PLUMA→PROPUESTA se modelan dentro de los propios skill files de OpenClaw — cada skill tiene un campo `nextSkill` o `triggers` opcional en su frontmatter. NO duplicar esa lógica en el dashboard.

Si Claude Code necesita ver cómo se configuran handoffs en skill files, leer la sección de PASO 6 del install guide y los ejemplos de skill files generados ahí.

### CHECKPOINT FASE 4
- [ ] `openclaw heartbeats list` → imprime 13 heartbeats
- [ ] Espera 5 minutos → el evento `conversation.started` para WATCHTOWER llega al subscriber de FASE 3 (verificar `SELECT * FROM conv_log ORDER BY started_at DESC LIMIT 5`)
- [ ] No hay node-cron, BullMQ, ni trigger-rules.ts en el repo del dashboard (verificar `grep -r "node-cron\|BullMQ\|trigger-rules" src/` → vacío)

---

## FASE 4.5: SPRITE FACTORY (assets procedurales para FASE 5)

**Por qué existe esta fase**: FASE 5 (Pixel World) necesita 50 sprites pixel-art, uno por agente. En lugar de descargar/comprar un sprite sheet externo, los generamos en código con primitivas de PixiJS. Cero dependencias externas, cero trabajo de assets, y cada agente queda con el color de su división automáticamente.

### 4.5.1 — Sprite factory
Crear `src/components/pixel-world/sprite-factory.ts`:

```typescript
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

// 8 colores de división (deben coincidir con BLUEPRINT_DASHBOARD)
export const DIVISION_COLORS: Record<number, number> = {
  1: 0x06b6d4, // CODE OPS — cyan
  2: 0x10b981, // REVENUE — green
  3: 0x8b5cf6, // BRAND — violet
  4: 0xf59e0b, // OPS/FIN — amber
  5: 0xec4899, // PRODUCT — pink
  6: 0xf97316, // AI OPS — orange
  7: 0x3b82f6, // STRATEGY — blue
  8: 0xa855f7, // COMMS — purple
};

const SKIN = 0xf5deb3;
const NAME_STYLE = new TextStyle({
  fontFamily: 'Inter, sans-serif',
  fontSize: 7,
  fontWeight: '600',
  fill: 0x111827,
  align: 'center',
});

export interface AgentSprite extends Container {
  agentCode: string;
  division: number;
  legs: Graphics;
  body: Graphics;
  head: Graphics;
  nameLabel: Text;
  walkFrame: number;
  speechBubble?: Container;
}

/**
 * Build a 12×16px pixel character (rendered at 2x scale = 24×32 on screen).
 *  - Head 4×4 (skin tone)
 *  - Body 4×8 (division color)
 *  - Legs 2×4 (alternate frames for walk animation)
 *  - Name label below in 7px Inter
 */
export function createAgentSprite(code: string, division: number): AgentSprite {
  const container = new Container() as AgentSprite;
  container.agentCode = code;
  container.division = division;
  container.walkFrame = 0;

  const color = DIVISION_COLORS[division] ?? 0x6b7280;

  // Head 4×4
  const head = new Graphics().rect(4, 0, 4, 4).fill(SKIN);
  // Body 4×8
  const body = new Graphics().rect(4, 4, 4, 8).fill(color);
  // Legs 2×4 (frame 0)
  const legs = new Graphics()
    .rect(4, 12, 2, 4).fill(color)
    .rect(6, 12, 2, 4).fill(color);

  container.head = head;
  container.body = body;
  container.legs = legs;
  container.addChild(legs, body, head);

  // Scale 2x for screen visibility
  container.scale.set(2);

  // Name label
  const label = new Text({ text: code, style: NAME_STYLE });
  label.anchor.set(0.5, 0);
  label.position.set(8, 17);   // centered below feet
  label.scale.set(0.5);        // counter-scale to keep text crisp
  container.nameLabel = label;
  container.addChild(label);

  return container;
}

/**
 * Cycle through 2 walk frames. Call from your animation tick (every 8 frames or so).
 */
export function tickWalkAnimation(sprite: AgentSprite) {
  sprite.walkFrame = (sprite.walkFrame + 1) % 2;
  sprite.legs.clear();
  const color = DIVISION_COLORS[sprite.division] ?? 0x6b7280;
  if (sprite.walkFrame === 0) {
    sprite.legs.rect(4, 12, 2, 4).fill(color).rect(6, 12, 2, 4).fill(color);
  } else {
    sprite.legs.rect(4, 13, 2, 3).fill(color).rect(6, 11, 2, 4).fill(color);
  }
}

/**
 * Show a speech bubble above the sprite while it "talks".
 * The bubble auto-attaches as a child container and follows the sprite.
 */
export function showSpeechBubble(sprite: AgentSprite, text: string) {
  hideSpeechBubble(sprite);
  const bubble = new Container();

  const bg = new Graphics()
    .roundRect(-2, -10, Math.max(40, text.length * 3), 8, 2)
    .fill(0xffffff)
    .stroke({ color: 0xe5e7eb, width: 0.5 });

  const txt = new Text({
    text: text.length > 30 ? text.slice(0, 27) + '…' : text,
    style: new TextStyle({ fontFamily: 'Inter', fontSize: 5, fill: 0x111827 }),
  });
  txt.position.set(0, -9);

  bubble.addChild(bg, txt);
  sprite.addChild(bubble);
  sprite.speechBubble = bubble;
}

export function hideSpeechBubble(sprite: AgentSprite) {
  if (sprite.speechBubble) {
    sprite.removeChild(sprite.speechBubble);
    sprite.speechBubble.destroy({ children: true });
    sprite.speechBubble = undefined;
  }
}
```

### 4.5.2 — Test rápido del sprite factory
Crear `scripts/test-sprite.ts`:

```typescript
import { Application } from 'pixi.js';
import { createAgentSprite } from '../src/components/pixel-world/sprite-factory';

const app = new Application();
await app.init({ width: 800, height: 400, background: 0xffffff });

// Render one sprite per division to verify all 8 colors work
const codes = ['APEX', 'HUNTER', 'SOCIAL', 'LEDGER', 'PRODUCTO', 'ROUTER', 'COMPETE', 'DIGEST'];
codes.forEach((code, i) => {
  const sprite = createAgentSprite(code, i + 1);
  sprite.position.set(40 + i * 90, 100);
  app.stage.addChild(sprite);
});
console.log('✅ 8 sprites rendered, one per division');
```

### CHECKPOINT FASE 4.5
- [ ] `src/components/pixel-world/sprite-factory.ts` creado
- [ ] `npx tsx scripts/test-sprite.ts` corre sin errores
- [ ] FASE 5 puede importar `createAgentSprite` y construir los 50 personajes
- [ ] Cada división tiene un color distinto y visible

---

## FASE 5: PIXEL WORLD (PixiJS)

El pixel world es 100% una capa de visualización. Su única fuente de datos es:
1. `agent_positions` (50 filas, posiciones iniciales de FASE 1.2)
2. `world_events` (alimentado por el subscriber de FASE 3 — agent_move, conversation_start, conversation_end, ghost_*)

NO inventes movimientos ni conversaciones aquí. Si OpenClaw no manda un evento, los sprites están idle.

### 5.1 — Componente React principal
Crear `src/components/pixel-world/PixelWorld.tsx`:

Responsabilidades:
- Renderiza un canvas PixiJS de **750×380** dentro de un contenedor `<div ref={canvasRef} />`.
- Al montar: lee `agent_positions` (50 filas) y crea un sprite por cada uno usando `createAgentSprite()` de FASE 4.5. Los posiciona en `world_x`/`world_y`.
- Dibuja las 8 zonas de división con borde dashed (mismas dimensiones que `ZONES` en FASE 1.2 / FASE 4.5).
- Se suscribe a Supabase Realtime para `world_events` y aplica handlers según el `event_type`.
- Tween de movimiento usando `requestAnimationFrame` con interpolación lineal entre `world_x/y` actual y `world_target_x/y`.

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { createClient } from '@supabase/supabase-js';
import { createAgentSprite, tickWalkAnimation, showSpeechBubble, hideSpeechBubble, type AgentSprite } from './sprite-factory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ZONES = [ /* same 8 zones from FASE 1.2 + FASE 4.5 */ ];

export function PixelWorld() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let app: Application | null = null;
    const sprites = new Map<string, AgentSprite>();
    let cancelled = false;

    (async () => {
      app = new Application();
      await app.init({ width: 750, height: 380, background: 0xffffff, antialias: false });
      if (cancelled) { app.destroy(true); return; }
      ref.current!.appendChild(app.canvas);

      // 1) Draw zones
      const zonesLayer = new Container();
      for (const z of ZONES) {
        const g = new Graphics()
          .rect(z.x, z.y, z.w, z.h)
          .stroke({ color: 0xe5e7eb, width: 1, alpha: 0.6 });
        zonesLayer.addChild(g);
      }
      app.stage.addChild(zonesLayer);

      // 2) Load 50 agents from cache
      const { data: agents } = await supabase.from('agent_positions').select('*');
      for (const a of agents ?? []) {
        const s = createAgentSprite(a.code, a.division);
        s.position.set(a.world_x, a.world_y);
        (s as any).targetX = a.world_x;
        (s as any).targetY = a.world_y;
        app.stage.addChild(s);
        sprites.set(a.code, s);
      }

      // 3) Subscribe to world_events
      const channel = supabase.channel('world')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'world_events' },
            (payload) => handleEvent(payload.new as any, sprites))
        .subscribe();

      // 4) Animation tick
      let frame = 0;
      app.ticker.add(() => {
        frame++;
        for (const s of sprites.values()) {
          // Lerp toward target
          const dx = (s as any).targetX - s.position.x;
          const dy = (s as any).targetY - s.position.y;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            s.position.x += dx * 0.05;
            s.position.y += dy * 0.05;
            if (frame % 8 === 0) tickWalkAnimation(s);
          }
        }
      });

      return () => { channel.unsubscribe(); };
    })();

    return () => { cancelled = true; app?.destroy(true); };
  }, []);

  return <div ref={ref} className="border border-slate-200 rounded-lg overflow-hidden" />;
}

function handleEvent(evt: { event_type: string; payload: any }, sprites: Map<string, AgentSprite>) {
  switch (evt.event_type) {
    case 'conversation_start': {
      const s = sprites.get(evt.payload.agent);
      if (s) {
        s.tint = 0xffffff;
        showSpeechBubble(s, '...');
      }
      break;
    }
    case 'conversation_end': {
      const s = sprites.get(evt.payload.agent);
      if (s) hideSpeechBubble(s);
      break;
    }
    case 'agent_move': {
      // OpenClaw signaled a handoff: walk `from` toward `to`
      const from = sprites.get(evt.payload.from);
      const to = sprites.get(evt.payload.to);
      if (from && to) {
        (from as any).targetX = (from.position.x + to.position.x) / 2;
        (from as any).targetY = (from.position.y + to.position.y) / 2;
      }
      break;
    }
    case 'ghost_join':
    case 'ghost_leave': {
      // Handled by FASE 7 ghost-mode UI
      break;
    }
  }
}
```

### 5.2 — Sprite factory
**Ya construido en FASE 4.5** (`src/components/pixel-world/sprite-factory.ts`). Importarlo directamente. NO crear `sprites.ts` nuevo — eso sería duplicación.

### 5.3 — Map renderer
Mantener simple por ahora: solo zonas con borde, sin escritorios ni decoración. Si en el futuro Javier quiere más detalle, se agrega un layer más en `PixelWorld.tsx`.

### CHECKPOINT FASE 5
- [ ] `<PixelWorld />` montado en `/` renderiza canvas 750×380
- [ ] 50 sprites visibles, distribuidos en sus 8 zonas (no apilados en 0,0)
- [ ] Cada sprite tiene su nombre debajo + color de su división
- [ ] Animación de caminata se activa cuando un sprite tiene un target distinto a su posición actual
- [ ] Insertar manualmente un evento de prueba: `INSERT INTO world_events (event_type, payload) VALUES ('conversation_start', '{"agent":"HUNTER"}'::jsonb);` → HUNTER muestra burbuja de speech

---

## FASE 6: DASHBOARD SCREENS

5 pantallas. Cada una lee de una combinación de: caches Supabase locales (rápido) + OpenClaw HTTP (truth, lento).

### 6.1 — Layout principal
`src/app/page.tsx` — Tabs: **World | Tasks | Costs | Calendar | Config**. La tab World es default y contiene `<PixelWorld />` + sidebar `CommLog`.

### 6.2 — Tasks Board
`src/app/tasks/page.tsx`:
- Datos: tabla local `tasks` (la única tabla "owned" por el dashboard)
- 4 columnas kanban: Pending / In Progress / Waiting Javier / Done
- Drag & drop entre columnas → `UPDATE tasks SET status=...`
- Badge de prioridad: 🔴P0 / 🟠P1 / 🟡P2 / 🟢P3
- Filtros: por agente (`assigned_to_code`), por prioridad, "solo mías" (assigned_to_javier=true)
- **Crear tarea manual**: botón "+" abre form. Esto es el ÚNICO punto donde el dashboard escribe a tasks (además del task-extractor automático del subscriber).

### 6.3 — Cost Center
`src/app/costs/page.tsx`:
- Datos: tabla local `costs_log` (alimentada cada 60s por el snapshotter de FASE 2.2)
- KPIs top: Monthly total ($X/$200) · Today · Budget remaining · Projected EOM
- Gráfica de costo diario (Recharts area chart, últimos 30 días)
- Top 5 agentes más caros (`SELECT agent_code, SUM(cost) FROM costs_log WHERE date >= ... GROUP BY 1 ORDER BY 2 DESC LIMIT 5`)
- Costo por modelo (group by `model`)
- **Botón "Refresh from OpenClaw now"**: dispara `getCostsToday()` síncrono, no espera al snapshotter

### 6.4 — Calendar (read-only de OpenClaw heartbeats)
`src/app/calendar/page.tsx`:
- Datos: `GET http://localhost:18789/heartbeats` (read-only, NO permitimos editar desde el dashboard)
- Vista semanal con los 13 heartbeats: cada slot muestra agente, hora, descripción, próxima ejecución
- Status: ✅ enabled / ⏸ paused (paused se gestiona vía `openclaw heartbeats pause <name>` desde terminal — el dashboard solo lo refleja)
- **NOTA al usuario** en la página: "Para editar heartbeats, edita `~/.openclaw/heartbeats.json` y corre `openclaw gateway restart`. El dashboard es read-only para evitar drift."

### 6.5 — Config (read-only de skills + editor de cache local)
`src/app/config/page.tsx`:
- **Sección 1: Skills (read-only)**: Tabla con los 50 skills de OpenClaw (`listSkills()`). Columnas: code, model, fallbackModel, temperature, maxTokens. Sin botones de edit. Texto explicativo: "Para cambiar el modelo o prompt de un skill, edita `~/.openclaw/workspace/skills/<name>.md` y corre `openclaw gateway restart`."
- **Sección 2: Dashboard settings (editable)**: Polling intervals (cost snapshotter), tema dark/light, ancho del pixel world. Estas viven en localStorage o una tabla `dashboard_settings`.
- ❌ NO hay editor de budget per-agent en el dashboard. OpenClaw maneja sus propios límites de presupuesto via su config.

### 6.6 — Comm Log (sidebar del pixel world)
Componente embebido en la tab World:
- Lista de conversaciones del día (`SELECT * FROM conv_log WHERE started_at >= today() ORDER BY started_at DESC`)
- Click expande los mensajes (`SELECT * FROM msg_log WHERE conv_id = ?`)
- Filter por estado (active/completed) y por agente

### CHECKPOINT FASE 6
- [ ] 5 pantallas renderizan
- [ ] Tasks: drag & drop entre columnas persiste en `tasks.status`
- [ ] Costs: gauge de budget muestra `SUM(cost)` real del mes
- [ ] Calendar: lista los 13 heartbeats con sus crons (datos vienen de OpenClaw, no de DB local)
- [ ] Config: muestra los 50 skills sin permitir editarlos (textos read-only)
- [ ] Comm Log: una conversación que disparas con `openclaw test --skill forge "test"` aparece en el sidebar dentro de 2 segundos

---

## FASE 6.5: ELIMINADA

La instalación de OpenClaw vive ahora en un documento separado: **`OPENCLAW_INSTALL_GUIDE.md`**. Es prerrequisito de TODO este CLAUDE.md (ver el banner al inicio del archivo), no solo de FASE 7. Si llegaste a esta sección sin haber completado el install guide, **alto** y regrésate.

---

## FASE 7: GHOST MODE

**WhatsApp ya no vive aquí.** OpenClaw maneja WhatsApp nativamente como channel. Si Javier quiere recibir notificaciones de tasks o decisiones por WhatsApp, eso se configura como un heartbeat o trigger DENTRO de OpenClaw — no con código del dashboard. Esta fase es solo Ghost Mode.

### 7.1 — Ghost mode (UI)
En `src/components/pixel-world/GhostInput.tsx`:
- Click en conversación activa (sprite con burbuja) en `PixelWorld` → emite evento React `onConversationClick(sessionId, agentCode)`
- El padre muestra `<GhostInput sessionId={...} agent={...} />` debajo del canvas
- El input dispara `injectGhostMessage({ sessionId, text })` del cliente OpenClaw (FASE 2)
- OpenClaw recibe el mensaje y lo inyecta en la conversación; el subscriber (FASE 3) verá un nuevo `conversation.message` con `role: 'javier'`
- Avatar semi-transparente "JAVIER" aparece junto a los sprites que conversan (Container nuevo en PixelWorld con `alpha: 0.5`)
- Se desvanece después de 30s sin actividad de Javier

```typescript
// src/components/pixel-world/GhostInput.tsx
'use client';
import { useState } from 'react';
import { injectGhostMessage } from '@/lib/openclaw-client';

export function GhostInput({ sessionId, agent }: { sessionId: string; agent: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await injectGhostMessage({ sessionId, text });
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-200 p-3 flex gap-2">
      <span className="text-xs text-blue-600 font-semibold">JAVIER →</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        placeholder={`Escribir en la conversación con ${agent}...`}
        className="flex-1 text-sm bg-transparent outline-none"
        disabled={busy}
      />
    </div>
  );
}
```

### 7.2 — Ghost avatar en pixel world
En `PixelWorld.tsx`, agrega un Container "ghost" que aparece cuando recibe el evento `ghost_join` y desaparece con `ghost_leave`. Estos eventos los puede emitir el dashboard cuando Javier abre/cierra el GhostInput, escribiendo a `world_events` directamente:

```typescript
// Cuando se monta GhostInput:
await supabase.from('world_events').insert({
  event_type: 'ghost_join',
  payload: { sessionId, agent }
});
// Cuando se desmonta o pasa el timeout:
await supabase.from('world_events').insert({
  event_type: 'ghost_leave',
  payload: { sessionId }
});
```

Esto es una de las pocas excepciones donde el dashboard escribe a su propia tabla de eventos directamente (sin pasar por OpenClaw), porque el ghost es una concepción del dashboard, no de OpenClaw.

### CHECKPOINT FASE 7
- [ ] Click en una conversación activa muestra el input de Javier
- [ ] Enviar texto → llega un nuevo `msg_log` con `role='javier'` (verificar con SQL)
- [ ] La conversación de OpenClaw incorpora el mensaje y los siguientes turnos lo referencian
- [ ] Avatar semi-transparente aparece en el pixel world cerca del agente
- [ ] Después de 30s sin actividad, el avatar desaparece

---

## FASE 8: AUTO-START + POLISH (solo el dashboard)

OpenClaw ya tiene su propio daemon (instalado con `openclaw onboard --install-daemon` en el install guide). Aquí solo registramos el dashboard Next.js para que también arranque al boot.

### 8.1 — Start script (solo dashboard)
```bash
cat > ~/start-dashboard.sh << 'EOF'
#!/bin/bash
# OpenClaw daemon ya está corriendo (su propio LaunchAgent del install guide).
# Aquí solo arrancamos el dashboard Next.js.
cd ~/agent-command-center
npx supabase start
npm run build
npm start &
echo "🦞 Dashboard: http://localhost:3000   (OpenClaw dashboard built-in: http://localhost:18789)"
EOF
chmod +x ~/start-dashboard.sh
```

### 8.2 — LaunchAgent del dashboard
```bash
cat > ~/Library/LaunchAgents/com.javier.agent-dashboard.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.javier.agent-dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/javier/start-dashboard.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/dashboard.log</string>
  <key>StandardErrorPath</key><string>/tmp/dashboard.error.log</string>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.javier.agent-dashboard.plist
```

**No tocar `com.openclaw.gateway.plist`** (o como se llame el daemon de OpenClaw). Lo gestiona OpenClaw, no nosotros.

### 8.3 — Monthly cost reset
**No aplica.** OpenClaw maneja sus propios contadores de costo. El cache local `costs_log` no necesita reset porque el snapshotter sobrescribe las filas del día y el dashboard agrega históricamente por fecha.

### CHECKPOINT FINAL
- [ ] Reiniciar Mac Mini → OpenClaw daemon arranca solo (verificar `openclaw gateway status`)
- [ ] Dashboard arranca solo (verificar `curl localhost:3000`)
- [ ] El subscriber se conecta automáticamente al WebSocket de OpenClaw (logs en `/tmp/dashboard.log`)
- [ ] `localhost:3000` muestra los 50 sprites del pixel world distribuidos en 8 zonas
- [ ] Esperar 5 minutos → WATCHTOWER heartbeat dispara conversación, llega evento, sprite se anima
- [ ] Tab Cost Center muestra costos del día actual (alimentado por el snapshotter de FASE 2.2)
- [ ] Tab Tasks: crear tarea manual → persiste en `tasks` y aparece en columna Pending
- [ ] Ghost mode: click en conversación activa → input aparece → enviar mensaje → llega como `role='javier'` en `msg_log`
- [ ] **Independencia**: matar el dashboard (`kill $(pgrep -f next-server)`) → OpenClaw sigue corriendo y registrando conversaciones (verificar con `openclaw stats`). Reiniciar dashboard → recupera el estado leyendo el cache + el WebSocket.

---

# RESUMEN DE LO QUE ESTE CLAUDE.md NO HACE (intencional)

Este archivo construye SOLO la capa de visualización. Lo siguiente NO se construye aquí — pertenece a `OPENCLAW_INSTALL_GUIDE.md` o vive nativo en OpenClaw:

- ❌ Definir los 50 agentes (skill files) — los crea el install guide en PASO 6
- ❌ System prompts de los agentes — viven en `~/.openclaw/workspace/skills/*.md`
- ❌ Selección de modelo primary/fallback/escalation — frontmatter de cada skill
- ❌ Cost tracking nativo — OpenClaw lo hace internamente
- ❌ Cron jobs / heartbeats — `~/.openclaw/heartbeats.json`
- ❌ WhatsApp gateway — channel nativo de OpenClaw
- ❌ LLM routing y fallbacks automáticos — OpenClaw runtime
- ❌ Budget enforcement per-agent — OpenClaw config
- ❌ Llamadas directas a OpenRouter / Ollama desde el dashboard

Si Claude Code se da cuenta de que está a punto de construir cualquiera de los anteriores, **alto y pregúntale a Javier**: muy probablemente estás regresando al modelo viejo (dashboard runtime) y eso ya quedó deprecated.

