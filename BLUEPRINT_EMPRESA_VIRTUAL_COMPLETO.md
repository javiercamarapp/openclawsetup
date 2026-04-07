# BLUEPRINT: Tu Empresa Virtual de 50 Agentes AI
## El Dashboard que Ve, Piensa, y Actúa — Guía Estratégica para Javier

---

# SECCIÓN 1: QUÉ ESTAMOS CONSTRUYENDO

## La Visión en Una Oración

Una oficina virtual estilo Game Boy donde 50 agentes AI caminan, trabajan, y hablan entre sí en tiempo real — con calendario, tareas, costos, y la capacidad de que tú intervengas como un personaje "fantasma" en cualquier conversación.

## Lo Que Existe Hoy (Investigación)

Tu idea no es nueva — pero nadie la ha ejecutado como tú la imaginas. Esto es lo que encontré:

### AI Town (a16z) — El Referente
- Repositorio: `a16z-infra/ai-town` (9,500 stars, MIT)
- Mundo pixel con sprites que caminan y hablan usando PixiJS
- Agentes deciden autónomamente cuándo hablar basado en proximidad
- Usa Convex como backend con transacciones ACID
- Memoria tipo Stanford Smallville: recency + importance + relevance
- **Limitación**: Es una demo/juguete. No tiene tareas, calendario, costos, ni WhatsApp.

### Stanford Smallville — El Paper Original
- Paper "Generative Agents" (Park et al., 2023)
- 25 agentes con memoria, reflexión, y planificación
- Cada agente decide: observar → reflexionar → planificar → actuar
- **Limitación**: Código Python legacy, 31 commits totales, no mantenido.

### Clawboard — Dashboard Pixel para OpenClaw
- Repo: `kirillkuzin/clawboard` (nuevo, 2026)
- Dashboard Next.js con oficina pixel-art usando PixiJS
- Visualiza actividad de agentes OpenClaw
- **Limitación**: Single-agent, no multi-agent collaboration.

### Lo Que NO Existe (Tu Oportunidad)
Nadie ha construido un sistema que combine:
- ✅ 50 agentes especializados con modelos diferentes por tarea
- ✅ Mundo pixel donde SE VEN hablando en tiempo real
- ✅ Conversaciones REALES entre agentes (API calls, no scripted)
- ✅ Sistema de tareas/calendario como empresa real
- ✅ WhatsApp notifications + ghost mode para intervenir
- ✅ Cost control con budget per-agent
- ✅ Todo corriendo en un Mac Mini M4 por $64/mes

**Esto es Kairotec-level product.** Podrías venderlo.

---

## Arquitectura (Basada en Research)

### Stack Elegido y Por Qué

| Componente | Tecnología | Por Qué (Research) |
|-----------|-----------|-------------------|
| Frontend | **Next.js 15 + PixiJS 8 (pixi-react)** | AI Town probó que PixiJS + React es la mejor combinación para mundos pixel. GPU-accelerated, maneja miles de sprites. |
| Orquestación | **Mastra** (TypeScript-native) | 22.7K stars, del equipo de Gatsby. Es el ÚNICO framework de agentes que es TypeScript-native. Tiene `.network()` para agent-to-agent routing, workflows con `.then()/.branch()/.parallel()`, y memoria de 4 niveles. |
| Base de datos | **Supabase** (PostgreSQL + pgvector + Realtime) | Realtime subscriptions nativas via WebSocket = no necesitas servidor pub/sub custom. pgvector para memoria semántica de agentes. |
| Job Queue | **Redis + BullMQ** | 50MB RAM. Rate limiting, retries, priority queues. Los agentes encolan sus tareas aquí. |
| LLM Gateway | **OpenRouter** (ya elegido) | 400+ modelos, una API key, fallback nativo. |
| Cost Control | **Budget middleware custom** | LiteLLM es overkill para tu caso. Un middleware simple que trackea tokens per-agent y para cuando excede el budget. |
| Observability | **Langfuse** (self-hosted) | Open-source, Docker, trace trees para ver la cadena completa de una conversación multi-agente. |
| Messaging | **OpenClaw Gateway** → WhatsApp | Ya lo tenemos definido. Notifications cuando hay resultados/decisiones/urgencias. |
| Local LLM | **Ollama** (4 modelos en Mac Mini) | Qwen3 8B, Gemma 4 E4B, Llama 3.1 8B, DeepSeek R1-Qwen3-8B |

### Por Qué Mastra y No LangGraph/CrewAI

La investigación mostró 3 opciones serias:

| | LangGraph | CrewAI | **Mastra** |
|--|----------|--------|-----------|
| Lenguaje | Python | Python | **TypeScript** ✅ |
| Stars | 24.8K | 45.9K | 22.7K |
| Downloads/mes | 34.5M | 5.2M | 1.8M |
| Pattern | Graph + shared state | Role-based teams | Graph + agent networks |
| Se integra con Next.js | ❌ Necesita FastAPI bridge | ❌ Necesita FastAPI bridge | ✅ **Nativo** |

**Mastra gana porque tu stack es TypeScript.** LangGraph es más maduro en producción, pero necesitarías un bridge Python→TypeScript que añade complejidad innecesaria. Mastra corre nativo en tu Next.js.

### Cómo los Agentes Deciden Hablar (El Cerebro)

Basado en el research de Stanford Smallville + AI Town, el ciclo de cada agente es:

```
Cada 30 segundos, cada agente:
  1. PERCIBE → ¿Qué pasó en mi división? ¿Hay eventos nuevos?
  2. DECIDE → ¿Necesito hablar con alguien? ¿Con quién?
  3. ACTÚA → Camina hacia el agente, inicia conversación
  4. REPORTA → Guarda resultado, notifica si es importante
```

**Triggers que hacen que un agente hable:**

| Trigger | Ejemplo | Quién habla |
|---------|---------|-------------|
| **Cron** (schedule) | Lunes 7AM | DIGEST→genera briefing |
| **Event** (algo pasó) | Bug detectado | TRIAGE→FORGE |
| **Handoff** (resultado listo) | Lead calificado | FILTER→PLUMA |
| **Threshold** (número cruzó límite) | MRR bajó 5% | METRICS→COMPETE |
| **Request** (Javier pide algo) | "Busca leads" | HUNTER se activa |

### Cost Control: La Capa Que Evita Bancarrota

La investigación fue clara: **sin cost control, los agentes autónomos te arruinan.** AutoGen sin cap puede crear 243 agentes simultáneos facturando.

Nuestro sistema de 5 capas:

| Capa | Qué hace | Config |
|------|---------|--------|
| 1. Budget per-agent | Cada agente tiene un max $/mes | PROPUESTA: $18, FORGE: $2, etc. |
| 2. Budget per-conversation | Cada conversación tiene un max tokens | Default: 4096 tokens max |
| 3. Circuit breaker | Si un agente gasta >$0.50 en 1 min, para | Velocity monitoring |
| 4. Model routing | Cheapest-first, escala solo si la calidad es baja | ROUTER agent decide |
| 5. Daily cap | Si el sistema gasta >$10/día, para todo excepto LOCAL | Hard stop |

---

# SECCIÓN 2: EL PIXEL WORLD — TU OFICINA VIRTUAL

## Qué Ves en la Pantalla

Imagina abrir `localhost:3000` y ver:

### La Oficina (Canvas Principal)
- Un mapa pixel-art de una oficina con 8 áreas (una por división)
- Cada área tiene un letrero: "CODE OPS", "REVENUE", "BRAND", etc.
- **50 personajes pixel** caminando por su área
- Cada personaje tiene el color de su división + su nombre
- Cuando dos agentes hablan, caminan uno hacia el otro
- **Burbuja de speech** muestra la conversación en tiempo real
- **Línea punteada amarilla** conecta a los agentes que conversan

### Tu Avatar (Ghost Mode)
- Un personaje semi-transparente con tu nombre "JAVIER"
- Aparece cuando clickeas en una conversación activa
- Puedes escribir un mensaje y los agentes lo leen y responden
- Tu avatar camina hacia donde están hablando los agentes

### El Panel Inferior (RPG Dialog Box)
- Estilo Final Fantasy / Pokémon
- Muestra la conversación activa con scroll
- Indica quién está "pensando..." (esperando API response)
- Botón para intervenir

### El Panel Derecho
Tabs:
1. **📡 COMM LOG** — Historial de todas las conversaciones del día
2. **📋 TASKS** — Tareas pendientes por agente/división
3. **💰 COSTS** — Gasto del día/semana/mes por agente
4. **📅 CALENDAR** — Cron jobs y schedules de los agentes
5. **⚙️ CONFIG** — Cambiar modelos, budgets, triggers

---

# SECCIÓN 3: EL SISTEMA DE TAREAS

## Cómo Funciona

Cada conversación entre agentes puede generar **acciones**. Una acción es algo que alguien (agente o Javier) debe hacer.

### Tipos de Acción

| Tipo | Ejemplo | Asignado a |
|------|---------|-----------|
| **TODO** | "Crear propuesta para Restaurante Maya" | PROPUESTA |
| **DECISION** | "¿Aprobamos el descuento del 15%?" | Javier |
| **FOLLOW-UP** | "Verificar si el lead respondió en 48h" | RETAIN |
| **DEPLOY** | "Subir fix de audio a production" | DEPLOY |
| **ALERT** | "RAM al 90%, descargar un modelo" | Javier |

### Pipeline de Tareas

```
Conversación → Agente genera acción → Se guarda en DB
                                         ↓
                            ¿Es para Javier? → WhatsApp notification
                            ¿Es para agente? → Se encola en BullMQ
                                                    ↓
                                          Agente la ejecuta cuando le toca
                                                    ↓
                                          Resultado → nueva conversación si necesario
```

### Vista de Tareas en el Dashboard

```
┌─────────────────────────────────────────────┐
│ TASKS                          Filter: All  │
├─────────────────────────────────────────────┤
│ 🔴 P0 | TRIAGE→FORGE                       │
│ Fix timeout audio >2MB atiende.ai           │
│ Status: In Progress | Due: Hoy              │
├─────────────────────────────────────────────┤
│ 🟡 P1 | HUNTER→PROPUESTA                   │
│ Propuesta Restaurante Maya ($200/mes)       │
│ Status: Pending | Due: Mañana               │
├─────────────────────────────────────────────┤
│ 🟢 P2 | ESCUCHA→PRODUCTO                   │
│ Evaluar feature "gráfica de gastos" Moni AI │
│ Status: Queued | Due: Esta semana           │
├─────────────────────────────────────────────┤
│ 🔵 Decision | Para: JAVIER                  │
│ ¿Aprobamos pitch deck para DILA Capital?    │
│ Status: Waiting | Due: 48h                  │
└─────────────────────────────────────────────┘
```

---

# SECCIÓN 4: CALENDARIO Y SCHEDULES

## Los Cron Jobs de los Agentes

Cada agente tiene un schedule. Esto es lo que pasa automáticamente cada día:

### Día Laboral Típico (Lunes a Viernes)

| Hora | Agente | Acción |
|------|--------|--------|
| 06:00 | RADAR | Escanea tendencias AI/FinTech/LATAM |
| 06:00 | WATCHTOWER | Health check completo del sistema |
| 07:00 | DIGEST | Genera briefing matutino → WhatsApp |
| 07:00 | INBOX | Triage de emails → resumen → WhatsApp |
| 09:00 | HUNTER | Busca 5 leads para atiende.ai |
| 09:30 | FILTER | Califica los leads que HUNTER encontró |
| 10:00 | COBRO | Revisa facturas pendientes (solo lunes) |
| 11:00 | HUNTER | Segunda ronda de prospección |
| 12:00 | AI-MONITOR | Reporte de costos de la mañana |
| 14:00 | HUNTER | Tercera ronda |
| 15:00 | ESCUCHA | Escanea reviews y menciones sociales |
| 16:00 | HUNTER | Cuarta ronda |
| 17:00 | METRICS | Snapshot de KPIs del día |
| 19:00 | AI-MONITOR | Reporte diario de costos → WhatsApp |
| 19:00 | WATCHTOWER | Health check nocturno |
| 20:00 | SOCIAL | Sugiere post para mañana → WhatsApp |

### Schedules Semanales

| Día | Agente | Acción |
|-----|--------|--------|
| Lunes 08:00 | COBRO | Recordatorios de facturas pendientes |
| Lunes 10:00 | PRIORITY | Re-ranking del backlog |
| Miércoles 09:00 | COMPETE | Intel competitivo semanal |
| Viernes 16:00 | DIGEST | Resumen semanal + plan para próxima semana |
| Viernes 17:00 | BENCHMARKER | Eval de calidad de los modelos |

### Vista de Calendario en el Dashboard

```
┌──────────────────────────────────────────┐
│ CALENDAR                    < Abril >    │
├──────────────────────────────────────────┤
│ Lun 7 │ Mar 8 │ Mie 9 │ Jue 10│ Vie 11│
│────────│───────│───────│───────│───────│
│ DIGEST │       │COMPETE│       │DIGEST │
│ 07:00  │       │ 09:00 │       │ 16:00 │
│────────│       │───────│       │───────│
│ COBRO  │       │       │       │BENCH  │
│ 10:00  │       │       │       │ 17:00 │
│────────│       │       │       │       │
│PRIORITY│       │       │       │       │
│ 10:00  │       │       │       │       │
└──────────────────────────────────────────┘
```

---

# SECCIÓN 5: AHORRO DE TOKENS Y COSTOS

## Estrategias de Ahorro (de la investigación)

### 1. Prompt Caching (90% descuento en input)
- Claude Sonnet cachea el system prompt después del primer call
- Los 2 agentes Claude (PROPUESTA, SOCIAL) ahorran ~$6/mes con caching
- Gemini cachea automáticamente contexto repetido

### 2. Context Pruning (comprimir historial)
- Después de 10 mensajes, el historial se comprime a un resumen
- Un agente con 50 mensajes de historial usa ~15K tokens
- Comprimido a resumen = ~2K tokens (87% ahorro)

### 3. Model Routing (cheapest-first)
- El agente ROUTER evalúa cada request
- Si es simple → modelo free/ultra-budget
- Si es complejo o client-facing → escala
- 86% de requests se resuelven con modelos bajo $1.50/M

### 4. Circuit Breakers (para no quemar presupuesto)
- Si un agente gasta >$0.50 en 60 segundos → STOP
- Si el total diario pasa de $10 → solo agentes locales siguen
- Si una conversación pasa de 8 turnos → force stop y resumen

### 5. Batch Processing (agrupar requests)
- En vez de que HUNTER haga 4 llamadas separadas para 4 leads, hace 1 llamada con los 4
- Ahorra ~60% en tokens de overhead (system prompt repetido)

## Proyección de Costos Detallada

| Concepto | $/mes sin ahorro | $/mes con ahorro | Ahorro |
|----------|-----------------|------------------|--------|
| Primary costs | $64.44 | $64.44 | — |
| Prompt caching | — | -$6.00 | 9% |
| Context pruning | ~$15 extra sin prune | $0 | 100% |
| Model routing savings | — | -$3-5 | — |
| Circuit breakers | Potencial $50+ | $0 | — |
| **NET COST** | **~$80-130** | **$55-60** | **~30%** |

---

# SECCIÓN 6: CONVERSACIONES ENTRE AGENTES — CÓMO FUNCIONAN

## El Protocolo de Comunicación

Basado en el research de AI Town + Stanford Smallville, cada conversación sigue este protocolo:

### Paso 1: Trigger
Un evento dispara la necesidad de comunicación:
- Cron job se ejecutó (HUNTER encontró leads)
- Threshold cruzado (METRICS detectó caída de MRR)
- Handoff (QUALITY terminó tests, pasa resultado a DEPLOY)
- Javier pidió algo vía WhatsApp

### Paso 2: Routing
El sistema determina quién debe hablar con quién:
- El agente que disparó el trigger elige al destinatario basado en su knowledge de la organización
- El ROUTER valida que ambos agentes están disponibles y tienen budget

### Paso 3: Encuentro (Visual)
En el pixel world:
- Los dos agentes caminan uno hacia el otro
- Se encuentran en un punto medio
- Línea punteada amarilla los conecta

### Paso 4: Conversación (Real)
- Agente A envía su mensaje con contexto (via OpenRouter API)
- Agente B recibe el mensaje y responde (via OpenRouter API)
- Máximo 4 turnos (configurable) para controlar costos
- Cada turno se muestra en la burbuja de speech del pixel world

### Paso 5: Resultado
La conversación genera:
- Un **resumen** guardado en la base de datos
- **Acciones** (tareas) si aplica
- **Notificación** a Javier si es resultado/decisión/urgencia
- Los agentes regresan a caminar libre

### Ejemplo Real: Pipeline de Ventas

```
09:00 — HUNTER (Grok 4.1 Fast, $0.50/M) se activa por cron
         → Busca leads en directorio de restaurantes Mérida
         → Encuentra "Restaurante Maya" en Paseo Montejo

09:02 — HUNTER camina hacia FILTER en el pixel world
         HUNTER: "Encontré Restaurante Maya. Reciben 200 WhatsApps/día
                  sin automatizar. Dueño: Carlos Méndez. Revenue est: $500K/año."
         FILTER (Qwen3.6-Plus Free): "Score BANT: 8/10. Budget: probable ($200/mes
                  es nada para ellos). Authority: necesito confirmar si Carlos decide.
                  Need: ALTO. Timeline: podrían implementar en 2 semanas. Clasificación: HOT."

09:04 — FILTER camina hacia PLUMA
         FILTER: "Lead HOT: Restaurante Maya, Paseo Montejo. Score 8/10.
                  Pain: 200 WhatsApps/día sin responder."
         PLUMA (Mistral Large 3, $1.50/M): "Draft de email:
                  Asunto: ¿200 WhatsApps sin responder? Hay solución.
                  Hola Carlos, mi nombre es Javier de atiende.ai. Noté que
                  Restaurante Maya..."

09:05 — Acción generada: "Enviar email a Carlos Méndez" → JAVIER (WhatsApp notification)

09:06 — Si el lead responde → PLUMA camina hacia PROPUESTA
         PLUMA: "Carlos respondió interesado. Quiere propuesta formal."
         PROPUESTA (Claude Sonnet 4.6, $15/M): Genera propuesta completa con ROI.

COSTO TOTAL: ~$0.08 (Grok $0.02 + Free $0 + Mistral $0.03 + Sonnet $0.03 con caching)
```

---

# SECCIÓN 7: GHOST MODE — CÓMO INTERVIENES

## Tres Formas de Intervenir

### 1. Desde el Pixel World (Ghost Mode)
- Ves una conversación activa entre HUNTER y FILTER
- Clickeas en la burbuja → Tu avatar "JAVIER" aparece semi-transparente
- Escribes: "Ese restaurante es del amigo de mi papá, tengan cuidado con el approach"
- Los agentes leen tu mensaje y ajustan su respuesta
- Tu avatar desaparece cuando dejas de escribir

### 2. Desde WhatsApp
- Recibes: "🦞 PROPUESTA generó propuesta para Restaurante Maya. ¿Apruebas?"
- Respondes: "Sí pero baja el precio a $150/mes"
- PROPUESTA recibe tu feedback y ajusta
- En el pixel world, tu avatar aparece brevemente junto a PROPUESTA

### 3. Desde el Panel de Chat (Dashboard)
- Seleccionas cualquier agente del dropdown
- Le escribes directamente: "FORGE, arregla el bug del audio"
- FORGE procesa tu request como prioridad P0
- Puede delegarle a QUALITY cuando termine

## Niveles de Notificación (WhatsApp)

| Nivel | Cuándo | Formato |
|-------|--------|---------|
| 🔴 URGENTE | Bug P0, sistema caído, cliente en riesgo | Inmediato + repeat cada 15 min |
| 🟡 DECISIÓN | Necesitan tu aprobación | Inmediato, una vez |
| 🟢 RESULTADO | Propuesta lista, briefing, leads encontrados | Resumen cada 2 horas |
| ⚪ INFO | Todo lo demás | Digest nocturno 7PM |

---

# SECCIÓN 8: WHAT SUCCESS LOOKS LIKE

## Semana 1: MVP (5 agentes corriendo)
- FORGE, PROPUESTA, HUNTER, SOCIAL, WATCHTOWER
- Pixel world muestra los 5 caminando
- Una conversación real entre HUNTER→FILTER
- WhatsApp conectado, recibes el briefing matutino

## Semana 2: Fleet (50 agentes)
- Todos los 50 skills creados en OpenClaw
- Todos aparecen en el pixel world
- Cron jobs activos
- Dashboard muestra costos en tiempo real

## Semana 3: Comunicación
- Agentes hablan entre sí autónomamente
- Conversaciones se guardan en DB
- WhatsApp notifications funcionan
- Ghost mode básico (desde panel de chat)

## Semana 4: Polish
- Ghost mode en pixel world (avatar transparente)
- Task board funcional
- Calendar con todos los schedules
- Cost control con circuit breakers
- Primera semana completa de operación autónoma

## Mes 2+: Optimización
- BENCHMARKER evalúa y recomienda swaps de modelos
- PROMPT-OPT optimiza system prompts
- Javier usa el sistema 80% via WhatsApp, 20% via dashboard
- El sistema genera leads, propuestas, y contenido sin intervención humana

---

# SECCIÓN 9: RIESGOS ACTUALIZADOS (Post-Research)

| Riesgo | Prob | Mitigación |
|--------|------|------------|
| Mastra es más nuevo que LangGraph | MEDIA | Mastra tiene 22.7K stars, YC backed, $13M funding. Si falla, migrar orchestration logic a LangGraph es posible sin cambiar el frontend. |
| PixiJS performance con 50 sprites | BAJA | AI Town maneja 25+ sprites sin problemas. 50 sprites con animación simple es trivial para GPU-accelerated WebGL. |
| Conversaciones autónomas espiralan en costo | ALTA | 5 capas de cost control + circuit breakers + daily cap de $10. |
| Supabase Realtime limits | BAJA | Free tier: 200 concurrent connections, 2M messages/month. Más que suficiente para 50 agentes. |
| Redis memory en Mac Mini | BAJA | Redis usa ~50MB. Mac Mini tiene 16GB. No issue. |
| OpenClaw no soporta multi-agent nativo | MEDIA | OpenClaw maneja skills individuales. La orquestación multi-agent es nuestra capa custom con Mastra. |

---

# SECCIÓN 10: CÓMO EMPEZAR

1. **Lee este Blueprint** ← Estás aquí
2. **Revisa que estés de acuerdo** con las decisiones de stack y arquitectura
3. **Abre el CLAUDE.md** en Claude Code en tu Mac Mini
4. **Dile**: "Ejecuta FASE 0"
5. **Sigue los prompts** — Claude Code te pedirá API keys y preferencias
6. **En ~4 horas** tendrás el MVP con 5 agentes en el pixel world
7. **En ~2 semanas** tendrás el sistema completo de 50 agentes

---

*Blueprint v7.0 — Abril 7, 2026*
*Basado en investigación profunda de: AI Town (a16z), Stanford Smallville, LangGraph, CrewAI, Mastra, Langfuse, PixiJS, y 40+ fuentes adicionales.*
*Este documento es para Javier. El CLAUDE.md es para Claude Code.*
-e 

---


# ANEXO A: LOS 50 AGENTES — DETALLE COMPLETO
# PARTE 2: ROSTER DE 50 AGENTES

## De 57 a 50: Tracking Completo

### 7 Merges
| Originales | Resultado | División |
|-----------|----------|----------|
| PRISM + STRESS | **QUALITY** | Code Ops |
| VAULT + SENTINEL | **SHIELD** | Code Ops |
| LINKED + TWEET | **SOCIAL** | Brand |
| GUIÓN + PODCAST | **MEDIA** | Brand |
| DEEP + GUERRA | **COMPETE** | Strategy |
| BRIEFING + RESUMEN | **DIGEST** | Comms |
| HIELO + CADENA | **PLANTA** | Ops |

### 5 Agentes Cortados
| Cortado | Absorbido por |
|---------|---------------|
| ALIANZA | HUNTER |
| NORMA | FISCAL + LEGAL |
| FLUJO-DEAL | PIPELINE + OPORTUNIDAD |
| AGENDA | OpenClaw commands |
| ACTA | DIGEST |

### 5 Agentes Nuevos
| Nuevo | División | Razón |
|-------|----------|-------|
| PROMPT-OPT | AI Ops | Optimización de prompts ahorra tokens |
| AI-MONITOR | AI Ops | Monitoreo de salud del sistema |
| ROUTER | AI Ops | Cascada automática |
| BENCHMARKER | AI Ops | Evaluación de modelos |
| DEEP-RESEARCH | Strategy | Análisis profundo con thinking variable |

**Fórmula**: 57 - 7 - 5 + 5 = **50** ✅

---

## Free Tier Strategy

Rate limit: 200 req/día por modelo free. Coding agents distribuidos entre 2 modelos = 400 req/día combinados:
- MiniMax M2.5 Free → APEX, PIXEL, QUALITY, TRIAGE (4 agentes)
- Qwen3-Coder 480B Free → FORGE, SWIFT, DEPLOY (3 agentes)

---

## DIV 1 — CODE OPS (8 agentes, $0.00/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 1 | APEX | Arquitecto líder, system design, code review, ADRs | MiniMax M2.5 Free | Qwen3-Coder 480B Free | Gemini 3.1 Pro | $0.00 |
| 2 | FORGE | Code generation backend Python/Node.js, implementación de features | Qwen3-Coder 480B Free | MiniMax M2.5 Free | DeepSeek V3.2 | $0.00 |
| 3 | PIXEL | Frontend React/Next.js, componentes UI, Tailwind CSS, responsive | MiniMax M2.5 Free | Qwen3-Coder 480B Free | GPT-4.1 Mini | $0.00 |
| 4 | SWIFT | Mobile dev React Native/Expo, APIs móviles, push notifications | Qwen3-Coder 480B Free | MiniMax M2.5 Free | DeepSeek V3.2 | $0.00 |
| 5 | SHIELD | Security audit, vulnerability scanning, secrets detection, OWASP | Qwen3.6-Plus Free | GLM 4.5 Air Free | Gemini 2.5 Flash Lite | $0.00 |
| 6 | DEPLOY | CI/CD pipelines, Docker, GitHub Actions, infrastructure-as-code | Qwen3-Coder 480B Free | MiniMax M2.5 Free | Grok 4.1 Fast | $0.00 |
| 7 | QUALITY | Unit/integration/E2E tests, load testing, QA, coverage analysis | MiniMax M2.5 Free | Qwen3-Coder 480B Free | DeepSeek V3.2 | $0.00 |
| 8 | WATCHTOWER | System monitoring 24/7, alertas CPU/RAM/disk, uptime checks | Qwen3 8B LOCAL | Llama 3.1 8B LOCAL | Qwen3.6-Plus Free | $0.00 |

**¿Por qué $0?** MiniMax M2.5 Free (80.2% SWE-bench) y Qwen3-Coder 480B Free (78.8%) superan a la mayoría de modelos pagados. WATCHTOWER corre local porque monitoreo debe funcionar sin internet.

---

## DIV 2 — REVENUE ENGINE (10 agentes, $25.59/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 9 | HUNTER | Prospección de leads, scraping LinkedIn/directorios, research de prospectos | Grok 4.1 Fast | Qwen3.6-Plus Free | Gemini 2.5 Flash Lite | $1.10 |
| 10 | FILTER | Lead qualification BANT, scoring 1-10, enrichment de datos de contacto | Qwen3.6-Plus Free | Llama 3.3 70B Free | Grok 4.1 Fast | $0.00 |
| 11 | PLUMA | Sales copy en español mexicano: emails, WhatsApp, landing pages, ads | Mistral Large 3 | Grok 4.1 Fast | Claude Sonnet 4.6 | $3.00 |
| 12 | VOZ | Scripts de venta telefónica, guiones de llamada, objeciones y respuestas | Grok 4.1 Fast | Qwen3.6-Plus Free | Mistral Large 3 | $1.10 |
| 13 | NEXUS | CRM management, deduplicación de contactos, field normalization | IBM Granite 4.0 Micro | Mistral Nemo | Gemini 2.5 Flash Lite | $0.16 |
| 14 | PIPELINE | Sales pipeline tracking, forecasting de cierre, stage management | Qwen3.6-Plus Free | Llama 3.3 70B Free | Gemini 2.5 Flash Lite | $0.00 |
| 15 | PROPUESTA ★ | Propuestas de venta, SOWs, pitch decks, pricing, presentaciones | Claude Sonnet 4.6 | Gemini 3.1 Pro | Claude Opus 4.6 | $18.00 |
| 16 | BIENVENIDA | Onboarding de clientes: welcome kit, setup guides, kickoff docs | Gemini 2.5 Flash Lite | Mistral Small 3.2 | Grok 4.1 Fast | $0.70 |
| 17 | RETAIN | Customer retention, churn risk scoring, intervention alerts, NPS | Grok 4.1 Fast | Qwen3.6-Plus Free | Gemini 2.5 Flash Lite | $1.10 |
| 18 | COBRO | Cobranza: recordatorios de pago, seguimiento facturas, escalation | Mistral Small 3.2 | Qwen3.6-Plus Free | Mistral Large 3 | $0.43 |

**PROPUESTA** es el agente más caro ($18/mes) pero el de mayor ROI: una propuesta que cierra un deal de $5K paga 23 meses de costo. Prompt caching obligatorio (80% cache hits → $17.52 real). Escala a Opus para pitch meetings con inversores.

**HUNTER** usa Grok por su 2M context window (ingiere páginas web completas) y RL-trained tool calling, NO por ser #1 en BFCL (eso es GLM-4.5 Air Free).

---

## DIV 3 — PERSONAL BRAND (5 agentes, $19.80/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 19 | RADAR | Content opportunity detection, trending topics AI/FinTech/LATAM | Qwen3.6-Plus Free | StepFun Free | Grok 4.1 Fast | $0.00 |
| 20 | SOCIAL ★ | LinkedIn + Twitter/X: thought leadership, posts, engagement replies | Claude Sonnet 4.6 | Grok 4.1 Fast | — | $18.00 |
| 21 | MEDIA | Video scripts, podcast outlines, production planning, hooks | Grok 4.1 Fast | Qwen3.6-Plus Free | Mistral Large 3 | $1.10 |
| 22 | VISUAL | Creative briefs, image analysis, competitor visual analysis | Gemma 4 E4B LOCAL | Qwen3 8B LOCAL | Gemini 2.5 Flash Lite | $0.00 |
| 23 | CORREO | Newsletter writing, email campaigns, drip sequences, A/B variants | Gemini 2.5 Flash Lite | Mistral Small 3.2 | Mistral Large 3 | $0.70 |

**SOCIAL** es el 2° y último slot de Claude Sonnet. LinkedIn = canal #1 de inbound leads para Javier. Claude Sonnet Elo 1936 en creative writing produce la mejor prosa para thought leadership.

---

## DIV 4 — OPS & FINANCE (7 agentes, $5.29/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 24 | LEDGER | Contabilidad diaria, categorización de transacciones, reconciliación | Qwen3 8B LOCAL | DeepSeek R1-Qwen3-8B LOCAL | Gemini 2.5 Flash Lite | $0.00 |
| 25 | FLUJO | Cash flow forecasting, proyecciones financieras, escenarios | DeepSeek V3.2 | Qwen3.6-Plus Free | Gemini 2.5 Flash | $1.16 |
| 26 | FACTURA | Generación de facturas, compliance CFDI, cálculos IVA/ISR | Mistral Small 3.2 | IBM Granite 4.0 Micro | Gemini 2.5 Flash Lite | $0.43 |
| 27 | FISCAL | Tax compliance SAT: ISR, IVA, IEPS, retenciones, declaraciones | Gemini 2.5 Flash Lite | Mistral Large 3 | Claude Sonnet 4.6 | $0.70 |
| 28 | PLANTA | Operaciones fábrica de hielo + logística delivery Opero Mérida | Qwen3 8B LOCAL | Gemma 4 E4B LOCAL | Qwen3.6-Plus Free | $0.00 |
| 29 | TALENTO | HR: job postings, screening, evaluaciones, onboarding empleados | Qwen3.6-Plus Free | Llama 3.3 70B Free | Gemini 2.5 Flash Lite | $0.00 |
| 30 | LEGAL | Contratos, revisión legal, documentos corporativos, NDA, ToS | Mistral Large 3 | Gemini 2.5 Flash Lite | Claude Sonnet 4.6 | $3.00 |

**LEDGER** corre LOCAL: datos financieros sensibles nunca salen del Mac Mini. DeepSeek R1-Qwen3-8B (mejor reasoning 8B) como fallback para categorización compleja.

**FLUJO** usa DeepSeek V3.2 por su fortaleza matemática (89.3% AIME) a $0.38/M — perfecto para forecasting.

---

## DIV 5 — PRODUCT & GROWTH (8 agentes, $3.66/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 31 | PRODUCTO | Product roadmap, feature specs, user stories, sprint planning | Qwen3.6-Plus Free | Llama 3.3 70B Free | Gemini 2.5 Flash Lite | $0.00 |
| 32 | ESCUCHA | Social listening, market feedback, sentiment analysis, reviews | Grok 4.1 Fast | Qwen3.6-Plus Free | Gemini 2.5 Flash Lite | $1.10 |
| 33 | SPLIT | A/B testing design, experiment frameworks, statistical significance | Llama 3.3 70B Free | Qwen3.6-Plus Free | DeepSeek V3.2 | $0.00 |
| 34 | RANKING | SEO: keyword research, meta descriptions, SERP analysis, content scoring | Gemini 2.5 Flash Lite | Qwen3.6-Plus Free | Grok 4.1 Fast | $0.70 |
| 35 | METRICS | Analytics dashboards, KPI interpretation, trend analysis, attribution | DeepSeek V3.2 | Qwen3.6-Plus Free | Gemini 2.5 Flash | $1.16 |
| 36 | PRIORITY | Feature prioritization RICE/ICE, backlog grooming, stakeholder alignment | Qwen3.6-Plus Free | GPT-OSS 120B Free | Gemini 2.5 Flash Lite | $0.00 |
| 37 | TRIAGE | Bug categorization, error log parsing, priority assignment, routing | MiniMax M2.5 Free | Qwen3-Coder 480B Free | DeepSeek V3.2 | $0.00 |
| 38 | DOCS | API docs, READMEs, architecture docs, user guides, changelogs | Gemini 2.5 Flash Lite | Qwen3.6-Plus Free | Mistral Large 3 | $0.70 |

**RANKING** usa Gemini 2.5 Flash Lite — modelo de Google entiende inherentemente cómo Google indexa.
**METRICS** usa DeepSeek V3.2 por su fortaleza math (89.3% AIME) para interpretar analytics.

---

## DIV 6 — AI OPERATIONS (4 agentes, $0.80/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 39 | PROMPT-OPT | Prompt engineering, template refinement, few-shot curation, testing | Gemini 2.5 Flash Lite | Qwen3.6-Plus Free | Gemini 2.5 Flash | $0.70 |
| 40 | AI-MONITOR | Agent health checks, cost tracking, latency monitoring, uptime alerts | Llama 3.1 8B LOCAL | Qwen3 8B LOCAL | Gemini 2.5 Flash Lite | $0.00 |
| 41 | ROUTER | Escalation routing, quality gates, model selection, fallback logic | Mistral Nemo | IBM Granite 4.0 Micro | Grok 4.1 Fast | $0.10 |
| 42 | BENCHMARKER | A/B testing de modelos, quality scoring, regression detection, evals | GPT-OSS 120B Free | Qwen3.6-Plus Free | Gemini 2.5 Flash | $0.00 |

**AI-MONITOR** corre LOCAL (Llama 3.1 8B a 35-41 tok/s, el más rápido). Monitorea 24/7 sin depender de internet.
**ROUTER** usa Mistral Nemo ($0.02/$0.04) — el modelo más barato con tool calling para miles de routing decisions/día.

---

## DIV 7 — STRATEGY & INTELLIGENCE (5 agentes, $5.60/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 43 | COMPETE | Competitive intel, war-gaming, SWOT analysis, feature comparison | Grok 4.1 Fast | Qwen3.6-Plus Free | Gemini 3.1 Pro | $1.10 |
| 44 | OPORTUNIDAD | Market opportunity identification, TAM/SAM sizing, gap analysis | Qwen3.6-Plus Free | StepFun Free | Grok 4.1 Fast | $0.00 |
| 45 | INVESTOR | Investor deck prep, pitch materials, due diligence docs, data room | Grok 4.1 Fast | Gemini 2.5 Flash Lite | Claude Sonnet 4.6 | $1.10 |
| 46 | TENDENCIA | Trend scanning, emerging tech monitoring, weak-signal detection | GPT-OSS 120B Free | Qwen3.6-Plus Free | Gemini 2.5 Flash Lite | $0.00 |
| 47 | DEEP-RESEARCH | Multi-source synthesis, literature review, deep analysis variable | Gemini 2.5 Flash | Qwen3.6-Plus Free | Gemini 3.1 Pro | $3.40 |

**DEEP-RESEARCH** usa Gemini 2.5 Flash ($0.30/$2.50) por su thinking budget control único: queries simples = 0 thinking tokens ($0), análisis complejos = hasta 24K thinking tokens. Pagas solo la profundidad que necesitas. Escalation a Gemini 3.1 Pro (94.3% GPQA Diamond, #1 en research).

---

## DIV 8 — COMMS & LANGUAGE (3 agentes, $3.70/mes)

| # | Código | Función | Primary | Fallback | Escalation | $/mes |
|---|--------|---------|---------|----------|------------|-------|
| 48 | INBOX | Email triage, priorización, draft replies, spam filtering | Qwen3 8B LOCAL | Gemma 4 E4B LOCAL | Gemini 2.5 Flash Lite | $0.00 |
| 49 | DIGEST | Daily briefings, document summaries, action items, weekly reports | Gemini 2.5 Flash Lite | Qwen3.6-Plus Free | Mistral Large 3 | $0.70 |
| 50 | TRADUCE | Translation EN↔ES mexicano, localización, terminology consistency | Mistral Large 3 | Qwen3.6-Plus Free | Claude Sonnet 4.6 | $3.00 |

**INBOX** corre LOCAL: emails personales nunca salen del Mac Mini.
**TRADUCE** usa Mistral Large 3 (82.7% Spanish MMLU) — empresa europea con foco en idiomas.

---

## BUDGET FINAL VERIFICADO

### Por División
| Div | Nombre | Agentes | Total $/mes |
|-----|--------|---------|------------|
| 1 | Code Ops | 8 | $0.00 |
| 2 | Revenue Engine | 10 | $25.59 |
| 3 | Personal Brand | 5 | $19.80 |
| 4 | Ops & Finance | 7 | $5.29 |
| 5 | Product & Growth | 8 | $3.66 |
| 6 | AI Operations | 4 | $0.80 |
| 7 | Strategy | 5 | $5.60 |
| 8 | Comms & Language | 3 | $3.70 |
| **TOTAL** | | **50** | **$64.44** |

### Por Tier
| Tier | Agentes | Costo $/mes |
|------|---------|------------|
| FREE (OpenRouter) | 18 | $0.00 |
| LOCAL (Ollama) | 6 | $0.00 |
| ULTRA (<$0.15/M) | 2 | $0.26 |
| BUDGET ($0.20-$1.50/M) | 21 | $24.78 |
| MID ($2.50/M) | 1 | $3.40 |
| PREMIUM ($15/M) | 2 | $36.00 |
| **TOTAL** | **50** | **$64.44** |

Check: 18+6+2+21+1+2 = 50 ✅ | $0+0+0.26+24.78+3.40+36.00 = $64.44 ✅

### Por Modelo Primary
| Modelo | # Agentes | Agentes | $/total |
|--------|----------|---------|---------|
| Qwen3.6-Plus Free | 8 | SHIELD, FILTER, PIPELINE, RADAR, TALENTO, PRODUCTO, PRIORITY, OPORTUNIDAD | $0.00 |
| Grok 4.1 Fast | 7 | HUNTER, VOZ, RETAIN, ESCUCHA, COMPETE, INVESTOR, MEDIA | $7.70 |
| Gemini 2.5 Flash Lite | 7 | BIENVENIDA, FISCAL, RANKING, DOCS, PROMPT-OPT, CORREO, DIGEST | $4.90 |
| MiniMax M2.5 Free | 4 | APEX, PIXEL, QUALITY, TRIAGE | $0.00 |
| Qwen3 8B Local | 4 | WATCHTOWER, LEDGER, PLANTA, INBOX | $0.00 |
| Mistral Large 3 | 3 | PLUMA, LEGAL, TRADUCE | $9.00 |
| Qwen3-Coder 480B Free | 3 | FORGE, SWIFT, DEPLOY | $0.00 |
| Claude Sonnet 4.6 | 2 | PROPUESTA, SOCIAL | $36.00 |
| DeepSeek V3.2 | 2 | FLUJO, METRICS | $2.32 |
| Mistral Small 3.2 | 2 | FACTURA, COBRO | $0.86 |
| GPT-OSS 120B Free | 2 | TENDENCIA, BENCHMARKER | $0.00 |
| Gemini 2.5 Flash | 1 | DEEP-RESEARCH | $3.40 |
| Gemma 4 E4B Local | 1 | VISUAL | $0.00 |
| Llama 3.3 70B Free | 1 | SPLIT | $0.00 |
| Llama 3.1 8B Local | 1 | AI-MONITOR | $0.00 |
| IBM Granite 4.0 Micro | 1 | NEXUS | $0.16 |
| Mistral Nemo | 1 | ROUTER | $0.10 |
| **TOTAL** | **50** | | **$64.44** ✅ |

### Proyección con Escalation
| Concepto | $/mes |
|----------|-------|
| Primary | $64.44 |
| Escalation (~8%) | $20-35 |
| Free overflow | $3-8 |
| Spikes | $10-20 |
| **Proyectado** | **$97-127** |
| **Budget** | **$200** |
| **Buffer** | **$73-103** |

---

## TOP 5 ROI AGENTS

| # | Agente | $/mes | ROI |
|---|--------|-------|-----|
| 1 | FORGE | $0 | Cada feature construida = valor puro. MiniMax M2.5 Free a 80.2% SWE-bench. |
| 2 | PROPUESTA | $18 | Un deal de $5K = 278x ROI mensual. Claude Sonnet para prosa que cierra. |
| 3 | HUNTER | $1.10 | Un lead convertido/trimestre = 1,000x ROI. Grok 4.1 Fast con 2M context. |
| 4 | SOCIAL | $18 | LinkedIn inbound pipeline vale $10K+/mes. Claude Sonnet thought leadership. |
| 5 | FISCAL | $0.70 | Previene multas SAT 55-75% del adeudo. $0.70/mes evita desastres de 5 cifras. |

## BOTTOM 5 EXPENDABLE (cortar si aprieta)

| # | Agente | $/mes | Por qué prescindible |
|---|--------|-------|---------------------|
| 1 | BENCHMARKER | $0 | Evaluación manual trimestral sustituye |
| 2 | VISUAL | $0 | Creative briefs manuales o SOCIAL absorbe |
| 3 | MEDIA | $1.10 | Scripts video/podcast = nice-to-have |
| 4 | SPLIT | $0 | A/B testing manual con herramientas existentes |
| 5 | TENDENCIA | $0 | RSS + Twitter lists = 80% de la detección |

---

## Gemini Integration Map

| Modelo Gemini | Primary | Fallback/Escalation | Precio |
|--------------|---------|-------------------|--------|
| Gemini 2.5 Flash Lite | 7 agentes | ~15 slots | $0.10/$0.40 |
| Gemini 2.5 Flash | 1 agente | 3 slots | $0.30/$2.50 |
| Gemini 3.1 Pro | 0 agentes | 3 escalation | $2/$12 |
| Gemma 4 E4B Local | 1 agente | 3 fallback | $0 |

Gemini presente en **33 de 50 agentes** (9 primary + ~24 fallback/escalation).

---

## Notas Técnicas

**DeepSeek V3.2 SWE-bench**: 77.2% (self-reported) vs 67.8% (VERTU independiente). No afecta el sistema — DeepSeek es primary solo para math (FLUJO, METRICS), no coding.

**MiniMax M2.7** ($0.30/$1.20): Nuevo, 56.2% SWE-Pro, 57.0% Terminal-Bench. Candidato futuro si el free tier no alcanza.

**Grok 4.1 Fast**: Usado por 2M context + #1 EQ-Bench3, NO por tool calling. GLM-4.5 Air Free es #1 BFCL (76.7%).

**Claude Sonnet caching**: Con 80% cache hits = $17.52/mes. Sin caching = $24/mes. Prompt caching es OBLIGATORIO para PROPUESTA y SOCIAL.
-e 

---


# ANEXO B: BENCHMARKS POR CATEGORÍA
## Categoría 1: CODING BACKEND (Python, Node.js, APIs, Microservices)

**Benchmark principal**: SWE-bench Verified — resuelve issues reales de GitHub repositories

| Rank | Modelo | SWE-bench V | Output $/M | Tier |
|------|--------|-------------|-----------|------|
| 1 | Claude Opus 4.6 | 80.8% | $25.00 | PREMIUM |
| 2 | Gemini 3.1 Pro | 80.6% | $12.00 | PREMIUM |
| 3 | MiniMax M2.5 | 80.2% | **FREE** | FREE |
| 4 | Claude Sonnet 4.6 | 79.6% | $15.00 | PREMIUM |
| 5 | Qwen3-Coder 480B | 78.8% | **FREE** | FREE |
| 6 | DeepSeek V3.2 | 67.8-77.2%* | $0.38 | BUDGET |
| 7 | Kimi K2.5 | 76.8% | $2.20 | MID |
| 8 | GLM-4.7 | 73.8% | $1.50 | MID |

*DeepSeek V3.2: 77.2% self-reported, 67.8% en leaderboard independiente VERTU. La diferencia se debe al scaffold de evaluación usado.

**SWE-bench Pro** (más difícil, anti-contaminación):
- GPT-5.4: 57.7% (#1)
- MiniMax M2.7: 56.2% (#2)
- Claude Opus 4.6: ~46%
- Gemini 3.1 Pro: ~45%

**BenchLM Weighted Coding Score** (SWE-Rebench + Pro + LiveCodeBench combinados):
- GPT-5.4: 73.9
- Claude Opus 4.6: 72.5
- Kimi K2.5 Reasoning: 70.4

**Veredicto**: MiniMax M2.5 Free (80.2%) como primary. Qwen3-Coder 480B Free (78.8%) como fallback. Escalation a Gemini 3.1 Pro ($12/M) que iguala a Opus a mitad de precio.

**Qué dicen los devs**: "Claude catches cross-file dependencies and race conditions." Un dev alimentó un backend FastAPI de ~15,000 líneas y Claude detectó un circular import de 3 días. Pero para tareas rutinarias, MiniMax y Qwen3-Coder son "good enough" sin costo.

---

## Categoría 2: CODING FRONTEND (React, Next.js, CSS, Tailwind, UI)

**Benchmark principal**: Coding Arena (llm-stats.com) — votos humanos en generación de websites

| Rank | Modelo | Arena Score | Output $/M |
|------|--------|-------------|-----------|
| 1 | GPT-5.4 Mini | 1075 | $1.60 |
| 2 | Claude Sonnet 4.6 | 1062 | $15.00 |
| 3 | Claude Opus 4.6 | ~1050 | $25.00 |

**Insight clave**: GPT-5 tiene la mejor "aesthetic intelligence and typography" — líder específico en frontend visual. Claude Opus domina en "UI glue and product decisions" según Adam Holter. Para frontend estándar, MiniMax y Qwen3-Coder son suficientes; la escalation a GPT-4.1 Mini ($1.60/M) se activa cuando se necesita que el componente se VEA bien.

**Veredicto**: Free models para código funcional. GPT-4.1 Mini como escalation para UI visual.

---

## Categoría 3: DEVOPS (Docker, CI/CD, Terminal, Infrastructure)

**Benchmark principal**: Terminal-Bench — tareas de sysadmin, git, CI/CD en terminal real

| Rank | Modelo | Terminal-Bench | Output $/M |
|------|--------|---------------|-----------|
| 1 | GPT-5.4 | 75.1% | $15.00 |
| 2 | MiniMax M2.7 | 57.0% | $1.20 |
| 3 | Gemini 3.1 Pro | 68.5% | $12.00 |
| 4 | Claude Opus 4.6 | 65.4% | $25.00 |

**Terminal-Bench es la PEOR categoría de Claude** — 9.7 puntos detrás de GPT-5.4. Para Dockerfiles, GitHub Actions, y deployment scripts, Claude no es la respuesta.

**Veredicto**: Qwen3-Coder Free para DevOps rutinario. Grok 4.1 Fast ($0.50/M) como escalation. NO usar Claude para terminal tasks.

---

## Categoría 4: CODE REVIEW & DEBUGGING

**Benchmarks**: Aider Polyglot (edición multi-lenguaje), SWE-bench (detección de bugs)

| Rank | Modelo | Fortaleza |
|------|--------|-----------|
| 1 | Claude Opus 4.6 | Arquitectural, cross-file, race conditions |
| 2 | Claude Sonnet 4.6 | 95% de Opus en debugging práctico |
| 3 | GPT-5.3 Codex | "Digs deeper for root causes, pushes back" |
| 4 | DeepSeek V3.2 | Bug detection estándar, barato |
| 5 | Gemini 3.1 Pro | 1M context para análisis multi-file |

**Veredicto**: Free models para review rutinario. Gemini 3.1 Pro como escalation para análisis arquitectural.

---

## Categoría 5: SEO (Keywords, Meta, Content Optimization)

**No hay benchmark estándar de SEO.** Mejor proxy: structured writing + search intent understanding.

| Rank | Modelo | Fortaleza SEO | Output $/M |
|------|--------|--------------|-----------|
| 1 | Gemini 2.5 Flash Lite | Google-native, entiende indexación | $0.40 |
| 2 | GPT-5.4 | Structured outputs, format consistente | $15.00 |
| 3 | Claude Sonnet 4.6 | Content depth, topical authority | $15.00 |
| 4 | Qwen3.6-Plus Free | 1M context para análisis masivo | FREE |

**Insight 2026**: SEO ya no es solo Google. Ahora es LLM SEO — aparecer citado en ChatGPT, Perplexity, Claude. Gemini tiene ventaja inherente como modelo de Google. El 60% de búsquedas terminan sin click (AI Overviews).

**Veredicto**: Gemini 2.5 Flash Lite ($0.40/M) — Google-native, 1M context. Free: Qwen3.6-Plus.

---

## Categoría 6: ESCRITURA LONG-FORM (Blog, Articles, Whitepapers)

**Benchmark principal**: EQ-Bench Creative Writing v3 (Elo scale ~1400-1940)

| Rank | Modelo | EQ-Bench CW | Output $/M |
|------|--------|-------------|-----------|
| 1 | Claude Sonnet 4.6 | Elo 1936 | $15.00 |
| 2 | Claude Opus 4.6 | Elo 1932 | $25.00 |
| 3 | Grok 4.1 Fast | #1 EQ-Bench3 | $0.50 |
| 4 | GPT-5.4 | Bueno para structured copy | $15.00 |
| 5 | Kimi K2 | ~Elo 1700 | $2.50 |

**Lechmazur Writing Benchmark** (constraint satisfaction + narrative craft): DeepSeek V3.2 Exp score highest (9.50-9.53) en múltiples graders. Grok 4.1 Fast Reasoning alcanzó 9.61 en un grader.

**Veredicto**: Grok 4.1 Fast ($0.50/M) para contenido diario — #1 EQ-Bench3, personalidad engaging. Claude Sonnet para contenido premium client-facing.

---

## Categoría 7: SALES COPY (Emails, WhatsApp, Landing Pages)

| Rank | Modelo | Fortaleza | Output $/M | Idioma |
|------|--------|-----------|-----------|--------|
| 1 | Claude Sonnet 4.6 | Persuasión sofisticada | $15.00 | Excelente ES |
| 2 | Mistral Large 3 | 82.7% Spanish MMLU | $1.50 | **Mejor ES precio** |
| 3 | Grok 4.1 Fast | Engagement emocional | $0.50 | Aceptable ES |

**Veredicto**: Mistral Large 3 ($1.50/M) para sales copy en español mexicano. Claude Sonnet como escalation para propuestas enterprise.

---

## Categoría 8: DOCUMENTACIÓN TÉCNICA

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Opus 4.5 | "Most coherent technical explanations" | $25.00 |
| 2 | Gemini 3.1 Pro | 1M context, full codebase docs | $12.00 |
| 3 | Gemini 2.5 Flash Lite | Budget docs, 1M context | $0.40 |

**Veredicto**: Gemini 2.5 Flash Lite para docs rutinarias. Claude Sonnet para docs de producto client-facing.

---

## Categoría 9: PROPUESTAS & PITCH DECKS

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Sonnet 4.6 | Persuasión + estructura + tono profesional | $15.00 |
| 2 | Claude Opus 4.6 | Razonamiento profundo para estrategia | $25.00 |
| 3 | Gemini 3.1 Pro | Análisis + narrativa | $12.00 |

**Veredicto**: Claude Sonnet 4.6 — INSUSTITUIBLE. Una propuesta de $5K paga 2+ años del agente ($18/mes).

---

## Categoría 10: SCRIPTS VIDEO/PODCAST

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Grok 4.1 Fast | Personalidad, humor, hooks | $0.50 |
| 2 | Claude Sonnet 4.6 | Narrativa profunda | $15.00 |

**Veredicto**: Grok 4.1 Fast — su #1 EQ-Bench3 (emotional intelligence) produce scripts con personalidad a bajo costo.

---

## Categoría 11: SOCIAL MEDIA (LinkedIn, Twitter/X)

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Sonnet 4.6 | Thought leadership profesional | $15.00 |
| 2 | Grok 4.1 Fast | Punchy, viral, engaging | $0.50 |

**LinkedIn** = Claude Sonnet (tono profesional con personalidad)
**Twitter/X** = Grok 4.1 Fast (conciso, viral)

---

## Categoría 12: RESEARCH & ANALYSIS

**Benchmark principal**: GPQA Diamond (preguntas PhD-level en ciencia)

| Rank | Modelo | GPQA Diamond | Output $/M |
|------|--------|-------------|-----------|
| 1 | Gemini 3.1 Pro | **94.3%** | $12.00 |
| 2 | GPT-5.4 | 92.8% | $15.00 |
| 3 | Claude Opus 4.6 | 91.3% | $25.00 |
| 4 | GLM-4.7 | 85.7% | $1.50 |

**Veredicto**: Gemini 3.1 Pro supera a Claude Opus en research puro a mitad de precio. Gemini 2.5 Flash con thinking budget como primary para research variable.

---

## Categoría 13: MATH & FINANCIAL ANALYSIS

**Benchmark principal**: AIME 2025 (olimpiada de matemáticas)

| Rank | Modelo | AIME 2025 | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Opus 4.6 | 99.8% | $25.00 |
| 2 | Kimi K2 Thinking | 99.8% | $2.50 |
| 3 | GLM-4.7 | 95.7% | $1.50 |
| 4 | DeepSeek V3.2 | 89.3% | $0.38 |

**Veredicto**: DeepSeek V3.2 ($0.38/M) — math gold medalist a precio de regalo para forecasting.

---

## Categoría 14: DATA EXTRACTION & STRUCTURED OUTPUT

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | GPT-4.1 | **100% guaranteed JSON** adherence | $1.60 |
| 2 | Gemini 2.5 Flash Lite | Good structured output | $0.40 |
| 3 | IBM Granite 4.0 Micro | Cheapest tool-calling | $0.11 |

**OpenAI es el ÚNICO que garantiza 100% JSON schema adherence.** Todos los demás tienen error rates variables.

**Veredicto**: IBM Granite 4.0 Micro ($0.11/M) como cheapest. GPT-4.1 Mini cuando se necesita JSON perfecto.

---

## Categoría 15: TRADUCCIÓN (English ↔ Español Mexicano)

| Rank | Modelo | Calidad Español | Output $/M |
|------|--------|----------------|-----------|
| 1 | Claude Sonnet 4.6 | 98.2% of English baseline | $15.00 |
| 2 | Mistral Large 3 | 82.7% Spanish MMLU | $1.50 |
| 3 | Qwen3.6-Plus | 119 idiomas | FREE |

**TODOS requieren prompt**: `"Usa español mexicano (es-MX). Vocabulario: computadora, carro, celular. Formato: 1,234.56. Moneda: MXN. Tratamiento: ustedes."`

**Veredicto**: Mistral Large 3 para traducción diaria. Claude Sonnet para traducciones client-facing.

---

## Categoría 16: TOOL CALLING & FUNCTION CALLING

**Benchmark principal**: BFCL v3 (Berkeley Function Calling Leaderboard)

| Rank | Modelo | BFCL v3 | Output $/M |
|------|--------|---------|-----------|
| 1 | GLM-4.5 | **76.7%** | FREE |
| 2 | Qwen3 32B | 75.7% | $0.18 |
| 3 | Claude Opus 4.1 | 70.4% | $75.00 |

**TAU-bench** (multi-turn agentic con tools):
| Rank | Modelo | Telecom | Retail |
|------|--------|---------|--------|
| 1 | Claude Opus 4.6 | **99.3%** | **91.9%** |
| 2 | Claude Sonnet 4.6 | 97.9% | ~88% |
| 3 | GPT-5 | 56.7% | — |

**Insight CRÍTICO**: Para tool calling simple, GLM-4.5 Free es #1. Para agentic multi-turn, Claude domina con 99.3% vs GPT 56.7%. La diferencia es ABISMAL.

**Veredicto**: Grok 4.1 Fast para agentic (2M context, RL-trained). GLM-4.5 Air Free como fallback de tool calling. Claude como escalation para multi-turn complejo.

---

## Categoría 17: CUSTOMER SERVICE / CONVERSATIONAL

**Benchmark**: EQ-Bench3 (emotional intelligence)

| Rank | Modelo | Posición | Output $/M |
|------|--------|----------|-----------|
| 1 | Grok 4.1 | #1 EQ-Bench3 | $0.50 |
| 2 | Claude Opus 4.6 | Top 3 | $25.00 |

**Veredicto**: Grok 4.1 Fast — mejor empatía y naturalidad a $0.50/M.

---

## Categoría 18: LEGAL (Contratos, Compliance, SAT)

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Sonnet 4.6 | Precisión, español formal | $15.00 |
| 2 | Mistral Large 3 | EU data residency, español 82.7% | $1.50 |
| 3 | Gemini 2.5 Flash Lite | 1M context para docs legales largos | $0.40 |

**Ningún modelo está entrenado en derecho mexicano.** Se requiere prompt engineering pesado con contexto ISR, IVA, CFDI, SAT.

**Veredicto**: Mistral Large 3 para español formal legal diario. Claude Sonnet como escalation para contratos client-facing.

---

## Categoría 19: UI/UX DESIGN ANALYSIS (Multimodal)

| Rank | Modelo | Fortaleza | Output $/M |
|------|--------|-----------|-----------|
| 1 | Claude Opus 4.6 | "Best for UI work" — consenso dev | $25.00 |
| 2 | GPT-5 | Aesthetic intelligence, typography | $7.50 |
| 3 | Gemma 4 E4B Local | Multimodal, 28-35 tok/s en M4 | FREE |

**Veredicto**: Gemma 4 E4B LOCAL para análisis visual rápido. Gemini 2.5 Flash Lite como escalation con visión.

---

## Categoría 20: AGENTIC ORCHESTRATION (Routing, Planning, Multi-step)

**Benchmarks**: TAU-bench, GAIA, Vending-Bench 2

| Rank | Modelo | TAU-bench | GAIA |
|------|--------|-----------|------|
| 1 | Claude Opus 4.6 | 99.3% | Top 6 (74.6% con HAL) |
| 2 | Claude Sonnet 4.6 | 97.9% | ~72% |
| 3 | GPT-5 | 56.7% | — |

**Insight**: "The orchestration layer matters as much as the model." El MISMO Claude Opus score 64.9% en HAL vs 57.6% en otro framework — 7 puntos de diferencia SOLO por la orquestación.

**Veredicto**: Para routing simple, Grok 4.1 Fast. Para planning multi-step, Claude Sonnet 4.6 como escalation.

---

## TABLA MAESTRA: Mejor Modelo por Categoría

| # | Categoría | Mejor Absoluto | Mejor Gratis | Mejor Costo-Beneficio |
|---|-----------|---------------|--------------|----------------------|
| 1 | Backend Coding | Claude Opus 4.6 | MiniMax M2.5 (80.2%) | DeepSeek V3.2 ($0.38) |
| 2 | Frontend Coding | GPT-5.4 Mini | MiniMax M2.5 | GPT-4.1 Mini ($1.60) |
| 3 | DevOps/Terminal | GPT-5.4 (75.1%) | Qwen3-Coder 480B | Grok 4.1 Fast ($0.50) |
| 4 | Code Review | Claude Opus 4.6 | MiniMax M2.5 | Gemini 3.1 Pro ($12) |
| 5 | SEO | Gemini Flash Lite | Qwen3.6-Plus | Gemini Flash Lite ($0.40) |
| 6 | Long-form Writing | Claude Sonnet (1936) | Qwen3.6-Plus | Grok 4.1 Fast ($0.50) |
| 7 | Sales Copy ES | Claude Sonnet 4.6 | Qwen3.6-Plus | Mistral Large 3 ($1.50) |
| 8 | Tech Docs | Claude Opus 4.5 | Qwen3.6-Plus | Gemini Flash Lite ($0.40) |
| 9 | Proposals | Claude Sonnet 4.6 | — | Claude Sonnet ($15) |
| 10 | Video Scripts | Grok 4.1 (#1 EQ) | Qwen3.6-Plus | Grok 4.1 Fast ($0.50) |
| 11 | Social Media | Claude Sonnet 4.6 | Qwen3.6-Plus | Grok 4.1 Fast ($0.50) |
| 12 | Research | Gemini 3.1 Pro (94.3%) | Qwen3.6-Plus | Gemini 2.5 Flash ($2.50) |
| 13 | Math/Finance | Claude Opus (99.8%) | — | DeepSeek V3.2 ($0.38) |
| 14 | Data Extraction | GPT-4.1 (100% JSON) | Qwen3.6-Plus | IBM Granite ($0.11) |
| 15 | Translation ES | Claude Sonnet (98.2%) | Qwen3.6-Plus | Mistral Large 3 ($1.50) |
| 16 | Tool Calling | GLM-4.5 (76.7%) | GLM-4.5 Air Free | Grok 4.1 Fast ($0.50) |
| 17 | Customer Service | Grok 4.1 (#1 EQ) | Qwen3.6-Plus | Grok 4.1 Fast ($0.50) |
| 18 | Legal Docs | Claude Sonnet 4.6 | — | Mistral Large 3 ($1.50) |
| 19 | UI/UX Analysis | Claude Opus 4.6 | Gemma 4 E4B local | Gemini Flash Lite ($0.40) |
| 20 | Orchestration | Claude Opus (99.3%) | — | Grok 4.1 Fast ($0.50) |

## Los 5 Modelos Más Usados

1. **Qwen3.6-Plus Free** — Mejor gratis en 12/20 categorías. El Swiss Army Knife.
2. **Grok 4.1 Fast ($0.50/M)** — Mejor costo-beneficio en 7/20. El workhorse pagado.
3. **Claude Sonnet 4.6 ($15/M)** — Mejor absoluto en 6/20. El premium selectivo.
4. **Gemini 2.5 Flash Lite ($0.40/M)** — Haiku killer en 4/20 non-coding.
5. **MiniMax M2.5 Free** — Mejor free para coding (80.2% SWE-bench).

---

## PRICING REFERENCE COMPLETO (OpenRouter, Abril 7, 2026)

### Modelos Gratuitos Confirmados
| Modelo | Context | Tool Calling | Mejor Para |
|--------|---------|-------------|------------|
| Qwen3.6-Plus | 1M | ✅ | General, research, 119 idiomas |
| Qwen3-Coder 480B | 262K | ✅ | Coding (78.8% SWE-bench) |
| MiniMax M2.5 | 197K | ✅ | Coding (80.2% SWE-bench) |
| Llama 3.3 70B | 131K | ✅ | General (IFEval 92.1%) |
| GLM 4.5 Air | 131K | ✅ | Tool calling (#1 BFCL 76.7%) |
| GPT-OSS 120B | 131K | ✅ | General open-source |
| StepFun Step 3.5 Flash | 262K | ✅ | Agentic tasks |
| Kimi K2 | 131K | ✅ | General |
| Molmo 2 8B | 4K | ❌ | Vision-language |

Rate limit free tier: **20 req/min, 200 req/día** por modelo sin créditos. Posiblemente mayor con $10+ créditos (no confirmado oficialmente).

### Modelos Locales (Mac Mini M4 16GB, $0)
| Modelo | Speed | RAM | Mejor Para |
|--------|-------|-----|------------|
| Qwen3 8B | 28-35 tok/s | ~5.2GB | All-rounder, dual thinking |
| Gemma 4 E4B | 28-35 tok/s | ~3.5GB Q4 | Multimodal, quality |
| DeepSeek R1-Qwen3-8B | 28-35 tok/s | ~6GB | Reasoning |
| Llama 3.1 8B | 35-41 tok/s | ~5.5GB | Speed, ecosystem |

Pueden correr 2 simultáneamente (~8.7GB). Ollama gestiona swap automático.

### Modelos Pagados por Tier
| Tier | Modelo | Input/M | Output/M | Costo/agente/mes* |
|------|--------|---------|----------|-------------------|
| ULTRA | IBM Granite 4.0 Micro | $0.017 | $0.11 | $0.16 |
| ULTRA | Mistral Nemo | $0.02 | $0.04 | $0.10 |
| ULTRA | Amazon Nova Micro | $0.035 | $0.14 | $0.25 |
| BUDGET | Mistral Small 3.2 | $0.075 | $0.20 | $0.43 |
| BUDGET | DeepSeek V3.2 | $0.26 | $0.38 | $1.16 |
| BUDGET | Gemini 2.5 Flash Lite | $0.10 | $0.40 | $0.70 |
| BUDGET | Grok 4.1 Fast | $0.20 | $0.50 | $1.10 |
| BUDGET | GLM 4 32B | $0.10 | $0.10 | $0.40 |
| BUDGET | Mistral Large 3 | $0.50 | $1.50 | $3.00 |
| MID | GPT-4.1 Mini | $0.40 | $1.60 | $2.00 |
| MID | Gemini 2.5 Flash | $0.30 | $2.50 | $3.40 |
| PREMIUM | Gemini 3.1 Pro | $2.00 | $12.00 | $14.00 |
| PREMIUM | Claude Sonnet 4.6 | $3.00 | $15.00 | $18.00** |
| PREMIUM | Claude Opus 4.6 | $5.00 | $25.00 | $30.00** |

*Basado en 3M input + 1M output tokens/mes por agente
