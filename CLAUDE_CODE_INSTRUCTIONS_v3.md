# INSTRUCCIONES PARA CLAUDE CODE — Crear 25 Agents OpenClaw v3
# Copia y pega este bloque completo en Claude Code

## CONTEXTO
Estamos expandiendo el sistema de 8 agents a 25 agents. Ya tenemos 8 agents funcionando:
- premium (anthropic/claude-sonnet-4.6) ✅
- grok (x-ai/grok-4.1-fast) ✅ → RENOMBRAR a grok-sales
- qwen-free (qwen/qwen3.6-plus) ✅ → RENOMBRAR a qwen-finance
- code-free (minimax/minimax-m2.5:free) ✅ → RENOMBRAR a minimax-code
- gemini-lite (google/gemini-2.5-flash-lite) ✅
- cheap-misc (stepfun/step-3.5-flash:free) ✅ → RENOMBRAR a stepfun
- local-text (ollama/qwen3:8b) ✅
- local-vision (ollama/gemma4:e4b) ✅ → ELIMINAR (reemplazado por gemma-vision cloud)

## PASO 1: Actualizar config/personas-to-agents.json
Reemplaza el archivo completo con el contenido de ~/Downloads/personas-to-agents-v3.json
(o cópialo de /mnt/user-data/outputs/personas-to-agents-v3.json)

```bash
cp ~/Downloads/personas-to-agents-v3.json ~/openclawsetup/config/personas-to-agents.json
```

## PASO 2: Eliminar agents obsoletos que se renombran
```bash
openclaw agents delete local-vision --force
openclaw agents delete grok --force
openclaw agents delete qwen-free --force  
openclaw agents delete code-free --force
openclaw agents delete cheap-misc --force
```

## PASO 3: Crear los 17 agents nuevos (+ 5 renombrados = 22 que no existen)
Los agents que ya existen y NO cambian: premium, gemini-lite, local-text (3)
Los que necesitan crearse (22):

```bash
# Cada agent necesita:
# 1. openclaw agents add <id> (crea el directorio)
# 2. Copiar models.json y auth-profiles.json de main
# 3. Escribir agent.json con el modelo correcto

AGENTS_DIR="$HOME/.openclaw/agents"
MAIN_AUTH="$AGENTS_DIR/main/agent/auth-profiles.json"
MAIN_MODELS="$AGENTS_DIR/main/agent/models.json"

# Array de agents a crear: "id|model"
declare -a NEW_AGENTS=(
  "grok-sales|x-ai/grok-4.1-fast"
  "qwen-general|qwen/qwen3-next-80b-a3b-instruct:free"
  "hermes-405b|nousresearch/hermes-3-llama-3.1-405b:free"
  "gemma-vision|google/gemma-4-31b-it:free"
  "trinity-creative|arcee-ai/trinity-large-preview:free"
  "kimi-frontend|moonshotai/kimi-k2.5"
  "minimax-code|minimax/minimax-m2.5:free"
  "qwen-coder|qwen/qwen3-coder:free"
  "deepseek-code|deepseek/deepseek-v3.2"
  "nemotron-security|nvidia/nemotron-3-super-120b-a12b:free"
  "qwen-finance|qwen/qwen3.6-plus"
  "grok-legal|x-ai/grok-4.1-fast"
  "gpt-oss|openai/gpt-oss-120b:free"
  "gemini-flash|google/gemini-3-flash-preview"
  "stepfun|stepfun/step-3.5-flash:free"
  "llama-translate|meta-llama/llama-3.3-70b-instruct:free"
  "glm-tools|z-ai/glm-4.5-air:free"
  "gpt-oss-20b|openai/gpt-oss-20b:free"
  "gemma-12b|google/gemma-3-12b-it:free"
  "kimi-thinking|moonshotai/kimi-k2-thinking"
  "qwen-coder-flash|qwen/qwen3-coder-flash"
)

for entry in "${NEW_AGENTS[@]}"; do
  IFS='|' read -r AGENT MODEL <<< "$entry"
  echo "━━━ Creating $AGENT ($MODEL) ━━━"
  
  # Create agent directory structure
  AGENT_DIR="$AGENTS_DIR/$AGENT/agent"
  WORKSPACE="$AGENTS_DIR/$AGENT/workspace"
  SESSIONS="$AGENTS_DIR/$AGENT/sessions"
  
  mkdir -p "$AGENT_DIR" "$WORKSPACE" "$SESSIONS"
  
  # Copy auth and models from main
  cp "$MAIN_AUTH" "$AGENT_DIR/auth-profiles.json"
  cp "$MAIN_MODELS" "$AGENT_DIR/models.json"
  
  # Write agent.json
  cat > "$AGENT_DIR/agent.json" << AJEOF
{
  "id": "$AGENT",
  "model": "$MODEL"
}
AJEOF

  # Write config.json (empty/default)
  cat > "$AGENT_DIR/config.json" << CJEOF
{}
CJEOF

  echo "  ✅ $AGENT created with model $MODEL"
done
```

## PASO 4: Registrar agents en openclaw.json
Cada agent necesita estar en ~/.openclaw/openclaw.json bajo agents.list[].
Lee el archivo actual y agrega los nuevos agents.

## PASO 5: Reiniciar gateway y verificar
```bash
launchctl kickstart -k gui/501/ai.openclaw.gateway
sleep 3
openclaw agents list
```

Debe mostrar 25 agents (main + 24 custom, local-vision eliminado).

## PASO 6: Smoke test de 5 agents representativos
```bash
openclaw agent --agent kimi-frontend --message "Responde solo: ok"
openclaw agent --agent hermes-405b --message "Responde solo: ok"
openclaw agent --agent deepseek-code --message "Responde solo: ok"
openclaw agent --agent llama-translate --message "Responde solo: ok"
openclaw agent --agent gpt-oss --message "Responde solo: ok"
```

## PASO 7: Commit y push
```bash
cd ~/openclawsetup
git add config/personas-to-agents.json
git commit -m "feat(v3): expand to 25 agents across 8 divisions — empresa virtual completa"
git push
```

## NOTAS IMPORTANTES
- El script create_agents.sh existente está OBSOLETO — este proceso lo reemplaza
- NO tocar premium, gemini-lite, ni local-text — ya funcionan correctamente
- grok-sales y grok-legal usan el MISMO modelo (grok-4.1-fast) pero son agents separados
- deepseek-code cubre tanto Engineering como Analytics (6 personas)
- qwen-general es el "workhorse" con 10 personas — el más cargado
