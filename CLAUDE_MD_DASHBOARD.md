# CLAUDE.md — Agent Command Center
# Claude Code: ejecuta fase por fase. No saltes fases. Cada checkpoint debe pasar.

## CONTEXTO
- Owner: Javier Cámara, Mérida, Yucatán, Mac Mini M4 16GB
- Proyecto: Dashboard "empresa virtual" con 50 agentes AI en pixel world
- Stack: Next.js 15 + PixiJS 8 + Mastra + Supabase + Redis + Ollama + OpenRouter
- Repo: `~/agent-command-center`

## ARQUITECTURA

```
┌────────────────────────────────────────────────────────┐
│ Next.js 15 App Router                                  │
│ ┌──────────────┐ ┌──────────┐ ┌──────────────────────┐│
│ │ Pixel World   │ │ Task     │ │ Dashboard            ││
│ │ (PixiJS +     │ │ Board    │ │ (Stats, Calendar,    ││
│ │  pixi-react)  │ │          │ │  Costs, Config)      ││
│ └──────┬───────┘ └────┬─────┘ └──────────┬───────────┘│
│        │              │                   │            │
│ ┌──────▼──────────────▼───────────────────▼──────────┐│
│ │ WebSocket Server (real-time state broadcasting)     ││
│ └──────┬─────────────────────────────────────────────┘│
├────────▼──────────────────────────────────────────────┤
│ API Routes (Next.js Route Handlers)                   │
│ /api/agents, /api/chat, /api/conversations,           │
│ /api/tasks, /api/costs, /api/world-state              │
├───────────────────────────────────────────────────────┤
│ Mastra Orchestrator                                   │
│ ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐ │
│ │ Agent        │ │ Conversation │ │ Task             │ │
│ │ Definitions  │ │ Engine       │ │ Generator        │ │
│ │ (50 agents)  │ │ (API calls)  │ │ (from conv)      │ │
│ └──────┬──────┘ └──────┬──────┘ └────────┬─────────┘ │
│        │               │                  │           │
│ ┌──────▼───────────────▼──────────────────▼─────────┐ │
│ │ Cost Controller (per-agent budgets, circuit break)  │ │
│ └──────┬─────────────────────────────────────────────┘│
├────────▼──────────────────────────────────────────────┤
│ Infrastructure                                        │
│ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐│
│ │ Supabase │ │ Redis +  │ │ Ollama │ │ OpenRouter  ││
│ │ (DB +    │ │ BullMQ   │ │ (local │ │ (cloud API  ││
│ │ Realtime)│ │ (queues) │ │  LLMs) │ │  gateway)   ││
│ └──────────┘ └──────────┘ └────────┘ └─────────────┘│
└───────────────────────────────────────────────────────┘
```

---

## FASE 0: SETUP INFRAESTRUCTURA

### Preguntar al usuario
- [ ] "¿Tienes Homebrew instalado? `brew --version`"
- [ ] "Dame tu API key de OpenRouter"
- [ ] "¿Tienes Redis instalado? `redis-cli ping`"

### 0.1 — Instalar dependencias sistema
```bash
brew install node@22 redis ollama
brew services start redis
```

### 0.2 — Instalar Ollama + modelos
```bash
ollama serve &
sleep 3
ollama pull qwen3:8b
ollama pull gemma4:e4b
ollama pull llama3.1:8b
```

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
  bullmq ioredis zustand socket.io socket.io-client recharts \
  lucide-react react-markdown @mastra/core @mastra/engine

# Dev
npm install -D @types/node tsx
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
OPENROUTER_API_KEY=sk-or-v1-xxx
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
REDIS_URL=redis://localhost:6379
OLLAMA_BASE_URL=http://localhost:11434
NEXT_PUBLIC_WS_URL=ws://localhost:3001
MONTHLY_BUDGET=200
DAILY_CAP=10
WHATSAPP_ENABLED=false
EOF
```
Pedir al usuario sus keys y reemplazar.

### CHECKPOINT FASE 0
- [ ] `node --version` → v22+
- [ ] `redis-cli ping` → PONG
- [ ] `ollama list` → 3 modelos
- [ ] `npx supabase status` → running
- [ ] `npm run dev` → localhost:3000 carga

---

## FASE 1: BASE DE DATOS

### 1.1 — Schema principal
Crear `supabase/migrations/001_schema.sql`:

```sql
-- AGENTS
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  division INTEGER NOT NULL,
  division_name VARCHAR(50) NOT NULL,
  description TEXT,
  primary_model VARCHAR(100) NOT NULL,
  fallback_model VARCHAR(100),
  escalation_model VARCHAR(100),
  tier VARCHAR(20) NOT NULL,
  monthly_budget DECIMAL(10,2) DEFAULT 5.00,
  monthly_spent DECIMAL(10,6) DEFAULT 0,
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.5,
  max_tokens INTEGER DEFAULT 4096,
  status VARCHAR(20) DEFAULT 'idle',
  -- Pixel world position
  world_x DECIMAL(8,2) DEFAULT 0,
  world_y DECIMAL(8,2) DEFAULT 0,
  world_target_x DECIMAL(8,2) DEFAULT 0,
  world_target_y DECIMAL(8,2) DEFAULT 0,
  world_state VARCHAR(20) DEFAULT 'idle',
  -- Stats
  total_requests INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATIONS (between agents)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_a_id UUID REFERENCES agents(id),
  agent_b_id UUID REFERENCES agents(id),
  trigger_type VARCHAR(20) NOT NULL, -- cron, event, handoff, threshold, request
  trigger_context TEXT,
  status VARCHAR(20) DEFAULT 'active', -- active, completed, interrupted
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  summary TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- MESSAGES (within conversations)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  role VARCHAR(20) NOT NULL, -- agent_a, agent_b, javier (ghost mode)
  content TEXT NOT NULL,
  model_used VARCHAR(100),
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS (generated from conversations)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  assigned_to UUID REFERENCES agents(id),
  assigned_to_javier BOOLEAN DEFAULT false,
  type VARCHAR(20) NOT NULL, -- todo, decision, followup, deploy, alert
  priority VARCHAR(5) NOT NULL, -- P0, P1, P2, P3
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCHEDULES (cron jobs for agents)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  cron_expression VARCHAR(50) NOT NULL,
  prompt TEXT NOT NULL,
  description VARCHAR(200),
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY COSTS (aggregated)
CREATE TABLE daily_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  agent_id UUID REFERENCES agents(id),
  model VARCHAR(100),
  tokens_in BIGINT DEFAULT 0,
  tokens_out BIGINT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  UNIQUE(date, agent_id)
);

-- WORLD STATE (for pixel world sync)
CREATE TABLE world_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(30) NOT NULL, -- agent_move, conversation_start, conversation_end, ghost_join, ghost_leave
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_daily_costs_date ON daily_costs(date);
CREATE INDEX idx_world_events_created ON world_events(created_at);
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at);
```

```bash
npx supabase db push
```

### 1.2 — Seed 50 agents

Crear `scripts/seed.ts`. Para cada agente incluir:
- code, name, division, division_name, description
- primary_model, fallback_model, escalation_model
- tier, monthly_budget, system_prompt
- temperature, max_tokens
- world_x, world_y (posición inicial en zona de su división)

Las 8 zonas de divisiones en el pixel world (coordenadas del canvas 750x380):
```typescript
const ZONES = {
  1: { x: 20, y: 30, w: 195, h: 145, name: "CODE OPS" },
  2: { x: 230, y: 30, w: 220, h: 145, name: "REVENUE" },
  3: { x: 465, y: 30, w: 130, h: 145, name: "BRAND" },
  4: { x: 610, y: 30, w: 120, h: 145, name: "OPS/FIN" },
  5: { x: 20, y: 200, w: 195, h: 135, name: "PRODUCT" },
  6: { x: 230, y: 200, w: 110, h: 135, name: "AI OPS" },
  7: { x: 355, y: 200, w: 150, h: 135, name: "STRATEGY" },
  8: { x: 520, y: 200, w: 210, h: 135, name: "COMMS" },
};
```

Cada agente se posiciona random dentro de su zona.

Incluir los 50 agentes con los datos completos del roster FASE 2 v5.0 (ver documento adjunto MASTER_v6_FINAL.md para los datos).

### 1.3 — Seed schedules
```typescript
const SCHEDULES = [
  { agent: "WATCHTOWER", cron: "*/5 * * * *", prompt: "Health check completo", desc: "Monitor cada 5 min" },
  { agent: "RADAR", cron: "0 6 * * *", prompt: "Escanea tendencias AI/FinTech/LATAM", desc: "Trends matutinos" },
  { agent: "DIGEST", cron: "0 7 * * 1-5", prompt: "Genera briefing matutino con top 3 prioridades", desc: "Briefing diario" },
  { agent: "INBOX", cron: "0 7 * * 1-5", prompt: "Triage de emails pendientes", desc: "Email triage matutino" },
  { agent: "HUNTER", cron: "0 9,11,14,16 * * 1-5", prompt: "Busca 3 leads para atiende.ai en Mérida", desc: "Prospección 4x/día" },
  { agent: "COBRO", cron: "0 10 * * 1", prompt: "Revisa facturas con más de 7 días de atraso", desc: "Cobranza semanal" },
  { agent: "AI-MONITOR", cron: "0 12,19 * * *", prompt: "Reporte de costos y salud de agentes", desc: "Cost report 2x/día" },
  { agent: "ESCUCHA", cron: "0 15 * * 1-5", prompt: "Escanea reviews de apps y menciones sociales", desc: "Social listening" },
  { agent: "METRICS", cron: "0 17 * * 1-5", prompt: "Snapshot de KPIs del día", desc: "KPI diario" },
  { agent: "SOCIAL", cron: "0 20 * * 1-5", prompt: "Sugiere post de LinkedIn para mañana basado en trends", desc: "Sugerencia de post" },
  { agent: "PRIORITY", cron: "0 10 * * 1", prompt: "Re-ranking del backlog con RICE", desc: "Priorización semanal" },
  { agent: "COMPETE", cron: "0 9 * * 3", prompt: "Intel competitivo: Yalo, Gus Chat, Treble vs atiende.ai", desc: "Intel semanal" },
  { agent: "BENCHMARKER", cron: "0 17 * * 5", prompt: "Evalúa calidad de respuestas de los 5 modelos más usados", desc: "Eval semanal" },
];
```

```bash
npx tsx scripts/seed.ts
```

### CHECKPOINT FASE 1
- [ ] `SELECT count(*) FROM agents;` → 50
- [ ] `SELECT division, count(*) FROM agents GROUP BY division ORDER BY division;` → 8,10,5,7,8,4,5,3
- [ ] `SELECT count(*) FROM schedules;` → 13
- [ ] Cada agente tiene world_x, world_y dentro de su zona

---

## FASE 2: OPENROUTER CLIENT + COST CONTROLLER

### 2.1 — OpenRouter client
Crear `src/lib/openrouter.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

interface CallOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  agentId: string; // UUID of calling agent
  conversationId?: string;
}

interface CallResult {
  content: string;
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  latency_ms: number;
}

// Model pricing table (per million tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  "minimax/minimax-m2.5:free": { input: 0, output: 0 },
  "qwen/qwen3-coder-480b-a35b:free": { input: 0, output: 0 },
  "qwen/qwen3.6-plus:free": { input: 0, output: 0 },
  "x-ai/grok-4.1-fast": { input: 0.20, output: 0.50 },
  "anthropic/claude-sonnet-4.6": { input: 3.00, output: 15.00 },
  "google/gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
  "mistralai/mistral-large-2411": { input: 0.50, output: 1.50 },
  "deepseek/deepseek-v3.2": { input: 0.26, output: 0.38 },
  "mistralai/mistral-small-3.2-24b-instruct": { input: 0.075, output: 0.20 },
  "ibm-granite/granite-4.0-h-micro": { input: 0.017, output: 0.11 },
  "mistralai/mistral-nemo": { input: 0.02, output: 0.04 },
  "google/gemini-2.5-flash": { input: 0.30, output: 2.50 },
  // Free models
  "meta-llama/llama-3.3-70b-instruct:free": { input: 0, output: 0 },
  "openai/gpt-oss-120b:free": { input: 0, output: 0 },
  "z-ai/glm-4.5-air:free": { input: 0, output: 0 },
  "stepfun/step-3.5-flash:free": { input: 0, output: 0 },
};

function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICING[model] || { input: 1, output: 2 }; // Default expensive if unknown
  return (tokensIn * price.input / 1_000_000) + (tokensOut * price.output / 1_000_000);
}

export async function callModel(options: CallOptions): Promise<CallResult> {
  const start = Date.now();
  
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Agent Command Center",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.max_tokens ?? 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const latency = Date.now() - start;
  const tokensIn = data.usage?.prompt_tokens || 0;
  const tokensOut = data.usage?.completion_tokens || 0;
  const cost = calculateCost(options.model, tokensIn, tokensOut);

  return {
    content: data.choices?.[0]?.message?.content || "",
    model_used: data.model || options.model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost,
    latency_ms: latency,
  };
}

export async function callOllama(model: string, messages: Array<{ role: string; content: string }>, maxTokens = 2048): Promise<string> {
  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, options: { num_predict: maxTokens } }),
  });
  const data = await response.json();
  return data.message?.content || "";
}
```

### 2.2 — Cost controller middleware
Crear `src/lib/cost-controller.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  remaining_budget: number;
}

export async function checkBudget(agentId: string): Promise<BudgetCheck> {
  // Get agent budget and spending
  const { data: agent } = await supabase
    .from('agents')
    .select('code, monthly_budget, monthly_spent, tier')
    .eq('id', agentId)
    .single();

  if (!agent) return { allowed: false, reason: "Agent not found", remaining_budget: 0 };

  // FREE and LOCAL agents always allowed
  if (agent.tier === 'FREE' || agent.tier === 'LOCAL') {
    return { allowed: true, remaining_budget: Infinity };
  }

  const remaining = agent.monthly_budget - agent.monthly_spent;
  
  if (remaining <= 0) {
    return { allowed: false, reason: `${agent.code} exceeded monthly budget ($${agent.monthly_budget})`, remaining_budget: 0 };
  }

  // Check daily cap
  const today = new Date().toISOString().split('T')[0];
  const { data: todayCost } = await supabase
    .from('daily_costs')
    .select('cost')
    .eq('date', today);
  
  const dailyTotal = (todayCost || []).reduce((sum, r) => sum + Number(r.cost), 0);
  const dailyCap = Number(process.env.DAILY_CAP || 10);

  if (dailyTotal >= dailyCap) {
    return { allowed: false, reason: `Daily cap reached ($${dailyTotal.toFixed(2)}/$${dailyCap})`, remaining_budget: remaining };
  }

  return { allowed: true, remaining_budget: remaining };
}

export async function recordCost(agentId: string, model: string, tokensIn: number, tokensOut: number, cost: number) {
  const today = new Date().toISOString().split('T')[0];

  // Update agent monthly_spent
  await supabase.rpc('increment_agent_spent', { agent_id: agentId, amount: cost });

  // Upsert daily cost
  await supabase
    .from('daily_costs')
    .upsert({
      date: today,
      agent_id: agentId,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost,
      request_count: 1,
    }, {
      onConflict: 'date,agent_id',
      // Increment existing values
    });
}
```

Crear RPC function en Supabase:
```sql
CREATE OR REPLACE FUNCTION increment_agent_spent(agent_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE agents SET 
    monthly_spent = monthly_spent + amount,
    total_requests = total_requests + 1,
    last_active_at = NOW()
  WHERE id = agent_id;
END;
$$ LANGUAGE plpgsql;
```

### CHECKPOINT FASE 2
- [ ] `curl -X POST localhost:3000/api/test-call -d '{"model":"qwen/qwen3.6-plus:free","prompt":"Hello"}' ` → response con tokens/cost
- [ ] Budget check returns `allowed: true` para un agente con budget
- [ ] Budget check returns `allowed: false` cuando monthly_spent >= monthly_budget

---

## FASE 3: CONVERSATION ENGINE

### 3.1 — El motor de conversación entre agentes
Crear `src/lib/conversation-engine.ts`:

Este es el CORE del sistema. Maneja:
1. Iniciar conversación entre 2 agentes
2. Ejecutar turnos (API calls reales)
3. Generar resumen y acciones al final
4. Guardar todo en DB
5. Emitir eventos para el pixel world

```typescript
import { callModel, callOllama } from './openrouter';
import { checkBudget, recordCost } from './cost-controller';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_TURNS = 4;

interface Agent {
  id: string;
  code: string;
  primary_model: string;
  fallback_model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  tier: string;
}

interface ConversationResult {
  conversationId: string;
  messages: Array<{ speaker: string; content: string; cost: number }>;
  totalCost: number;
  summary: string;
  tasks: Array<{ type: string; priority: string; title: string; assignedTo: string }>;
}

export async function runConversation(
  agentA: Agent,
  agentB: Agent,
  triggerType: string,
  triggerContext: string,
  initialMessage: string,
  onMessage?: (msg: any) => void // real-time callback for pixel world
): Promise<ConversationResult> {
  
  // Check budgets
  const budgetA = await checkBudget(agentA.id);
  const budgetB = await checkBudget(agentB.id);
  if (!budgetA.allowed || !budgetB.allowed) {
    throw new Error(`Budget exceeded: ${budgetA.reason || budgetB.reason}`);
  }

  // Create conversation record
  const { data: conv } = await supabase
    .from('conversations')
    .insert({
      agent_a_id: agentA.id,
      agent_b_id: agentB.id,
      trigger_type: triggerType,
      trigger_context: triggerContext,
    })
    .select()
    .single();

  const conversationId = conv!.id;
  const messages: Array<{ speaker: string; content: string; cost: number }> = [];
  let totalCost = 0;

  // Emit conversation start event
  await emitWorldEvent('conversation_start', {
    conversationId,
    agentA: agentA.code,
    agentB: agentB.code,
  });

  // Turn 1: Agent A sends initial message (from trigger)
  messages.push({ speaker: agentA.code, content: initialMessage, cost: 0 });
  await saveMessage(conversationId, agentA.id, 'agent_a', initialMessage, agentA.primary_model, 0, 0, 0, 0);
  onMessage?.({ speaker: agentA.code, content: initialMessage, turn: 1 });

  // Conversation loop
  let currentSpeaker = agentB; // B responds first
  let otherSpeaker = agentA;
  let conversationHistory = [
    { role: 'system', content: currentSpeaker.system_prompt + '\n\nRespond in 2-3 sentences max. Be concise and in-character. Mix Spanish and English naturally.' },
    { role: 'user', content: `${otherSpeaker.code} te dice: "${initialMessage}"` },
  ];

  for (let turn = 2; turn <= MAX_TURNS; turn++) {
    // Check budget before each call
    const budget = await checkBudget(currentSpeaker.id);
    if (!budget.allowed) break;

    // Determine model (local or cloud)
    let response: string;
    let model = currentSpeaker.primary_model;
    let tokensIn = 0, tokensOut = 0, cost = 0, latency = 0;

    if (model.startsWith('ollama/')) {
      response = await callOllama(model.replace('ollama/', ''), conversationHistory);
    } else {
      try {
        const result = await callModel({
          model,
          messages: conversationHistory,
          temperature: currentSpeaker.temperature,
          max_tokens: Math.min(currentSpeaker.max_tokens, 500), // Cap for conversations
          agentId: currentSpeaker.id,
        });
        response = result.content;
        tokensIn = result.tokens_in;
        tokensOut = result.tokens_out;
        cost = result.cost;
        latency = result.latency_ms;
      } catch (e) {
        // Fallback model
        if (currentSpeaker.fallback_model) {
          model = currentSpeaker.fallback_model;
          const result = await callModel({
            model,
            messages: conversationHistory,
            temperature: currentSpeaker.temperature,
            max_tokens: 500,
            agentId: currentSpeaker.id,
          });
          response = result.content;
          tokensIn = result.tokens_in;
          tokensOut = result.tokens_out;
          cost = result.cost;
          latency = result.latency_ms;
        } else {
          response = "(modelo no disponible)";
        }
      }
    }

    // Record cost
    if (cost > 0) await recordCost(currentSpeaker.id, model, tokensIn, tokensOut, cost);
    totalCost += cost;

    // Save message
    messages.push({ speaker: currentSpeaker.code, content: response, cost });
    await saveMessage(conversationId, currentSpeaker.id, 
      currentSpeaker === agentB ? 'agent_b' : 'agent_a',
      response, model, tokensIn, tokensOut, cost, latency);
    
    // Emit for pixel world
    onMessage?.({ speaker: currentSpeaker.code, content: response, turn, cost });

    // Prepare next turn
    conversationHistory = [
      { role: 'system', content: otherSpeaker.system_prompt + '\n\nRespond in 2-3 sentences max. Be concise and in-character.' },
      { role: 'user', content: messages.map(m => `${m.speaker}: ${m.content}`).join('\n') + '\n\nResponde brevemente.' },
    ];

    // Swap speakers
    [currentSpeaker, otherSpeaker] = [otherSpeaker, currentSpeaker];
  }

  // Generate summary and tasks using a cheap model
  const summaryPrompt = `Conversation between ${agentA.code} and ${agentB.code}:\n${messages.map(m => `${m.speaker}: ${m.content}`).join('\n')}\n\nGenerate a JSON object with:\n1. "summary": one-sentence summary in Spanish\n2. "tasks": array of {type: "todo|decision|followup|deploy|alert", priority: "P0|P1|P2|P3", title: "short description", assignedTo: "AGENT_CODE or JAVIER"}\nRespond ONLY with the JSON.`;

  let summary = "";
  let tasks: any[] = [];
  try {
    const summaryResult = await callModel({
      model: "qwen/qwen3.6-plus:free",
      messages: [{ role: 'user', content: summaryPrompt }],
      temperature: 0.2,
      max_tokens: 500,
      agentId: agentA.id,
    });
    const parsed = JSON.parse(summaryResult.content.replace(/```json\n?|```/g, '').trim());
    summary = parsed.summary || "";
    tasks = parsed.tasks || [];
  } catch {
    summary = `${agentA.code} y ${agentB.code} conversaron sobre: ${triggerContext}`;
  }

  // Save tasks
  for (const task of tasks) {
    const assignedAgent = await supabase
      .from('agents')
      .select('id')
      .eq('code', task.assignedTo)
      .single();
    
    await supabase.from('tasks').insert({
      conversation_id: conversationId,
      assigned_to: task.assignedTo === 'JAVIER' ? null : assignedAgent?.data?.id,
      assigned_to_javier: task.assignedTo === 'JAVIER',
      type: task.type,
      priority: task.priority,
      title: task.title,
      description: summary,
      due_at: task.priority === 'P0' ? new Date() : 
              task.priority === 'P1' ? new Date(Date.now() + 86400000) : 
              new Date(Date.now() + 7 * 86400000),
    });
  }

  // Update conversation as completed
  await supabase.from('conversations').update({
    status: 'completed',
    total_tokens: messages.reduce((sum, m) => sum + (m.cost > 0 ? 1 : 0), 0), // approximate
    total_cost: totalCost,
    summary,
    ended_at: new Date().toISOString(),
  }).eq('id', conversationId);

  // Emit end event
  await emitWorldEvent('conversation_end', {
    conversationId,
    agentA: agentA.code,
    agentB: agentB.code,
    summary,
    taskCount: tasks.length,
  });

  return { conversationId, messages, totalCost, summary, tasks };
}

async function saveMessage(convId: string, agentId: string, role: string, content: string, model: string, tokensIn: number, tokensOut: number, cost: number, latency: number) {
  await supabase.from('messages').insert({
    conversation_id: convId,
    agent_id: agentId,
    role,
    content,
    model_used: model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost,
    latency_ms: latency,
  });
}

async function emitWorldEvent(type: string, payload: any) {
  await supabase.from('world_events').insert({ event_type: type, payload });
}
```

### CHECKPOINT FASE 3
- [ ] Ejecutar conversación test entre HUNTER y FILTER → respuestas reales de API
- [ ] Conversación guardada en DB con messages
- [ ] Tasks generadas automáticamente
- [ ] Costo registrado en daily_costs
- [ ] world_events tiene conversation_start y conversation_end

---

## FASE 4: ORCHESTRATOR (Quién Habla con Quién)

### 4.1 — Scheduler de cron jobs
Crear `src/lib/scheduler.ts`:

Usa node-cron para ejecutar los schedules de la DB. Cada cron trigger puede generar una conversación entre agentes.

### 4.2 — Event bus
Crear `src/lib/event-bus.ts`:

BullMQ queue llamada `agent-conversations`. Workers procesan los jobs:
- `conversation.trigger` → ejecuta runConversation()
- `task.execute` → un agente ejecuta una tarea
- `notification.send` → envía WhatsApp a Javier

### 4.3 — Trigger rules
Crear `src/lib/trigger-rules.ts`:

Define qué agente habla con quién cuando ocurre un evento:
```typescript
const TRIGGER_RULES = [
  // Handoff chains
  { from: "HUNTER", to: "FILTER", on: "hunter_found_leads" },
  { from: "FILTER", to: "PLUMA", on: "filter_scored_hot", condition: "score >= 7" },
  { from: "PLUMA", to: "PROPUESTA", on: "lead_interested" },
  { from: "TRIAGE", to: "FORGE", on: "bug_detected", condition: "priority <= P1" },
  { from: "FORGE", to: "QUALITY", on: "fix_applied" },
  { from: "QUALITY", to: "DEPLOY", on: "tests_passed" },
  // Threshold triggers
  { from: "METRICS", to: "COMPETE", on: "mrr_dropped", condition: "drop > 5%" },
  { from: "WATCHTOWER", to: "AI-MONITOR", on: "resource_alert", condition: "ram > 85%" },
  // Cross-division
  { from: "ESCUCHA", to: "PRODUCTO", on: "feature_request", condition: "count >= 3" },
  { from: "FISCAL", to: "FACTURA", on: "tax_calculated" },
  { from: "INVESTOR", to: "PROPUESTA", on: "investor_meeting" },
  // Any agent can talk to any agent for free-form conversations
  { from: "*", to: "*", on: "agent_request", condition: "budget_available" },
];
```

### CHECKPOINT FASE 4
- [ ] Cron job de WATCHTOWER se ejecuta cada 5 min
- [ ] HUNTER cron trigger genera conversación con FILTER
- [ ] Event "bug_detected" dispara TRIAGE→FORGE
- [ ] BullMQ dashboard (localhost:3000/api/bull-board) muestra jobs

---

## FASE 5: PIXEL WORLD (PixiJS)

### 5.1 — Setup pixi-react
Crear `src/components/pixel-world/PixelWorld.tsx`:

Componente React que:
- Renderiza un canvas PixiJS de 750x380
- Dibuja 8 zonas de división con grid pixel-art
- Renderiza 50 sprites de agentes (cada uno es un personaje pixel de 10x10)
- Suscribe a Supabase Realtime para world_events
- Cuando llega conversation_start: mueve los 2 agentes uno hacia el otro
- Muestra burbujas de speech con el texto de la conversación
- Cuando llega conversation_end: agentes regresan a caminar libre
- Ghost mode: cuando Javier clickea en conversación activa, aparece su avatar

### 5.2 — Sprite system
Crear `src/components/pixel-world/sprites.ts`:

Sprites pixel-art para:
- 8 colores de división (un tinte por división)
- Animación de caminata (2 frames)
- Animación de hablar (burbuja de pensamiento)
- Avatar de Javier (semi-transparente)

### 5.3 — Map renderer
Crear `src/components/pixel-world/map.ts`:

Mapa de la oficina con:
- Grid de 16px
- 8 zonas con bordes punteados y labels
- Escritorios, plantas, y decoración pixel (opcional)
- Área de "meeting point" entre zonas para conversaciones cross-division

### 5.4 — Real-time sync
Suscribir al canal Supabase Realtime `world_events`:
```typescript
supabase.channel('world')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events' }, (payload) => {
    handleWorldEvent(payload.new);
  })
  .subscribe();
```

### CHECKPOINT FASE 5
- [ ] Canvas renderiza con 50 agentes caminando en sus zonas
- [ ] Agentes se mueven suavemente (interpolación)
- [ ] Nombres visibles debajo de cada sprite
- [ ] Conversación activa: los 2 agentes caminan uno hacia el otro + burbuja

---

## FASE 6: DASHBOARD SCREENS

### 6.1 — Layout principal
`src/app/page.tsx` — Tabs: World | Tasks | Costs | Calendar | Config

### 6.2 — Tasks Board
`src/app/tasks/page.tsx`:
- Lista de tareas filtrable por status/priority/agent
- Draggable entre columnas (Pending, In Progress, Completed)
- Badge de prioridad (P0 rojo, P1 naranja, P2 amarillo, P3 verde)

### 6.3 — Cost Center
`src/app/costs/page.tsx`:
- Gauge de budget ($XX/$200)
- Gráfica de costo diario (Recharts area chart)
- Top 5 agentes más caros
- Costo por tier
- Costo por modelo

### 6.4 — Calendar
`src/app/calendar/page.tsx`:
- Vista semanal con schedules de cron jobs
- Cada slot muestra: agente, hora, descripción
- Toggle para habilitar/deshabilitar schedules

### 6.5 — Config
`src/app/config/page.tsx`:
- Tabla editable de 50 agentes: model, budget, temperature, status
- Botón para swap de modelo
- Budget sliders per-agent
- Daily cap control
- WhatsApp toggle

### 6.6 — Comm Log (sidebar del pixel world)
Panel derecho del pixel world con:
- Lista de conversaciones del día
- Click para expandir mensajes
- Filter por división

### CHECKPOINT FASE 6
- [ ] 5 pantallas renderizan con datos reales de DB
- [ ] Tasks se pueden mover entre columnas
- [ ] Costs muestra el gauge de budget correcto
- [ ] Calendar muestra los 13 schedules
- [ ] Config permite cambiar modelo de un agente

---

## FASE 7: GHOST MODE + WHATSAPP

### 7.1 — Ghost mode
En `PixelWorld.tsx`:
- Click en conversación activa → mostrar input field
- Javier escribe mensaje → se inserta en la conversación como role "javier"
- Los agentes leen el mensaje de Javier y responden
- Avatar semi-transparente aparece junto a los agentes que conversan
- Se desvanece cuando Javier deja de participar

### 7.2 — WhatsApp notifications
Crear `src/lib/notifications.ts`:

Usando el OpenClaw Gateway (o directamente Baileys), enviar WhatsApp cuando:
- Task con `assigned_to_javier = true` → "🟡 DECISIÓN: [título]"
- Task con priority P0 → "🔴 URGENTE: [título]"
- Conversación completada con resultado importante → "🟢 RESULTADO: [resumen]"
- Digest diario → resumen formateado

### CHECKPOINT FASE 7
- [ ] Ghost mode: Javier escribe en conversación activa → agentes responden
- [ ] Avatar transparente aparece en el pixel world
- [ ] WhatsApp notification recibida para una task P0

---

## FASE 8: AUTO-START + POLISH

### 8.1 — Start script
```bash
cat > ~/start-agent-center.sh << 'EOF'
#!/bin/bash
redis-server --daemonize yes
ollama serve &
sleep 2
cd ~/agent-command-center
npx supabase start
npm run build
npm start &
echo "🦞 Agent Command Center: http://localhost:3000"
EOF
chmod +x ~/start-agent-center.sh
```

### 8.2 — LaunchAgent (auto-start en boot)
```bash
cat > ~/Library/LaunchAgents/com.javier.agents.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.javier.agents</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/javier/start-agent-center.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/agents.log</string>
  <key>StandardErrorPath</key><string>/tmp/agents.error.log</string>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.javier.agents.plist
```

### 8.3 — Monthly cost reset
Crear cron job que el primer día de cada mes resetea monthly_spent a 0 para todos los agentes.

### CHECKPOINT FINAL
- [ ] Reiniciar Mac Mini → sistema arranca automáticamente
- [ ] localhost:3000 muestra pixel world con 50 agentes
- [ ] Agentes conversan autónomamente cada ~12 segundos
- [ ] Conversaciones se guardan en DB
- [ ] Tasks se generan de conversaciones
- [ ] Costs se trackean en tiempo real
- [ ] Calendar muestra 13 schedules
- [ ] Ghost mode funciona en pixel world
- [ ] WhatsApp envía notifications para decisiones/urgencias
- [ ] Budget cap detiene agentes cuando se excede
- [ ] El sistema es una EMPRESA VIRTUAL autónoma 🦞
