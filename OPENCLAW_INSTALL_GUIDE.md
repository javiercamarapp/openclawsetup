# GUÍA DE INSTALACIÓN DE OPENCLAW — Abril 2026
# Este archivo complementa el CLAUDE.md principal. Ejecútalo ANTES de las fases del dashboard.

---

## CONTEXTO IMPORTANTE

OpenClaw (antes Clawdbot, luego Moltbot) es un framework open-source de agentes AI self-hosted.
- GitHub: github.com/openclaw/openclaw (196,000+ stars)
- Runtime: Node.js 24 (recomendado) o Node.js 22.16+
- Gateway: WebSocket en puerto 18789
- Config: ~/.openclaw/
- Workspace: ~/.openclaw/workspace/
- Creador: Peter Steinberger (@steipete)
- Licencia: MIT

---

## PASO 1: PREREQUISITOS

### 1.1 — Node.js 22+ (OBLIGATORIO)
```bash
# Verificar si ya tienes Node.js
node --version

# Si no tienes Node 22+, instalar con Homebrew:
brew install node@22

# O usar nvm (recomendado para manejar versiones):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22

# Verificar
node --version    # Debe ser v22.16+ o v24+
npm --version     # Debe ser 10+
```

### 1.2 — Git (necesario para dependencias)
```bash
# Verificar
git --version

# Si no está instalado:
brew install git
```

---

## PASO 2: INSTALAR OPENCLAW

### Opción A: One-liner (RECOMENDADA — instala todo automáticamente)
```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash
```
Este script:
- Detecta tu OS
- Instala Node.js si no lo tienes
- Instala OpenClaw globalmente
- Configura el PATH

### Opción B: npm directo
```bash
npm install -g openclaw@latest
```

Si hay error de permisos:
```bash
# Opción 1: Configurar npm para instalar en directorio de usuario
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
npm install -g openclaw@latest

# Opción 2: sudo (no recomendado pero funciona)
sudo npm install -g openclaw@latest
```

### Opción C: pnpm
```bash
pnpm add -g openclaw@latest
# Nota: pnpm requiere aprobar build scripts
pnpm approve-builds -g
```

### Verificar instalación
```bash
openclaw --version
# Debe mostrar versión 2026.x.x
```

### Troubleshooting común
```bash
# Si "openclaw: command not found" después de instalar:
# Tu PATH no incluye el directorio global de npm
# Reinicia la terminal o:
source ~/.zshrc

# Si falla la instalación por dependencias:
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest

# Si hay problemas post-instalación:
openclaw doctor
openclaw doctor --fix
```

---

## PASO 3: ONBOARDING (configuración guiada)

Este es el paso más importante. El wizard configura TODO:
```bash
openclaw onboard --install-daemon
```

El flag `--install-daemon` es CRÍTICO — registra el Gateway como servicio de sistema:
- macOS: launchd (arranca automáticamente con el Mac)
- Linux: systemd

### El wizard te preguntará:

**1. LLM Provider:**
→ Selecciona **OpenRouter**
→ Pega tu API key de OpenRouter (sk-or-v1-xxx)

**2. Modelo default:**
→ Puedes elegir cualquiera. Recomendamos: `qwen/qwen3.6-plus:free` para empezar (gratis)

**3. Workspace:**
→ Acepta el default: `~/.openclaw/workspace`
→ Aquí se crean automáticamente: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md

**4. Channel — WhatsApp:**
→ Selecciona **WhatsApp**
→ Aparecerá un **código QR** en la terminal
→ En tu teléfono: WhatsApp > Settings > Linked Devices > Link a Device
→ Escanea el QR
→ Espera 5-10 segundos hasta ver "Connected"

**5. Skills:**
→ SALTA por ahora (vamos a crear skills personalizados)
→ ⚠️ NO instales skills de ClawHub por seguridad (incidente ClawHavoc de marzo 2026)

**6. Heartbeats:**
→ El wizard pregunta si quieres heartbeats automáticos
→ Selecciona NO por ahora (los configuraremos manualmente después)

---

## PASO 4: VERIFICAR QUE FUNCIONA

```bash
# 1. Verificar el Gateway
openclaw gateway status
# Debe mostrar: Runtime: running, RPC probe: ok

# 2. Abrir el dashboard web de OpenClaw
openclaw dashboard
# Abre http://localhost:18789 en tu browser

# 3. Test rápido — enviar mensaje desde WhatsApp
# Envía "Hola" desde tu teléfono al número conectado
# Debe responder con una respuesta del modelo

# 4. Health check
openclaw doctor
# Debe mostrar todo verde
```

---

## PASO 5: CONFIGURAR PARA MULTI-AGENTE (50 skills)

### 5.1 — Editar la configuración principal
```bash
# Abrir config
nano ~/.openclaw/openclaw.json
# O con cualquier editor:
code ~/.openclaw/openclaw.json
```

### 5.2 — Reemplazar con esta configuración multi-modelo:
```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789
  },
  "agent": {
    "model": "qwen/qwen3.6-plus:free",
    "fallbackModels": [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/llama-3.1-nemotron-70b-instruct:free"
    ],
    "workspace": "~/.openclaw/workspace",
    "systemPrompt": "Eres el asistente AI principal de Javier Cámara, founder en Mérida, Yucatán. Habla en español mexicano. Tus empresas: Kairotec (AI agency), atiende.ai (WhatsApp/Voice AI para SMBs), Opero (delivery ~80K contactos), HatoAI (ganadería SaaS), Moni AI (fintech gamificada), SELLO. Co-founder: Edgar Cancino."
  },
  "channels": {
    "whatsapp": {
      "allowFrom": [
        "+521XXXXXXXXXX"
      ]
    }
  },
  "llmProviders": {
    "openrouter": {
      "apiKey": "TU_OPENROUTER_API_KEY",
      "baseUrl": "https://openrouter.ai/api/v1"
    },
    "ollama": {
      "baseUrl": "http://localhost:11434"
    }
  }
}
```

⚠️ **IMPORTANTE**: Reemplaza:
- `+521XXXXXXXXXX` con tu número de WhatsApp real (formato México)
- `TU_OPENROUTER_API_KEY` con tu key real

### 5.3 — Restringir WhatsApp (SEGURIDAD)
El campo `allowFrom` es CRÍTICO. Sin él, cualquier persona que tenga el número del bot puede hablarle.
Agrega solo los números que quieres que tengan acceso.

### 5.4 — Reiniciar el Gateway después de cambiar config
```bash
openclaw gateway restart
openclaw gateway status
# Verificar que siga running
```

---

## PASO 6: CREAR LOS 50 SKILL FILES

Cada agente es un archivo `.md` en `~/.openclaw/workspace/skills/`.

### 6.1 — Crear el directorio
```bash
mkdir -p ~/.openclaw/workspace/skills
```

### 6.2 — Formato de cada skill file
Cada archivo tiene YAML frontmatter + system prompt:

```markdown
---
name: NOMBRE_DEL_AGENTE
description: "Descripción corta"
model: "provider/modelo-id"
fallbackModel: "provider/modelo-fallback"
triggers: ["palabra1", "palabra2", "frase trigger"]
temperature: 0.3
maxTokens: 4096
---
You are NOMBRE. [System prompt completo aquí]
```

### 6.3 — Ejemplo: crear FORGE (code generation)
```bash
cat > ~/.openclaw/workspace/skills/forge.md << 'EOF'
---
name: FORGE
description: "Backend code generation Python/Node.js"
model: "qwen/qwen3-coder-480b-a35b:free"
fallbackModel: "minimax/minimax-m2.5:free"
triggers: ["genera código", "write code", "implementa", "crea función", "build feature", "endpoint", "API"]
temperature: 0.3
maxTokens: 8192
---
You are FORGE, the primary code generator. Write production-ready Python and Node.js code. Rules: (1) Complete, runnable code — never pseudocode. (2) Include error handling. (3) Add docstrings. (4) Follow existing project patterns.
EOF
```

### 6.4 — Script para crear los 50 skills de golpe
El CLAUDE.md principal contiene los 50 skill definitions completos.
Claude Code debe ejecutar el script `create_skills.sh` que genera los 50 archivos.

### 6.5 — Verificar skills cargados
```bash
ls ~/.openclaw/workspace/skills/*.md | wc -l
# Debe mostrar: 50

# Test un skill específico
openclaw test --skill forge "Escribe una función Python que calcule IVA al 16%"
```

---

## PASO 7: CONFIGURAR HEARTBEATS (cron jobs)

### 7.1 — Crear archivo de heartbeats
```bash
cat > ~/.openclaw/heartbeats.json << 'EOF'
{
  "heartbeats": [
    {
      "skill": "watchtower",
      "schedule": "*/5 * * * *",
      "prompt": "Health check completo del sistema",
      "channel": "internal"
    },
    {
      "skill": "hunter",
      "schedule": "0 9,11,14,16 * * 1-5",
      "prompt": "Busca 3 nuevos leads para atiende.ai en Mérida",
      "channel": "whatsapp"
    },
    {
      "skill": "digest",
      "schedule": "0 7 * * 1-5",
      "prompt": "Genera el briefing matutino",
      "channel": "whatsapp"
    },
    {
      "skill": "cobro",
      "schedule": "0 10 * * 1",
      "prompt": "Revisa facturas pendientes de pago",
      "channel": "whatsapp"
    },
    {
      "skill": "radar",
      "schedule": "0 6 * * *",
      "prompt": "Escanea tendencias AI, FinTech LATAM",
      "channel": "internal"
    }
  ]
}
EOF
```

### 7.2 — Reiniciar para cargar heartbeats
```bash
openclaw gateway restart
```

---

## PASO 8: SEGURIDAD

### 8.1 — Canvas Host fix (CRÍTICO)
OpenClaw por default escucha en 0.0.0.0 (accesible desde toda tu red local).
Para restringir a localhost solamente:
```json
// En openclaw.json agregar:
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789
  }
}
```

### 8.2 — NO instalar skills de ClawHub de terceros
El incidente ClawHavoc (marzo 2026) demostró riesgos de data exfiltration.
Escribe TODOS los 50 skills desde cero — que es exactamente lo que hacemos.

### 8.3 — Guardar API key en Keychain (opcional, más seguro)
```bash
security add-generic-password -a "openclaw" -s "openrouter-api-key" -w "TU_API_KEY"
```

### 8.4 — Diagnóstico de seguridad
```bash
openclaw doctor
# Revisa: DM policies, config, seguridad
```

---

## PASO 9: WHATSAPP — NOTAS IMPORTANTES

⚠️ **WhatsApp tiene riesgo de ban por automatización.** WhatsApp detecta:
- Actividad 24/7 desde una IP de servidor
- Frecuencia inusual de mensajes
- Múltiples cuentas desde la misma IP

**Recomendaciones:**
1. Usa un **número separado** (SIM prepago vieja) — NO tu número personal
2. Configura `allowFrom` para restringir quién puede hablar con el bot
3. Empieza con volumen bajo de mensajes
4. Considera **Telegram como canal backup** — zero riesgo de ban, setup en 3 minutos

---

## PASO 10: COMANDOS DE REFERENCIA

```bash
# Status
openclaw gateway status          # Ver si el Gateway corre
openclaw doctor                   # Diagnóstico completo
openclaw doctor --fix             # Auto-reparar problemas

# Dashboard
openclaw dashboard                # Abrir panel web (localhost:18789)

# Skills
openclaw test --skill NOMBRE "prompt"   # Test un skill
ls ~/.openclaw/workspace/skills/        # Ver skills instalados

# Gateway
openclaw gateway restart          # Reiniciar
openclaw gateway run              # Correr en foreground (debug)

# Updates
openclaw update                   # Actualizar a última versión
openclaw update --dry-run         # Preview sin instalar

# WhatsApp
# Comandos desde WhatsApp:
# /status    — ver modelo activo y tokens
# /new       — reset conversación
# /compact   — comprimir contexto
# /usage     — ver costos
```

---

## CHECKPOINT FINAL DE OPENCLAW

- [ ] `openclaw --version` → muestra versión 2026.x.x
- [ ] `openclaw gateway status` → Runtime: running
- [ ] `openclaw doctor` → todo verde
- [ ] `ls ~/.openclaw/workspace/skills/*.md | wc -l` → 50
- [ ] Enviar mensaje de WhatsApp → bot responde
- [ ] `openclaw test --skill forge "test"` → respuesta de código
- [ ] Dashboard en localhost:18789 → se abre y muestra info

---

## DESPUÉS DE ESTE PASO

Una vez OpenClaw funciona con los 50 skills y WhatsApp conectado,
continúa con el CLAUDE.md principal para construir el Dashboard de Empresa Virtual
(Next.js + PixiJS + Supabase).

El Dashboard se conecta al Gateway de OpenClaw vía WebSocket en ws://127.0.0.1:18789.
