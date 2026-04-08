# BLOQUE 2 — Setup de los 50 skills, config, heartbeats, y WhatsApp

**Requisito previo**: Bloque 1 completo (OpenClaw instalado, Gateway corriendo en `localhost:18789`, OpenRouter y Ollama configurados). Verificado con `openclaw gateway status` → `Runtime: running`.

Esta guía es para que Claude Code Desktop (o Javier manualmente) ejecute los 4 items del Bloque 2 en su Mac Mini M4, usando los artefactos ya committeados en este repo.

---

## Lo que hay en este repo para Bloque 2

| Archivo | Qué es |
|---|---|
| `config/skills.json` | Los 50 skills completos (code, model, fallback, escalation, system prompt, triggers, division). Fuente de verdad. |
| `scripts/create_skills.sh` | Genera los 50 archivos `.md` en `~/.openclaw/workspace/skills/` leyendo `skills.json`. |
| `config/openclaw.json.template` | Config de OpenClaw con systemPrompt + fallbackModels + Ollama provider. Requiere editar 2 placeholders. |
| `config/heartbeats.json` | Los 13 cron jobs (WATCHTOWER, RADAR, DIGEST, INBOX, HUNTER, COBRO, AI-MONITOR, ESCUCHA, METRICS, SOCIAL, PRIORITY, COMPETE, BENCHMARKER). |

---

## Orden de ejecución (minimiza blast radius)

1. **Skills primero** — sin skills, heartbeats no pueden correr
2. **Luego openclaw.json** — actualiza el config con el systemPrompt multi-agente
3. **Luego heartbeats** — activa los 13 cron jobs
4. **WhatsApp al final** — se puede posponer si prefieres estabilizar primero

---

## PASO 1: Crear los 50 skill files

### 1.1 — Verificar pre-requisitos
```bash
# Debes tener el repo clonado en tu Mac, en la rama claude/review-nutrition-docs-re8Xb
cd ~/path/to/openclawsetup
git branch                          # debe mostrar * claude/review-nutrition-docs-re8Xb
git pull origin claude/review-nutrition-docs-re8Xb  # traer el Bloque 2

# Node.js requerido (ya lo tienes, v25.6.1 del Bloque 1)
node --version                      # v18+ está bien, tú tienes v25

# Carpeta destino (ya existe, pero por si acaso)
mkdir -p ~/.openclaw/workspace/skills
ls ~/.openclaw/workspace/skills     # debe estar vacía
```

### 1.2 — Correr el generador
```bash
bash scripts/create_skills.sh
```

**Output esperado** (50 líneas de ✅ + resumen + división):
```
✅  APEX            FREE     minimax/minimax-m2.5:free
✅  FORGE           FREE     qwen/qwen3-coder-480b-a35b:free
...
✅  TRADUCE         BUDGET   mistralai/mistral-large-2411

🦞 Summary: 50 created, 0 skipped, 0 failed
   Directory: /Users/javier/.openclaw/workspace/skills
   Total .md files now: 50

📊 Division distribution:
   ✅ Div 1: 8 (expected 8)
   ✅ Div 2: 10 (expected 10)
   ...
   ✅ Div 8: 3 (expected 3)
```

Si algún `⚠️` o `❌` aparece, no avances — regrésate y revisa el error.

### 1.3 — Checkpoint manual
```bash
ls ~/.openclaw/workspace/skills/*.md | wc -l          # debe imprimir: 50
cat ~/.openclaw/workspace/skills/propuesta.md         # debe mostrar frontmatter YAML + system prompt
openclaw test --skill forge "escribe hello world en python"   # respuesta de código real
openclaw test --skill hunter "busca 3 leads para atiende.ai"  # respuesta en español
```

Si un skill específico falla, abre su `.md` file y verifica el formato. Si el error es de modelo no disponible (ej. `gemma4:e4b`), confirma `ollama list`.

**Re-run seguro**: `create_skills.sh` por defecto NO sobrescribe archivos existentes (`skipped, exists`). Para forzar: `FORCE=1 bash scripts/create_skills.sh`.

---

## PASO 2: Actualizar `~/.openclaw/openclaw.json`

### 2.1 — Backup del config actual
```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak-bloque1
```

### 2.2 — Copiar el template y editarlo
```bash
cp config/openclaw.json.template ~/.openclaw/openclaw.json
```

Luego abre `~/.openclaw/openclaw.json` y reemplaza:

1. **`OPENROUTER_API_KEY_AQUI`** → tu API key real de OpenRouter (la misma que ya usaste en Bloque 1). La puedes ver con:
   ```bash
   cat ~/.openclaw/openclaw.json.bak-bloque1 | grep -i apikey
   ```

2. **`+521XXXXXXXXXX`** en `channels.whatsapp.allowFrom` → tu número (o números) autorizado(s). Formato E.164 con `+521` para México. Sin esto nadie puede hablarle al bot por WhatsApp.
   - **IMPORTANTE**: usa un número separado (SIM prepago), NO tu personal, para evitar ban de WhatsApp por actividad automatizada.

### 2.3 — Validar JSON antes de reiniciar
```bash
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null && echo "✅ valid" || echo "❌ broken JSON — no reinicies"
```

### 2.4 — Reiniciar gateway
```bash
openclaw gateway restart
openclaw gateway status              # Runtime: running
```

Si el gateway no arranca, revisa los logs (`~/.openclaw/logs/` o donde los ponga OpenClaw) — probablemente un error de JSON o un placeholder sin reemplazar.

---

## PASO 3: Activar los 13 heartbeats

### 3.1 — Copiar el archivo
```bash
cp config/heartbeats.json ~/.openclaw/heartbeats.json
```

### 3.2 — Validar + reiniciar
```bash
python3 -m json.tool ~/.openclaw/heartbeats.json > /dev/null && echo "✅ valid"
openclaw gateway restart
openclaw heartbeats list              # debe listar los 13
openclaw heartbeats status            # último run + próximo run de cada uno
```

### 3.3 — Esperar el primer ciclo
El primero en correr será `watchtower-health` (cada 5 min). Espera 5-6 minutos y verifica:
```bash
openclaw heartbeats status | grep watchtower     # debe mostrar last_run reciente
```

### 3.4 — Pausar heartbeats de WhatsApp (opcional, solo si pospones WhatsApp)
Si vas a saltarte PASO 4 por ahora, deshabilita los 3 heartbeats que mandan a WhatsApp para evitar errores:
```bash
openclaw heartbeats disable digest-morning
openclaw heartbeats disable cobro-weekly
openclaw heartbeats disable social-post
openclaw heartbeats disable compete-intel
```
(Puedes reactivarlos después con `openclaw heartbeats enable <id>`.)

---

## PASO 4: Conectar WhatsApp (puedes posponerlo)

### 4.1 — Prerrequisito: SIM separada
- Usa un número NUEVO (SIM prepago, tarjeta vieja, Google Voice). **NO tu personal.**
- WhatsApp puede banear números detectados como automatizados 24/7.
- Si te banean, pierdes el canal principal hasta que consigas otro número.

### 4.2 — Confirmar allowFrom
Asegúrate de que `~/.openclaw/openclaw.json` → `channels.whatsapp.allowFrom` tiene al menos tu número personal (para ti) y los de tu equipo autorizado. Si tienes el campo vacío `[]`, nadie puede mandarle mensajes al bot.

### 4.3 — Link
```bash
openclaw whatsapp:link
```
Imprime un código QR en la terminal. En tu teléfono con la SIM separada:
- WhatsApp → Settings → Linked devices → Link a device → escanea el QR
- Espera 5-10 segundos hasta que aparezca "Connected" en la terminal

### 4.4 — Prueba
Desde tu teléfono personal (autorizado en `allowFrom`), manda un mensaje de texto al número del bot:
- "status" → debe responder con info del gateway
- "hola" → debe responder con el systemPrompt del agente principal

Si no responde, checa:
```bash
openclaw logs --tail 50
```

---

## CHECKPOINT FINAL DE BLOQUE 2

Corre todos estos en secuencia. Si cualquiera falla, regresa al paso correspondiente.

```bash
# Skills
[ $(ls ~/.openclaw/workspace/skills/*.md 2>/dev/null | wc -l) -eq 50 ] \
  && echo "✅ 50 skill files" || echo "❌ faltan skill files"

# Config
python3 -m json.tool ~/.openclaw/openclaw.json > /dev/null \
  && echo "✅ openclaw.json válido" || echo "❌ openclaw.json roto"
grep -q 'OPENROUTER_API_KEY_AQUI' ~/.openclaw/openclaw.json \
  && echo "❌ API key placeholder sin reemplazar" || echo "✅ API key reemplazada"
grep -q '+521XXXXXXXXXX' ~/.openclaw/openclaw.json \
  && echo "⚠️  Número de WhatsApp placeholder sin reemplazar (ok si pospones WhatsApp)" \
  || echo "✅ Números de WhatsApp configurados"

# Heartbeats
[ $(openclaw heartbeats list 2>/dev/null | grep -c '^') -ge 13 ] \
  && echo "✅ 13+ heartbeats activos" || echo "❌ heartbeats no cargados"

# Gateway
openclaw gateway status | grep -q 'running' \
  && echo "✅ gateway running" || echo "❌ gateway no corriendo"

# Test real: llamar a 3 skills distintos (FREE, BUDGET, LOCAL)
openclaw test --skill forge "echo hola" > /tmp/test-forge.log 2>&1 \
  && echo "✅ FORGE responde" || echo "❌ FORGE falló — revisa /tmp/test-forge.log"
openclaw test --skill hunter "dame un lead" > /tmp/test-hunter.log 2>&1 \
  && echo "✅ HUNTER responde" || echo "❌ HUNTER falló"
openclaw test --skill watchtower "health check" > /tmp/test-watchtower.log 2>&1 \
  && echo "✅ WATCHTOWER (LOCAL Ollama) responde" || echo "❌ WATCHTOWER falló"
```

Si los 7 checks pasan, Bloque 2 está completo. Siguiente parada: **Bloque 3** = construir el dashboard Next.js + pixel world (ver `CLAUDE_MD_EMPRESA_COMPLETO.md`).

---

## Troubleshooting común

### "Model not found: ollama/gemma4:e4b"
Confirma que el tag existe en tu Ollama:
```bash
ollama list | grep gemma4
```
Si no está, descárgalo o cambia los skills que lo usan (VISUAL primary, INBOX fallback, PLANTA fallback) a otro modelo local que sí tengas. Puedes editar `config/skills.json`, correr `FORCE=1 bash scripts/create_skills.sh`, y reiniciar el gateway.

### "Quota exceeded on qwen/qwen3-coder-480b-a35b:free"
Los modelos `:free` de OpenRouter tienen rate limits bajos. OpenClaw debería hacer fallback automático al siguiente modelo. Si no, edita `skills.json` para mover esos skills a modelos pagados baratos (grok-4.1-fast, gemini-2.5-flash-lite).

### Un skill responde con basura / alucina
Abre `~/.openclaw/workspace/skills/<skill>.md`, verifica que el `model:` y el `system prompt` sean los esperados. Si el problema persiste, escala al `escalation_model` editando el frontmatter manualmente.

### `create_skills.sh` dice "skipped, exists" pero quiero regenerar
```bash
FORCE=1 bash scripts/create_skills.sh
```

### WhatsApp se desconectó después de unas horas
Es normal en sesiones largas — WhatsApp cierra devices inactivos. Re-link con:
```bash
openclaw whatsapp:link
```
Si pasa seguido, considera Telegram como backup (OpenClaw lo soporta, zero riesgo de ban).

---

## Estado esperado al final

```
~/.openclaw/
├── openclaw.json              ← config multi-agente con systemPrompt de Javier
├── openclaw.json.bak-bloque1  ← backup del config pre-Bloque 2
├── heartbeats.json            ← 13 cron jobs
└── workspace/
    └── skills/
        ├── apex.md
        ├── forge.md
        ├── ...
        └── traduce.md          ← 50 archivos total, 8 divisiones
```

Y `openclaw gateway status` sigue reportando `Runtime: running` con los 50 skills cargados y los 13 heartbeats scheduled. WhatsApp conectado (si hiciste PASO 4) con tu número autorizado.

**Costo mensual proyectado**: ~$64.44 vía OpenRouter (ver `config/skills.json` → `total_cost_monthly_usd`). Budget cap en `openclaw.json` está en $200/mes con daily cap de $10.
