# BLOQUE 3 KICKOFF — Dashboard Next.js + PixiJS (Empresa Virtual Visualizer)

**Lee este archivo completo antes de arrancar. Está diseñado para que una sesión nueva de Claude Code tenga todo el contexto de Bloque 2 en ~800 palabras, sin necesidad de leer el historial completo de debugging.**

---

## Qué ya está funcionando (NO tocar)

Estado al 2026-04-08, después de cerrar Bloque 2 en commit `50c10e2`:

### Backend (OpenClaw 2026.4.5 en el Mac Mini de Javier)

- **25 agents provisionados** en `~/.openclaw/agents/`, registrados en `~/.openclaw/openclaw.json`
  - 1 `main` (default, creado por `openclaw onboard`)
  - 24 custom, grupados por tier de modelo (ver `config/personas-to-agents.json`)
  - Provisioned by `scripts/create_agents_v3.sh` (no correr otra vez sin `FORCE=1` y entender lo que hace)

- **13 heartbeats cron jobs** activos en `openclaw cron list`, cada uno con:
  - `--model openrouter/<specific>` (override per-job, no global)
  - `--no-deliver` (evita false-failed por WhatsApp no linkeado)
  - `--light-context` (reduce bloat del systemPrompt de 31k → ~6k chars)
  - `--tools read` (allow-list mínimo)
  - Provisioned by `scripts/create_crons.py`

- **OpenRouter API key** rotada el 2026-04-08 (suffix `2175`). Vive en:
  - `~/.openclaw/agents/main/agent/auth-profiles.json` → `profiles.openrouter:default.key` (authoritative)
  - `~/.openclaw/agents/main/agent/models.json` → `providers.openrouter.apiKey` (redundant copy)
  - Se propagó a los 24 agent-dirs pero `openclaw models status --agent X` muestra que el `effective` profile siempre apunta al del `main`

- **Global default model**: `openrouter/qwen/qwen3-next-80b-a3b-instruct:free` (seteado via `openclaw models --agent main set ...`). Calls interactivos vía `openclaw agent --agent X` usan esto siempre, no el pin per-agent.

### Repo (`javiercamarapp/openclawsetup`, branch `claude/resume-block-2-key-n4y1v`)

Archivos críticos (NO borrar ni editar sin entender):

- `config/personas-to-agents.json` — 25 agents v3 con `model`, `personas`, `tier`, `cost_mo`
- `config/skills.json` — 50 skills con system_prompts (v2 legacy, usado solo como referencia)
- `config/heartbeats.json` — 13 heartbeats con schedule + prompt + skill
- `scripts/create_agents_v3.sh` — data-driven provisioner de los 24 agents
- `scripts/create_crons.py` — data-driven provisioner de los 13 heartbeats
- `CLAUDE_CODE_INSTRUCTIONS_v3.md` — docs + lecciones aprendidas de Bloque 2 (PASO 7)
- `CLAUDE_MD_EMPRESA_COMPLETO.md` — blueprint completo del dashboard (FASE 0-8) ← tu plan para Bloque 3

---

## Reglas no-negociables para Bloque 3

1. **NO llamar `openclaw agents add/delete/update`** para los 25 agents existentes. Ya están provisionados y corriendo.
2. **NO llamar `openclaw models --agent X set`** para cambiar pins. El global default ya está en qwen-free, y los 13 crons tienen sus modelos pineados vía `cron add --model`.
3. **NO llamar `openclaw cron add/rm/edit`** para los 13 heartbeats existentes — están corriendo y el user verificó que watchtower dispara limpio.
4. **NO tocar `~/.openclaw/` ni los archivos de config del user** en el Mac. Bloque 3 es 100% el proyecto Next.js dashboard, que vive en su propio directorio separado.
5. **NO rotar la API key** ni tocar `auth-profiles.json`. Si algo falla auth, primero verificar con `openclaw agent --agent main --json --message "ok"` que main sigue vivo antes de asumir que la key está muerta.
6. **Si algo raro pasa con los agents o crons**, primero leer `CLAUDE_CODE_INSTRUCTIONS_v3.md → PASO 7 → "Lecciones aprendidas"`. Ahí están los 10 hallazgos no obvios sobre OpenClaw 2026.4.5 que nos tomaron horas descubrir.

---

## Qué es Bloque 3

**Dashboard Next.js + PixiJS** que se conecta al OpenClaw gateway via WebSocket (`ws://127.0.0.1:18789`) y renderiza los 25 agents como sprites en un pixel world estilo AI Town / Stardew Valley.

**Fuente de verdad del plan**: `CLAUDE_MD_EMPRESA_COMPLETO.md` — tiene 8 fases (FASE 0-8) bien definidas:

- **FASE 0**: Setup infra (Node.js 22+, Next.js 15, Supabase local, dependencies, env vars)
- **FASE 1**: Base de datos (Supabase schema local cache de agents, tasks, costs, events)
- **FASE 2**: OpenClaw client read-only (HTTP + WS client contra el gateway)
- **FASE 3**: OpenClaw event subscriber (mapping de eventos → Supabase)
- **FASE 4**: Orchestrator (delegado a OpenClaw, no reimplementar)
- **FASE 4.5**: Sprite factory (assets procedurales para FASE 5)
- **FASE 5**: Pixel world (PixiJS, 25 sprites renderizados en canvas)
- **FASE 6**: Dashboard screens (tasks board, cost center, calendar, config, comm log)
- **FASE 7**: Ghost mode (UI para que Javier "entre" al pixel world)
- **FASE 8**: Auto-start + polish (launchd, monthly cost reset)

**Scope de esta sesión**: FASE 0 solamente. Setup limpio del proyecto Next.js. Cuando FASE 0 esté completo + verified, PAUSAR y esperar confirmación del user antes de arrancar FASE 1. No intentar hacer las 8 fases de corrido — cada una merece su propia sesión focused.

---

## Cómo arrancar (sesión nueva de Claude Code)

1. Verificar que el branch es `claude/resume-block-2-key-n4y1v`:
   ```bash
   git status
   git log --oneline -5
   ```
   Debes ver commits hasta `50c10e2 fix(v3): swap stepfun agent to qwen-free`.

2. Verificar que Bloque 2 sigue vivo (smoke test rápido, no destructivo):
   ```bash
   # En el Mac del user (si aplica a tu entorno):
   openclaw agents list | head -5          # debe mostrar main + 24 custom
   openclaw cron list | head -5             # debe mostrar los 13 heartbeats
   openclaw tasks list --runtime cron       # watchtower-health debe tener runs succeeded recientes
   ```

3. Leer **`CLAUDE_MD_EMPRESA_COMPLETO.md`** entero (es la fuente de verdad del plan del dashboard).

4. Leer **`CLAUDE_CODE_INSTRUCTIONS_v3.md` → PASO 7 → "Lecciones aprendidas"** (~2k palabras, críticas para no repetir errores).

5. Arrancar con **FASE 0**: crear el proyecto Next.js, instalar dependencies, configurar env vars. No pasar a FASE 1 sin check-in del user.

6. Al terminar FASE 0:
   - Commit con mensaje `feat(bloque-3): FASE 0 — infra setup (next.js + supabase + deps)`
   - Push al branch `claude/resume-block-2-key-n4y1v`
   - Reportar al user qué quedó hecho y pedir approval para FASE 1

---

## Preguntas abiertas para Javier (hazle estas al arrancar)

1. **¿Dónde vive el proyecto del dashboard?** ¿Mismo repo `openclawsetup` con un subdir `dashboard/`, o repo separado `empresa-virtual-dashboard`? El blueprint no lo especifica — decisión de ergonomía.

2. **¿Supabase local (Docker) o Supabase cloud (hosted)?** El blueprint favorece local para desarrollo, pero si Javier tiene cuenta cloud activa puede ser más rápido arrancar ahí.

3. **¿Node version?** En el Mac Mini tiene Node 25.6.1 (según docs de Bloque 1). Next.js 15 funciona bien con 22+. No debería haber problema pero vale confirmar.

4. **¿Hay preferencia por un pixel art style específico?** El blueprint menciona estilo tipo AI Town. Si Javier tiene mood boards o referencias, pedirlas antes de arrancar FASE 4.5 (sprite factory).

---

## Notas importantes sobre el tono de la sesión

- **Ser conciso**. Javier ya invirtió horas en Bloque 2 y está cansado. No narrar cada paso con 500 palabras. Bullet points, comandos, resultado. Bullets cortos.
- **No redescubrir**. Si algo no funciona como esperas, ANTES de diagnosticar desde cero, checar si está en "Lecciones aprendidas" (PASO 7 del instructions file). Hay ~10 findings no obvios ahí.
- **Pedir confirmación antes de cambios destructivos**. Especialmente: antes de `rm -rf`, antes de modificar config que afecta los heartbeats corriendo, antes de instalar dependencies globales.
- **Paste-safe commands**. Javier está en zsh sin `interactive_comments`. Comandos multi-línea con `#` comments se rompen. Preferir bash scripts o comandos sin comments.
- **No asumir que funciona**. Probar con comandos read-only antes de commit-worthy changes.

---

## TL;DR para el Claude de la sesión nueva

> Estado: Bloque 2 cerrado y corriendo (25 agents + 13 crons). Bloque 3 = dashboard Next.js + PixiJS según `CLAUDE_MD_EMPRESA_COMPLETO.md` FASE 0-8. Empieza en FASE 0. Lee las lecciones aprendidas en `CLAUDE_CODE_INSTRUCTIONS_v3.md` PASO 7 antes de tocar nada relacionado con OpenClaw. Pregunta a Javier dónde va el proyecto (subdir vs repo separado) y si prefiere Supabase local o cloud. Commit en el mismo branch `claude/resume-block-2-key-n4y1v`. Pausa al terminar FASE 0 para check-in.
