# INSTRUCCIONES v3 — Provisionar los 25 agents de OpenClaw

**Supersede**: este archivo reemplaza la versión original de `CLAUDE_CODE_INSTRUCTIONS_v3.md`
(upload en commit `3561a93`) que tenía un bash inline frágil en PASO 3 y varios errores
de conteo. El nuevo flujo es un solo comando que llama a `scripts/create_agents_v3.sh`,
data-driven desde `config/personas-to-agents.json`.

## Estado esperado antes de empezar

- OpenClaw 2026.4.5 instalado y el agente `main` respondiendo OK con tu nueva OpenRouter
  key (Bloque 1 ✅).
- En tu Mac tienes los 8 agents del v2, de los cuales **3 se quedan tal cual**
  (`premium`, `gemini-lite`, `local-text`) y **5 son obsoletos** (se renombran o
  reemplazan): `grok`, `qwen-free`, `code-free`, `cheap-misc`, `local-vision`.
- Este repo en tu Mac con la branch `claude/resume-block-2-key-n4y1v` pulled.

## La topología v3

Fuente de verdad: `config/personas-to-agents.json` (25 agents, ~75 personas, ~$54/mo provisionados).

| Agents | Cuenta | Acción |
|---|---|---|
| Kept (unchanged) | 3 | `premium`, `gemini-lite`, `local-text` — no se tocan |
| Provisionados | 21 | Nuevos + renombrados/reemplazados |
| Reserved | 1 | `hermes-405b-paid` — tiene `_note: "RESERVED"`, NO se provisiona; es placeholder para splittear rate limits si el `:free` de Hermes se satura |
| **Total en JSON** | **25** | (matches `_meta.agents_total`) |

Los 21 a provisionar son: `grok-sales`, `qwen-general`, `hermes-405b`, `gemma-vision`,
`trinity-creative`, `kimi-frontend`, `minimax-code`, `qwen-coder`, `deepseek-code`,
`nemotron-security`, `qwen-finance`, `grok-legal`, `gpt-oss`, `gemini-flash`, `stepfun`,
`llama-translate`, `glm-tools`, `gpt-oss-20b`, `gemma-12b`, `kimi-thinking`,
`qwen-coder-flash`.

**Nota sobre la miscuenta del texto viejo**: el PASO 3 original decía "17 nuevos +
5 renombrados = 22". La cuenta correcta es **15 nuevos + 6 renombrados/reemplazados
= 21**. El bash array viejo tenía 21 entries ✅ — no le faltaba ninguno. El ruido venía
del texto introductorio, no del array.

**Sobre `qwen/qwen3.6-plus`** (usado por `qwen-finance`): en commit `5466ae1` (2026-04-08)
una validación temprana lo declaró fabricado. La revalidación del mismo día contra el
catálogo live de OpenRouter (351 modelos, 17/17 IDs confirmados, ver `scripts/create_agents_v3.sh`
y el smoke test) lo encontró real. Probablemente se agregó al catálogo en las horas
intermedias, o la auditoría de `5466ae1` fue imprecisa. Hoy es válido.

## PASO 1: Pull del repo

```bash
cd ~/openclawsetup
git fetch origin
git checkout claude/resume-block-2-key-n4y1v
git pull origin claude/resume-block-2-key-n4y1v
```

Debes ver que llegan `config/personas-to-agents.json` (actualizado), `CLAUDE_CODE_INSTRUCTIONS_v3.md`
(este archivo) y `scripts/create_agents_v3.sh`.

## PASO 2: Primer run — wipe obsoletos + force recreate todo

```bash
PRUNE=1 FORCE=1 bash scripts/create_agents_v3.sh
```

Qué hace en orden:
1. **Preflight**: verifica `openclaw`, `python3`, `config/personas-to-agents.json`,
   `~/.openclaw/agents/main/agent/models.json`, `~/.openclaw/agents/main/agent/auth-profiles.json`.
   Cualquier falta → exit 1 sin tocar nada.
2. **PRUNE**: borra cualquier directorio en `~/.openclaw/agents/` que no esté en el JSON
   ni sea `main`. Esperado: elimina `grok`, `qwen-free`, `code-free`, `cheap-misc`,
   `local-vision` (los 5 obsoletos del v2).
3. **PROVISION**: para cada uno de los 24 agents no-RESERVED en el JSON:
   - `mkdir -p ~/.openclaw/agents/<name>/{agent,workspace,sessions}`
   - `cp` de `models.json` y `auth-profiles.json` del main
   - Escribe `agent.json` con el model ID fijo y `config.json` vacío
   - Con `FORCE=1`, borra primero si ya existía (los 3 kept = `premium`/`gemini-lite`/`local-text`
     se recrean idénticos, es seguro).
4. **Gateway restart**: `launchctl kickstart -k gui/$UID/ai.openclaw.gateway` (con fallback a
   `openclaw gateway restart`), espera 3 segundos.
5. **`openclaw agents list`** — debe mostrar 24 agents (main + 23). Si muestra 25, incluye
   el reserved `hermes-405b-paid` (no debería).
6. **Smoke test** de 5 agents representativos (`premium`, `grok-sales`, `qwen-general`,
   `minimax-code`, `stepfun`), cada uno con `--message "Responde solo: ok"`.

## PASO 3: Runs subsecuentes (idempotentes)

```bash
bash scripts/create_agents_v3.sh
```

Sin flags = skip-if-exists. Agrega agents nuevos al JSON y re-corre; los existentes no
se tocan. Para recrear uno solo: añade `FORCE=1` y borra manualmente el que quieras
recrear primero, o usa `FORCE=1` para todo (idempotente, los existentes simplemente
se sobre-escriben con el mismo contenido).

## PASO 4: FIXME — ¿openclaw.json necesita registrar los agents?

⚠️ **Sin verificar desde el sandbox**. El v3 no llama a `openclaw agents add`;
provisiona por filesystem directo. Si OpenClaw 2026.4.5 usa un registry explícito
en `~/.openclaw/openclaw.json` bajo `agents.list[]`, este paso es necesario y el script
NO lo hace. Si el gateway escanea el directorio automáticamente al restart, no hace falta.

**Verificación en el Mac después de correr PASO 2**:
```bash
openclaw agents list
# Si muestra los 24 agents → directory scan funciona, no toques openclaw.json.
# Si solo muestra main + los 3 kept (premium, gemini-lite, local-text) → hay que
# registrar los nuevos en openclaw.json. Reporta el output y te doy el parche.
```

## PASO 5: Smoke test completo (todos los 24)

Si quieres validar los 24 (no solo los 5 que hace el script), está el comando al final
del output de `create_agents_v3.sh`, o corre manualmente:

```bash
python3 -c 'import json; d=json.load(open("config/personas-to-agents.json")); [print(n) for n,s in d["agents"].items() if "RESERVED" not in str(s.get("_note",""))]' \
  | while read a; do
    printf "  %-22s " "$a"
    openclaw agent --agent "$a" --session-id "smoke-$(date +%s)-$a" --message "di: ok" 2>&1 | tail -1
  done
```

## Rollback (si algo sale horrible)

```bash
# Los 5 obsoletos del v2 ya no los podrás recuperar sin el JSON viejo, pero puedes
# volver al estado previo con git:
git log --oneline scripts/create_agents.sh config/personas-to-agents.json
# Identifica el commit anterior a la expansión v3 y haz checkout del archivo:
git checkout <sha>^ -- config/personas-to-agents.json
# Los agents del v2 (8) se pueden reprovisionar con el script viejo:
FORCE=1 bash scripts/create_agents.sh
```

## Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| Agent responde "I'm up, what can I help you with?" | `auth-profiles.json` no copiado o key inválida | Verifica `~/.openclaw/agents/<name>/agent/auth-profiles.json` existe + re-corre con `FORCE=1` |
| `openclaw agents list` muestra menos de 24 | Gateway necesita más tiempo para escanear | `sleep 10 && openclaw agents list` |
| `openclaw agents list` muestra los kept pero no los nuevos | Posible registry en openclaw.json (ver PASO 4) | Reporta output y decidimos |
| `launchctl kickstart` falla | Gateway no está bajo launchd en tu Mac | Script hace fallback a `openclaw gateway restart` automáticamente |
| Smoke test timeout en un agent `:free` | Rate limit de OpenRouter free tier | Espera 1-2 min y retry el smoke de ese agent solo |
| Todos los smoke tests fallan | Gateway no arrancó | `openclaw gateway status && openclaw logs --tail 50` |
