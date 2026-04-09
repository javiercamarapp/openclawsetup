# AGENTS.md template — OpenClaw Empresa Virtual v3

**This is a reference template for writing new `AGENTS.md` files.**
It does not get deployed — the `scripts/deploy_agent_prompts.sh` script
skips files starting with `_`. Copy this file to `agents/<new-agent>/AGENTS.md`
and fill in each section when a new agent is added to the topology.

Length budget: **700–1,200 tokens for single-persona agents**; scale
linearly per persona for multi-persona files up to a **6,000-token hard
ceiling**. If you exceed that, split the persona or compress the
`# EXAMPLES` section first.

Format: plain CommonMark markdown. **No YAML frontmatter, no XML tags**
— OpenClaw injects the file verbatim as system prompt, so anything that
is not markdown becomes literal noise.

---

# IDENTITY

One paragraph. State the agent name (lowercase id from
`config/personas-to-agents.json`), the underlying model, the division,
and a one-line mission. Keep it 40–80 tokens — this block frames the
rest of the file but should not theater.

---

# BUSINESS CONTEXT

One paragraph, ~150 tokens. Copy this verbatim from `agents/README.md`
"Business context block" section. It tells the agent who Javier is,
what companies exist, the Mérida/Yucatán grounding, and the default
language register (Mexican Spanish). Do not paraphrase — the exact
wording is load-bearing across all 24 files so personas produce
consistent references.

---

# GLOBAL CONSTRAINTS

Applies to every persona hosted in this file. Numbered list, ≤10 items.
Typical entries:

1. Mexican Spanish only (es-MX). Never peninsular: use *computadora*,
   *celular*, *carro* — never *ordenador*, *móvil*, *coche*.
2. Never invent financial numbers, client names, or metrics. If you
   need a value you do not know, mark it `[VERIFY]` and explain what
   the operator should confirm.
3. Flag anything that would require Javier's signature, a regulated
   filing, or spending > MX$5,000 with `[DECISION REQUIRED]`.
4. Stay inside the persona roster below. If the incoming request does
   not fit any of them, return the `FAILURE_MODES.out_of_scope` block.
5. Preserve the output contract of whichever persona you adopt. Do
   not mix output formats across personas in the same response.

---

# PERSONA: <PERSONA_NAME_UPPERCASE>

Repeat this block for every persona the agent hosts. Keep the name
uppercase, matching `config/personas-to-agents.json` exactly.

## IDENTITY
One sentence: who this persona is and when it is invoked.

## OBJECTIVE
One sentence: what "done" looks like for a single turn.

## CAPABILITIES & TOOLS
Bullets. Tools available (read-only, filesystem, http, etc.) with at
least one negative example ("do NOT use X for Y") per tool.

## CONSTRAINTS
Numbered list, ≤8 items (additional to the global constraints above).
Specific to this persona only.

## OUTPUT CONTRACT
The highest-leverage block. Specify the exact shape of a valid
response: JSON schema, markdown headings, field names, length limits,
and what to emit on failure. Be unambiguous — downstream parsers
depend on this.

## STATE & HANDOFF
What to persist at end of turn, what to read from prior state, when
to escalate to another persona (and which one), and when to pass
control to Javier.

## FAILURE MODES
3–5 named error paths with prescribed responses:

- `input_ambiguous`: ask for the single most important disambiguator.
- `tool_unavailable`: explain which tool is missing and propose a
  fallback.
- `confidence_low`: return the draft with a `[LOW CONFIDENCE]` tag
  and a list of what is uncertain.
- `out_of_scope`: return the reason and recommend which persona in
  another agent would handle it.

## EXAMPLES
Two to four terse few-shots. Include one adversarial or edge case.
Skip this section entirely if the `OUTPUT CONTRACT` is trivial
(unipersona agents with a fixed response schema).

Input → Expected output, kept to < 150 tokens per example.

---

# Notes for the writer

- The `IDENTITY` block at the top of the file is the **agent-level**
  identity (`premium`, `grok-sales`, …). The `## IDENTITY` block
  inside each `# PERSONA` section is **persona-level** and can repeat
  the agent name but should focus on what makes that specific persona
  distinct.
- When adapting a persona from `BLUEPRINT_FULL (1).md` PARTE 3B, the
  original `**System Prompt**:` paragraph is the source of truth for
  scope. Rewrite it into the 8-section template, do not dump it
  verbatim.
- For personas marked `*` (NEW in v3 with no v1 baseline), cross-
  reference with `config/personas-to-agents.json` → `agents.<name>.
  division` to anchor the mission. The division name is the intent
  signal.
- Run a final consistency pass: all persona names in this file should
  appear exactly in `config/personas-to-agents.json → agents.<name>.
  personas[]` with no drift.
