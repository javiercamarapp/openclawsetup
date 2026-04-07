# BLUEPRINT: Agent Command Center — El Dashboard
## Cada Pantalla, Cada Botón, Cada Interacción
### Solo el software. Los agentes y modelos están en otro documento.

---

# ESTILO VISUAL: Light Mode Profesional

**Referencia**: Linear meets SimCity. Herramienta de trabajo seria con mundo pixel integrado.

**Paleta**: Fondo blanco (#FFF). Surfaces #F8F9FA. Borders #E5E7EB. Texto #111827/#6B7280. Accent azul #2563EB. Success #059669. Warning #D97706. Danger #DC2626.

**8 colores de división**: Cyan (Code Ops), Green (Revenue), Violet (Brand), Amber (Ops/Fin), Pink (Product), Orange (AI Ops), Blue (Strategy), Purple (Comms).

**Tipografía**: Inter 600 headings, Inter 400 body, JetBrains Mono para datos/costos, Press Start 2P solo dentro del pixel world canvas.

**Principios**: (1) Pixel World ocupa 60%+ en Home. (2) Whitespace generoso. (3) Borders sutiles 1px, radius 12px. (4) Zero gradientes. (5) Datos en monospace. (6) Animaciones 200ms. (7) Diseñado para monitor, no mobile.

---

# LAYOUT PRINCIPAL

```
┌──────────────────────────────────────────────────────────────┐
│ 🦞 Agent Command Center    [World] [Tasks] [Costs] [Log] ⚙️ │
├──────────────────────────────────────────────────────────────┤
│                   CONTENIDO DE TAB ACTIVA                    │
└──────────────────────────────────────────────────────────────┘
```

**Header (56px fija)**: Logo 🦞 + nombre. 4 tabs (underline azul en activa). Right side: dot de status (verde/rojo pulsante), "$3.41 today" monospace, badge rojo con # tasks pendientes, ⚙️ abre Config.

---

# PANTALLA 1: PIXEL WORLD (Home, tab default) — 60% del diseño

## Layout

```
┌───────────────────────────────────┬───────────────────┐
│                                   │                   │
│     PIXEL WORLD CANVAS            │   SIDEBAR 320px   │
│     (flex:1, min 650px)           │                   │
│                                   │   ┌─────────────┐ │
│   8 zonas, 50 sprites,           │   │ ACTIVITY    │ │
│   burbujas, ghost avatar          │   │ FEED        │ │
│                                   │   │ (scroll)    │ │
│                                   │   │             │ │
├───────────────────────────────────┤   │             │ │
│ CONVERSATION BOX (colapsable)     │   ├─────────────┤ │
│ Mensajes + [input de Javier]      │   │ KPI CARDS   │ │
├───────────────────────────────────┤   │ 2×2 grid    │ │
│ AGENT BAR (chips → scroll horiz)  │   └─────────────┘ │
└───────────────────────────────────┴───────────────────┘
```

## El Canvas: 750×400px, PixiJS 8 (WebGL GPU-accelerated)

**Background**: Blanco con grid 16px en #F3F4F6.

**8 Zonas de División**: Rectángulos con border dashed (color de div al 30%), label 8px en esquina, background al 3%. Agentes caminan DENTRO de su zona, salen solo para conversaciones cross-division.

```
┌──────────────┬───────────────────┬──────────┬──────────┐
│  CODE OPS    │     REVENUE       │  BRAND   │ OPS/FIN  │
│  cyan, 8 ag  │     green, 10 ag  │ violet,5 │ amber,7  │
├──────────────┼─────────┬─────────┼──────────┴──────────┤
│  PRODUCT     │ AI OPS  │ STRAT   │      COMMS          │
│  pink, 8 ag  │orange,4 │ blue,5  │     purple, 3 ag    │
└──────────────┴─────────┴─────────┴─────────────────────┘
```

## Sprites: 12×16px (escalado 2x = 24×32 en pantalla)

**Anatomía**: Cabeza 4×4 (#F5DEB3) + cuerpo 4×8 (color de división) + piernas 2×4 (alternan caminando).
**Nombre**: 7px Inter debajo, color de división.

| Estado | Visual | Cuándo |
|--------|--------|--------|
| idle | Parado, pestañea cada 3-5s | Sin tarea |
| walking | Piernas alternan 8 frames, se mueve | Caminando a posición random o hacia otro agente |
| talking | Burbuja de 3 dots pulsantes arriba | Esperando respuesta API |
| active | Glow sutil color de div | Ejecutando tarea |

**Movimiento**: Punto random dentro de zona cada 3-8s. Velocidad ~1px/frame. Sin aceleración.

## Conversaciones Visuales

1. Ambos agentes caminan uno hacia el otro
2. Línea punteada ámbar (#F59E0B, 40% opacidad) los conecta
3. **Burbuja de speech**: fondo blanco, border #E5E7EB, max 180px, 10px Inter, trunca con "..."
4. Pointer triangular apunta al sprite que habla
5. Al terminar: ✓ verde mini, agentes regresan a caminar libre

```
            ┌─────────────────────┐
            │ Maya: 8/10 (HOT)    │
            │ Carmen: 6/10 (WARM) │
            └────────┬────────────┘
                     ▼
  [HUNTER] · · · · · · · · [FILTER]
```

## Ghost Mode (Intervención de Javier)

- Click en conversación activa → avatar azul semi-transparente (#2563EB, 50% opacidad) aparece
- Label "JAVIER" en azul
- Conversation Box activa input field
- Javier escribe → burbuja con su mensaje → agentes lo leen y responden
- Fade out después de 30s sin escribir

## Conversation Box (debajo del canvas, colapsable)

```
┌────────────────────────────────────────────────────────┐
│ 💬 HUNTER ↔ FILTER                        10:03 AM    │
│ Trigger: cron (prospección)                            │
├────────────────────────────────────────────────────────┤
│ HUNTER: Encontré 3 leads para atiende.ai:             │
│         1. Restaurante Maya — 200 WhatsApps/día       │
│                                                        │
│ FILTER: Score BANT: Maya 8/10 (HOT), Carmen 6/10     │
│         (WARM), Sisal 7/10 (WARM)                     │
│                                                        │
│ HUNTER: Paso Maya a PLUMA. Carmen y Sisal quedan      │
│         para follow-up en 1 semana.                    │
├────────────────────────────────────────────────────────┤
│ 📎 2 tasks | 💰 $0.04 | ⏱ 3.2s                       │
├────────────────────────────────────────────────────────┤
│ [Escribir como Javier...                          →]  │
└────────────────────────────────────────────────────────┘
```

Sin conversación activa: muestra última conversación al 50% opacidad. Footer muestra tasks generadas, costo, tiempo. Input solo activo durante conversación activa.

## Agent Bar (footer, 48px)

Chips scrolleables horizontalmente:
```
[APEX 🟢] [FORGE 🟢] [PIXEL 🟡] [SWIFT 🟢] [SHIELD 🟢] ... →
```
Dots: 🟢 idle, 🟡 working, 🔴 error. Click → centra canvas + tooltip (nombre, div, modelo, $/mes, último msg, botón "Chat directo").

## Sidebar (320px fija)

### Activity Feed (60% superior, scrolleable)

```
🟢 10:03  HUNTER → FILTER
   "3 leads, Maya HOT"              $0.04

🔴 09:58  TRIAGE → FORGE
   "Bug P1 audio timeout"           $0.02

⚪ 07:00  DIGEST
   "Briefing matutino"              $0.01
```

Dots: 🟢 normal, 🟡 decision, 🔴 urgente, ⚪ info. Click expande mensajes inline. Click en nombre de agente centra canvas.

### KPI Cards (40% inferior, grid 2×2)

```
┌──────────┬──────────┐
│ Agents   │ Today    │
│ 50/50 🟢 │ $3.41    │
├──────────┼──────────┤
│ Tasks    │ Errors   │
│ 7 open   │ 0 🟢     │
└──────────┴──────────┘
```
148×64px cada card, #F8F9FA, radius 8px. Valor grande monospace, label gris. Click navega a tab correspondiente.

---

# PANTALLA 2: TASK BOARD — Kanban estilo Linear

```
┌──────────────┬──────────────┬──────────────┬─────────────┐
│ PENDING (3)  │ IN PROG (2)  │ WAITING (1)  │ DONE (4)    │
│              │              │(para Javier) │(today only) │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌─────────┐ │
│ │🔴 P0     │ │ │🟡 P1     │ │ │🔵 Decisión│ │ │✅ Deploy │ │
│ │Fix audio │ │ │Propuesta │ │ │Pitch DILA│ │ │audio fix│ │
│ │FORGE     │ │ │PROPUESTA │ │ │JAVIER    │ │ │DEPLOY   │ │
│ │Due: Hoy  │ │ │Due: Mañ  │ │ │Due: 48h  │ │ │10:30 AM │ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └─────────┘ │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

## Task Card
- Priority badge: 🔴P0 (rojo), 🟡P1 (ámbar), 🟢P2 (verde), ⚪P3 (gris)
- Title max 2 líneas
- Agente asignado + "De: AGENTE_A → AGENTE_B"
- Due date + costo de la conversación que la generó
- Cards para Javier: borde azul #2563EB + "🔵 Decisión"

## Interacciones
- **Drag & Drop** entre columnas
- **Click** → slide-over con: detalle completo, conversación original (mensajes), botones Complete/Reassign/Cancel
- **Decisiones**: botones Aprobar / Rechazar / Responder con input
- **Filtros top**: priority, división, agente, "Solo míos"

## Columna WAITING (especial)
Solo tasks con `assigned_to_javier = true`. Borde azul. Botón "Respond" inline. El badge rojo en el header cuenta estas tasks.

---

# PANTALLA 3: COST CENTER

## KPI Row (top, 4 cards)
```
Monthly: $42.18 (↓12% vs lm) | Today: $3.41 | Budget: $200 (21% used) | Projected: $97/mo ✅
```

## Daily Cost Chart (area chart, 30 días)
- Área azul claro con línea azul
- Línea punteada roja = daily cap ($10)
- Hover → tooltip con breakdown del día (por agente top 3)
- Period selector: This Month | Last Month | Last 7 Days | Custom

## Two-Column (bottom)
**Left — Top Spenders**:
```
1. PROPUESTA    $18.00  ████████████████████
2. SOCIAL       $18.00  ████████████████████
3. DEEP-RES      $3.40  ████
4. PLUMA          $3.00  ███
5. TRADUCE        $3.00  ███
   ▸ Show all 50
```
Click en agente → panel con detalle de gasto diario.

**Right — Cost by Tier**:
```
PREMIUM  ████████████████░░  $36.00  (56%)
BUDGET   ██████████████░░░░  $24.78  (38%)
MID      ██░░░░░░░░░░░░░░░░   $3.40   (5%)
ULTRA    ░░░░░░░░░░░░░░░░░░   $0.26   (0.4%)
FREE     ░░░░░░░░░░░░░░░░░░   $0.00
LOCAL    ░░░░░░░░░░░░░░░░░░   $0.00
```

## Cost by Division (full width bar chart)
```
Revenue  ████████████████████████████  $25.59
Brand    ████████████████████████░░░░  $19.80
Strategy ██████░░░░░░░░░░░░░░░░░░░░░   $5.60
Ops/Fin  █████░░░░░░░░░░░░░░░░░░░░░░   $5.29
Comms    ████░░░░░░░░░░░░░░░░░░░░░░░   $3.70
Product  ████░░░░░░░░░░░░░░░░░░░░░░░   $3.66
AI Ops   █░░░░░░░░░░░░░░░░░░░░░░░░░░   $0.80
Code Ops ░░░░░░░░░░░░░░░░░░░░░░░░░░░   $0.00
```

---

# PANTALLA 4: COMM LOG

## Layout master-detail

```
┌───────────────────────────────────┬───────────────────────────┐
│ LIST (scroll)                     │ DETAIL (seleccionado)     │
│                                   │                           │
│ 🟢 HUNTER ↔ FILTER    10:03 AM  │ Todos los mensajes        │
│ "3 leads, Maya HOT"      $0.04  │ Tasks generadas           │
│ 2 tasks · handoff                │ Metadata: costo, latency, │
│                                   │ modelos usados            │
│ 🔴 TRIAGE ↔ FORGE      09:58 AM │                           │
│ "Bug P1 audio timeout"   $0.02  │ Si Javier intervino:      │
│ 1 task · event                   │ sus mensajes en azul      │
│                                   │                           │
│ ⚪ DIGEST               07:00 AM │                           │
│ "Briefing matutino"      $0.01  │                           │
│ 0 tasks · cron                   │                           │
└───────────────────────────────────┴───────────────────────────┘
```

**List entry**: dot color + agentes + summary 1 línea + costo + # tasks + trigger type + timestamp.
**Detail panel**: mensajes completos, tasks listadas, metadata (costo total, latency promedio, modelos). Mensajes de Javier (ghost) en azul.
**Filters**: Division, Type (cron/event/handoff/request/ghost), Search texto, Date range.

---

# PANTALLA 5: CONFIG (Slide-over 480px desde ⚙️)

**Global Settings**: Monthly Budget [$200], Daily Cap [$10], Max Turns/Conv [4], WhatsApp [ON/OFF toggle]

**Agent Table** (50 rows):
```
│ Code  │ Model         │ Budget/m │ Spent  │ Status │
│ APEX  │ MiniMax Free  │ $2.00    │ $0.00  │ 🟢 idle │
│ PROP  │ Claude 4.6    │ $20.00   │ $12.40 │ 🟢 idle │
```
Click row → editar model, budget, temperature, enable/disable.

**Schedules** (13 entries):
```
☑ WATCHTOWER   */5 * * * *     Health check
☑ DIGEST       0 7 * * 1-5    Briefing matutino
☑ HUNTER       0 9,11,14,16   Prospección 4x/día
☐ COBRO        0 10 * * 1     Cobranza semanal (disabled)
```
Toggle para enable/disable cada schedule.

**Danger Zone**: [Reset Monthly Costs] [Pause All Agents] [Export History]

---

# FLUJOS DE USUARIO

## Mañana (7:00 AM)
1. Abre localhost:3000 → 50 agentes caminando
2. DIGEST ya generó briefing → entrada en Activity Feed
3. Badge "2" en Tasks → decisions pendientes
4. Tab Tasks → aprueba una, rechaza otra
5. Regresa a World → ve PROPUESTA trabajando en lo aprobado

## Intervención en Conversación (10:00 AM)
1. HUNTER habla con FILTER en Pixel World
2. Javier sabe algo extra → clickea la conversación
3. Avatar JAVIER aparece semi-transparente
4. Escribe: "El dueño es amigo de mi papá, approach personal"
5. FILTER ajusta su respuesta con el contexto

## Urgencia (cualquier hora)
1. WATCHTOWER detecta RAM 92%
2. Dot 🔴 en Activity + burbuja en Pixel World
3. Task P0 → badge en Tasks + WhatsApp "🔴 URGENTE"
4. Javier responde desde WhatsApp o dashboard

## Revisión de costos (viernes PM)
1. Tab Costs → ve gasto semanal
2. PROPUESTA gastó $18 pero cerró un deal de $5K
3. FORGE gastó $0 (free models)
4. Budget gauge: 21% usado → healthy ✅

---

# REAL-TIME: CÓMO SE ACTUALIZA

3 canales Supabase Realtime:
| Canal | Eventos | Quién consume |
|-------|---------|--------------|
| `world` | agent_move, conversation_start/end, ghost_join/leave | PixelWorld canvas |
| `activity` | new conversation, new task, cost update | Activity Feed, KPI Cards |
| `tasks` | task created/updated/completed | Task Board, header badge |

**Flujo**: Agente actúa → DB write → Supabase Realtime broadcast → React state update → UI re-render. Latencia <100ms.

---

# ESTADO INICIAL (Primer Boot)

| Momento | Qué se ve |
|---------|-----------|
| 0 min | 50 agentes parados, pestañeando. Activity Feed vacío. |
| 5 min | WATCHTOWER health check. Primer dot 🟢 en feed. |
| 1 hora | HUNTER→FILTER conversan. Primeras tasks. Primer costo. |
| 24 horas | Dashboard "vivo". Docenas de conversaciones. Tasks moviendose. Gráfica de costos con data real. |

---

# RESPONSIVE

| Ancho | Layout |
|-------|--------|
| ≥1280px | Full: canvas + sidebar |
| 1024-1279 | Canvas smaller, sidebar colapsable |
| <1024 | Banner: "Abre en monitor" |

WhatsApp es la interfaz mobile. El dashboard es para monitor.

---

*Dashboard Blueprint v1.0 — Solo el software.*
*Los agentes, modelos, benchmarks, y costos están en el Blueprint del Sistema (documento separado).*
