# EMPRESA VIRTUAL OPENCLAW — ARQUITECTURA v3 DEFINITIVA
# 25 Agents | ~75 Personas | $200/mo budget
# Javier Cámara — Abril 2026

## RESUMEN EJECUTIVO
- **25 agents** en OpenClaw (cada uno con modelo fijo)
- **~75 personas** como prompt templates dentro de los agents
- **Costo estimado: $80-120/mo** (uso medio), deja $80-120 de headroom
- **13 agents FREE** ($0/mo), **11 agents PAID**, **1 local**

---

## DIV 1 — VENTAS & REVENUE (10 personas → 4 agents)

### Agent: `premium` — anthropic/claude-sonnet-4.6
- **Costo:** ~$18/mo | **Ctx:** 1M | **Precio:** $3/$15/M
- **Por qué:** Mejor prosa en español, persuasión, creatividad medida (EQ-Bench #2)
- **Personas:**
  - PROPUESTA — Propuestas comerciales, investor decks
  - SOCIAL — LinkedIn posts, personal brand voice

### Agent: `grok-sales` — x-ai/grok-4.1-fast  
- **Costo:** ~$7/mo | **Ctx:** 2M | **Precio:** $0.20/$0.50/M
- **Por qué:** #1 tool-calling agentic, 2M context, RL-trained para ventas
- **Personas:**
  - HUNTER — Lead generation, prospecting outbound
  - VOZ — Phone scripts, call prep, objection handling
  - RETAIN — Customer retention, churn prevention
  - CLOSER — Negotiation tactics, deal closing strategies
  - UPSELL — Cross-sell/upsell opportunity detection

### Agent: `qwen-general` — qwen/qwen3-next-80b-a3b-instruct:free
- **Costo:** $0 | **Ctx:** 262K | **Precio:** FREE
- **Por qué:** 80B MoE, 3B activos, buen generalista gratis
- **Personas:**
  - FILTER — Lead qualification, scoring
  - PIPELINE — Deal tracking, CRM updates
  - PRIORITY — Task prioritization, deal ranking

### Agent: `gemini-lite` — google/gemini-2.5-flash-lite
- **Costo:** ~$4/mo | **Ctx:** 1M | **Precio:** $0.10/$0.40/M
- **Por qué:** Ultra-rápido, 1M context, barato para tareas repetitivas
- **Personas:**
  - BIENVENIDA — Onboarding sequences
  - COBRO — Collections follow-up, payment reminders

---

## DIV 2 — MARCA PERSONAL & CONTENIDO (8 personas → 4 agents)

### Agent: `premium` (shared) — anthropic/claude-sonnet-4.6
- **Personas:**
  - SOCIAL — LinkedIn posts (shared con Div1)

### Agent: `hermes-405b` — nousresearch/hermes-3-llama-3.1-405b:free
- **Costo:** $0 | **Ctx:** 131K | **Precio:** FREE
- **Por qué:** 405B params — el modelo free más grande, excelente creative writing
- **Personas:**
  - PLUMA — Copywriting, blog posts, articles
  - MEDIA — Video scripts, podcast outlines, YouTube titles
  - STORYTELLER — Brand storytelling, case studies, testimonials

### Agent: `gemma-vision` — google/gemma-4-31b-it:free
- **Costo:** $0 | **Ctx:** 262K | **Precio:** FREE
- **Por qué:** 31B multimodal (text+image+video), reemplaza Gemma 4B local
- **Personas:**
  - VISUAL — Image analysis, Instagram content, competitor visual audit
  - THUMBNAIL — YouTube thumbnail concepts, social media graphics briefs

### Agent: `gemini-lite` (shared)
- **Personas:**
  - CORREO — Email marketing, newsletters, drip campaigns
  - RANKING — SEO optimization, keyword research

---

## DIV 3 — INGENIERÍA DE SOFTWARE (12 personas → 5 agents)

### Agent: `kimi-frontend` — moonshotai/kimi-k2.5
- **Costo:** ~$5/mo | **Ctx:** 262K | **Precio:** $0.38/$1.72/M
- **Por qué:** #1 OpenRouter Programming ranking, visual coding SOTA, agent swarm
- **Personas:**
  - FRONTEND — React/Next.js, Tailwind, responsive design
  - UI-UX — Component library, design system, accessibility
  - PIXEL — Visual review, CSS debugging, layout analysis

### Agent: `minimax-code` — minimax/minimax-m2.5:free
- **Costo:** $0 | **Ctx:** 197K | **Precio:** FREE
- **Por qué:** 80.2% SWE-bench Verified — best free coding model
- **Personas:**
  - BACKEND — Python/FastAPI, Node.js, server logic
  - API — REST/GraphQL design, endpoint testing, docs
  - QUALITY — Code review, PR analysis, refactoring suggestions

### Agent: `qwen-coder` — qwen/qwen3-coder:free
- **Costo:** $0 | **Ctx:** 262K | **Precio:** FREE
- **Por qué:** 480B MoE coding specialist, tool-calling nativo, 262K ctx
- **Personas:**
  - FORGE — CI/CD pipelines, GitHub Actions, automation
  - DEPLOY — Docker, Vercel, Cloudflare, infrastructure
  - SWIFT — Quick scripts, shell, data processing

### Agent: `deepseek-code` — deepseek/deepseek-v3.2
- **Costo:** ~$2/mo | **Ctx:** 164K | **Precio:** $0.26/$0.38/M
- **Por qué:** 77.2% SWE-bench, 96% AIME, IMO gold — math+code combo
- **Personas:**
  - SUPABASE — Database design, RLS policies, Edge Functions, migrations
  - SQL — Query optimization, data modeling, ETL pipelines
  - ARCHITECT — System design, scalability, tech stack decisions

### Agent: `nemotron-security` — nvidia/nemotron-3-super-120b-a12b:free
- **Costo:** $0 | **Ctx:** 262K | **Precio:** FREE
- **Por qué:** 120B hybrid MoE, Mamba-Transformer, strong agentic
- **Personas:**
  - SHIELD — Security scanning, vulnerability detection, OWASP
  - TRIAGE — Bug triage, error analysis, issue prioritization

---

## DIV 4 — OPERACIONES & FINANZAS (8 personas → 3 agents)

### Agent: `qwen-finance` — qwen/qwen3.6-plus
- **Costo:** ~$4/mo | **Ctx:** 1M | **Precio:** $0.33/$1.95/M
- **Por qué:** #1 Finance ranking OpenRouter, 78.8% SWE-bench, 1M context
- **Personas:**
  - LEDGER — Bookkeeping, transaction categorization, reconciliation
  - FLUJO — Cash flow 30/60/90, burn rate, runway scenarios
  - FISCAL — ISR, IVA, IEPS, RESICO, SAT compliance
  - FACTURA — CFDI generation, RFC validation, IVA calculations
  - TREASURY — Bank reconciliation, payment scheduling, float management

### Agent: `grok-legal` — x-ai/grok-4.1-fast
- **Costo:** ~$3/mo | **Ctx:** 2M | **Precio:** $0.20/$0.50/M
- **Por qué:** Strong reasoning + 2M context for long contracts
- **Personas:**
  - LEGAL — Contract review, compliance, terms analysis
  - REGULATORIO — Mexican regulatory compliance, NOM standards
  - IP — Trademark monitoring, patent landscape, IP strategy

### Agent: `qwen-general` (shared)
- **Personas:**
  - TALENTO — HR, recruitment, job descriptions, interview guides
  - NOMINA — Payroll calculations, IMSS, Infonavit basics

---

## DIV 5 — PRODUCTO & CRECIMIENTO (10 personas → 4 agents)

### Agent: `qwen-general` (shared)
- **Personas:**
  - PRODUCTO — Product roadmap, feature specs, user stories
  - PRIORITY — Feature prioritization, ICE/RICE scoring
  - ESCUCHA — Social listening, NPS analysis, customer feedback

### Agent: `deepseek-analytics` — deepseek/deepseek-v3.2 (shared con Div3)
- **Personas:**
  - SPLIT — A/B test design, statistical significance, experiment analysis
  - METRICS — KPI dashboards, cohort analysis, funnel optimization
  - GROWTH-HACK — Growth experiments, viral loops, referral mechanics

### Agent: `gemini-lite` (shared)
- **Personas:**
  - DOCS — Technical documentation, READMEs, changelogs
  - RANKING — SEO (shared con Div2)

### Agent: `minimax-code` (shared)
- **Personas:**
  - TRIAGE — Bug triage (shared con Div3)

---

## DIV 6 — AI OPERATIONS (5 personas → 3 agents)

### Agent: `gpt-oss` — openai/gpt-oss-120b:free
- **Costo:** $0 | **Ctx:** 131K | **Precio:** FREE
- **Por qué:** OpenAI 120B MoE gratis, strong reasoning
- **Personas:**
  - ROUTER — Agent routing, escalation decisions, quality gates
  - BENCHMARKER — Model A/B testing, eval scoring, cost tracking
  - ORCHESTRATOR — Multi-agent coordination, workflow optimization

### Agent: `gemini-lite` (shared)
- **Personas:**
  - PROMPT-OPT — Prompt engineering, template optimization

### Agent: `nemotron-security` (shared)
- **Personas:**
  - AI-MONITOR — Agent health checks, latency monitoring, error rates

---

## DIV 7 — ESTRATEGIA & INTELIGENCIA (8 personas → 3 agents)

### Agent: `gemini-flash` — google/gemini-3-flash-preview
- **Costo:** ~$5/mo | **Ctx:** 1M | **Precio:** $0.50/$3.00/M
- **Por qué:** Near-Pro quality, 1M context, thinking mode para deep analysis
- **Personas:**
  - DEEP-RESEARCH — Multi-source deep analysis, synthesis reports
  - COMPETE — Competitive intelligence, market positioning
  - INVESTOR — Investor prep, pitch deck data, due diligence

### Agent: `grok-sales` (shared)
- **Personas:**
  - DEALFLOW — M&A opportunities, partnership scouting

### Agent: `qwen-general` (shared)
- **Personas:**
  - OPORTUNIDAD — Market gaps, underserved niches, LATAM opportunities
  - TENDENCIA — Trend scanning, technology radar, emerging tech
  - RADAR — Content opportunity detection (shared con Div2)

### Agent: `stepfun` — stepfun/step-3.5-flash:free
- **Costo:** $0 | **Ctx:** 256K | **Precio:** FREE
- **Por qué:** 196B MoE, 11B activos, fast para scanning tasks
- **Personas:**
  - WATCHTOWER — Market monitoring, alert triggers, news scanning

---

## DIV 8 — COMUNICACIÓN & IDIOMA (6 personas → 3 agents)

### Agent: `llama-translate` — meta-llama/llama-3.3-70b-instruct:free
- **Costo:** $0 | **Ctx:** 66K | **Precio:** FREE
- **Por qué:** 70B params, trained natively on Spanish (Azumo), free
- **Personas:**
  - TRADUCE — EN↔ES-MX professional translation
  - LOCALIZA — Content localization, cultural adaptation, glossary management

### Agent: `gemini-lite` (shared)
- **Personas:**
  - DIGEST — Daily briefings, executive summaries, morning newspaper
  - INBOX — Email triage, priority sorting, auto-responses

### Agent: `local-text` — ollama/qwen3:8b
- **Costo:** $0 | **Ctx:** local | **Precio:** FREE (Mac Mini)
- **Por qué:** Offline fallback, private data, no internet required
- **Personas:**
  - OFFLINE — Emergency fallback when cloud is down
  - PRIVATE — Sensitive data processing that can't leave the machine

---

## RESUMEN DE AGENTS (25 total)

| # | Agent ID | Modelo | $/mo | Personas | Tipo |
|---|----------|--------|------|----------|------|
| 1 | premium | anthropic/claude-sonnet-4.6 | ~$18 | 2 | PREMIUM |
| 2 | grok-sales | x-ai/grok-4.1-fast | ~$7 | 7 | PAID |
| 3 | qwen-general | qwen/qwen3-next-80b-a3b-instruct:free | $0 | 12 | FREE |
| 4 | gemini-lite | google/gemini-2.5-flash-lite | ~$4 | 8 | PAID |
| 5 | hermes-405b | nousresearch/hermes-3-llama-3.1-405b:free | $0 | 3 | FREE |
| 6 | gemma-vision | google/gemma-4-31b-it:free | $0 | 2 | FREE |
| 7 | kimi-frontend | moonshotai/kimi-k2.5 | ~$5 | 3 | PAID |
| 8 | minimax-code | minimax/minimax-m2.5:free | $0 | 4 | FREE |
| 9 | qwen-coder | qwen/qwen3-coder:free | $0 | 3 | FREE |
| 10 | deepseek-code | deepseek/deepseek-v3.2 | ~$3 | 6 | PAID |
| 11 | nemotron-security | nvidia/nemotron-3-super-120b-a12b:free | $0 | 3 | FREE |
| 12 | qwen-finance | qwen/qwen3.6-plus | ~$4 | 5 | PAID |
| 13 | grok-legal | x-ai/grok-4.1-fast | ~$3 | 3 | PAID |
| 14 | deepseek-analytics | deepseek/deepseek-v3.2 | shared | 3 | shared w/10 |
| 15 | gpt-oss | openai/gpt-oss-120b:free | $0 | 3 | FREE |
| 16 | gemini-flash | google/gemini-3-flash-preview | ~$5 | 3 | PAID |
| 17 | stepfun | stepfun/step-3.5-flash:free | $0 | 1 | FREE |
| 18 | llama-translate | meta-llama/llama-3.3-70b-instruct:free | $0 | 2 | FREE |
| 19 | local-text | ollama/qwen3:8b | $0 | 2 | LOCAL |
| — | — | — | — | — | — |
| 20 | glm-tools | z-ai/glm-4.5-air:free | $0 | 2 | FREE |
| 21 | trinity-creative | arcee-ai/trinity-large-preview:free | $0 | 2 | FREE |
| 22 | gpt-oss-20b | openai/gpt-oss-20b:free | $0 | 2 | FREE |
| 23 | gemma-12b | google/gemma-3-12b-it:free | $0 | 1 | FREE |
| 24 | kimi-thinking | moonshotai/kimi-k2-thinking | ~$3 | 1 | PAID |
| 25 | qwen-coder-flash | qwen/qwen3-coder-flash | ~$2 | 2 | PAID |

### Agents 20-25 (BONUS — más especialización)

### Agent: `glm-tools` — z-ai/glm-4.5-air:free
- **Costo:** $0 | **Ctx:** 131K
- **Personas:**
  - NEXUS — CRM data management, deduplication, structured output
  - WEBHOOK — Webhook management, API integrations, Zapier/Make flows

### Agent: `trinity-creative` — arcee-ai/trinity-large-preview:free
- **Costo:** $0 | **Ctx:** 131K
- **Personas:**
  - BRAND-VOICE — Brand consistency checking, tone analysis
  - EDITORIAL — Content editing, grammar, style guide enforcement

### Agent: `gpt-oss-20b` — openai/gpt-oss-20b:free
- **Costo:** $0 | **Ctx:** 131K | 98.7% AIME (math)
- **Personas:**
  - CALCULATOR — Financial calculations, unit economics, pricing models
  - FORECAST — Statistical forecasting, regression, time series

### Agent: `gemma-12b` — google/gemma-3-12b-it:free
- **Costo:** $0 | **Ctx:** 32K
- **Personas:**
  - CLASSIFIER — Intent classification, sentiment analysis, tagging

### Agent: `kimi-thinking` — moonshotai/kimi-k2-thinking
- **Costo:** ~$3/mo | **Ctx:** 262K | $0.60/$2.50/M
- **Personas:**
  - ARCHITECT-DEEP — Complex system design requiring deep reasoning

### Agent: `qwen-coder-flash` — qwen/qwen3-coder-flash
- **Costo:** ~$2/mo | **Ctx:** 1M | $0.20/$0.97/M
- **Personas:**
  - MONOREPO — Large codebase operations, multi-file refactoring (1M context)
  - MIGRATION — Database migrations, framework upgrades, legacy modernization

---

## BUDGET BREAKDOWN

| Categoría | Agents | Costo/mo |
|-----------|--------|----------|
| Premium (Claude) | 1 | $18 |
| Paid mid-range | 7 | $32 |
| Free cloud | 15 | $0 |
| Local | 1 | $0 |
| **TOTAL** | **25** | **~$50-80** |
| Budget restante | — | **$120-150** |

## NOTA SOBRE grok-sales vs grok-legal
Son el MISMO modelo (grok-4.1-fast) pero en agents SEPARADOS para:
1. Aislamiento de sesiones (sales no contamina legal)
2. System prompts diferentes
3. Workspace separados
Costo combinado: ~$10/mo

## MODELOS ÚNICOS USADOS: 16
1. anthropic/claude-sonnet-4.6 ($3/$15)
2. x-ai/grok-4.1-fast ($0.20/$0.50)
3. qwen/qwen3-next-80b-a3b-instruct:free (FREE)
4. google/gemini-2.5-flash-lite ($0.10/$0.40)
5. nousresearch/hermes-3-llama-3.1-405b:free (FREE)
6. google/gemma-4-31b-it:free (FREE)
7. moonshotai/kimi-k2.5 ($0.38/$1.72)
8. minimax/minimax-m2.5:free (FREE)
9. qwen/qwen3-coder:free (FREE)
10. deepseek/deepseek-v3.2 ($0.26/$0.38)
11. nvidia/nemotron-3-super-120b-a12b:free (FREE)
12. qwen/qwen3.6-plus ($0.33/$1.95)
13. openai/gpt-oss-120b:free (FREE)
14. google/gemini-3-flash-preview ($0.50/$3.00)
15. stepfun/step-3.5-flash:free (FREE)
16. meta-llama/llama-3.3-70b-instruct:free (FREE)
17. z-ai/glm-4.5-air:free (FREE)
18. arcee-ai/trinity-large-preview:free (FREE)
19. openai/gpt-oss-20b:free (FREE)
20. google/gemma-3-12b-it:free (FREE)
21. moonshotai/kimi-k2-thinking ($0.60/$2.50)
22. qwen/qwen3-coder-flash ($0.20/$0.97)
23. ollama/qwen3:8b (LOCAL)
