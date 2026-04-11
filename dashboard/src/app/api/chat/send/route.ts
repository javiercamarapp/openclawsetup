/**
 * POST /api/chat/send — Phase 4 (real AI responses)
 *
 * 1. Saves Javier's message to direct_messages
 * 2. Calls OpenRouter with the agent's model to get a REAL response
 * 3. Saves the agent's response to direct_messages
 *
 * The agent actually "thinks" and responds using its assigned LLM.
 */

import { getServerSupabase } from "@/lib/supabase/server";

// Agent model mapping from personas-to-agents-v3.json
const AGENT_MODELS: Record<string, { model: string; persona: string }> = {
  "premium":          { model: "anthropic/claude-sonnet-4.6", persona: "Eres el agente PREMIUM de Javier. Manejas propuestas de alto nivel y social media strategy. Respondes en español mexicano, conciso y profesional." },
  "grok-sales":       { model: "x-ai/grok-4.1-fast", persona: "Eres el agente de ventas de Javier. Manejas leads, prospeccion, cierres y upselling. Respondes en español mexicano, directo y orientado a resultados." },
  "qwen-general":     { model: "qwen/qwen3-next-80b-a3b-instruct:free", persona: "Eres un agente general multiproposito. Filtras datos, priorizas tareas y generas reportes. Respondes en español mexicano, eficiente y claro." },
  "gemini-lite":      { model: "google/gemini-2.5-flash-lite", persona: "Eres un agente ligero que maneja bienvenidas, cobranza, correos y digests. Respondes en español mexicano, amable y conciso." },
  "hermes-405b":      { model: "nousresearch/hermes-3-llama-3.1-405b:free", persona: "Eres el agente de contenido. Escribes copy, historias y media content. Respondes en español mexicano, creativo y con buena narrativa." },
  "gemma-vision":     { model: "google/gemma-4-31b-it:free", persona: "Eres el agente visual. Procesas imagenes, generas thumbnails y analizas contenido visual. Respondes en español mexicano." },
  "trinity-creative": { model: "arcee-ai/trinity-large-preview:free", persona: "Eres el agente de brand voice y editorial. Cuidas la voz de marca y revisas contenido. Respondes en español mexicano." },
  "kimi-frontend":    { model: "moonshotai/kimi-k2.5", persona: "Eres el agente de frontend. Construyes UI/UX, componentes React y interfaces. Respondes en español mexicano, tecnico pero accesible." },
  "minimax-code":     { model: "minimax/minimax-m2.5:free", persona: "Eres el agente de backend. Manejas APIs, calidad de codigo y arquitectura. Respondes en español mexicano, tecnico y preciso." },
  "qwen-coder":       { model: "qwen/qwen3-coder:free", persona: "Eres el agente de desarrollo. Construyes features, deployeas y haces QA. Respondes en español mexicano." },
  "deepseek-code":    { model: "deepseek/deepseek-v3.2", persona: "Eres el agente de data engineering. Manejas Supabase, SQL, arquitectura y metricas. Respondes en español mexicano, analitico." },
  "nemotron-security":{ model: "nvidia/nemotron-3-super-120b-a12b:free", persona: "Eres el agente de seguridad y triage. Monitoreas vulnerabilidades, clasificas bugs y vigilas el sistema. Respondes en español mexicano." },
  "qwen-finance":     { model: "qwen/qwen3.6-plus", persona: "Eres el agente de finanzas. Manejas flujo de caja, facturas, presupuestos y proyecciones fiscales. Respondes en español mexicano." },
  "grok-legal":       { model: "x-ai/grok-4.1-fast", persona: "Eres el agente legal. Revisas contratos, compliance y propiedad intelectual. Respondes en español mexicano, formal y preciso." },
  "gpt-oss":          { model: "openai/gpt-oss-120b:free", persona: "Eres el agente orquestador. Ruteas requests, haces benchmarks y coordinas agentes. Respondes en español mexicano." },
  "gemini-flash":     { model: "google/gemini-3-flash-preview", persona: "Eres el agente de estrategia. Haces deep research, analisis competitivo y reportes para inversores. Respondes en español mexicano." },
  "stepfun":          { model: "stepfun/step-3.5-flash:free", persona: "Eres el agente watchtower. Monitoreas salud del sistema, uptime y alertas. Respondes en español mexicano, breve y factual." },
  "llama-translate":  { model: "meta-llama/llama-3.3-70b-instruct:free", persona: "Eres el agente de traduccion y localizacion. Traduces contenido y adaptas culturalmente. Respondes en español mexicano." },
  "local-text":       { model: "ollama/qwen3:8b", persona: "Eres un agente local privado. Procesas datos offline y sensibles. Respondes en español mexicano, breve." },
  "glm-tools":        { model: "z-ai/glm-4.5-air:free", persona: "Eres el agente de integraciones. Manejas webhooks, APIs externas y conexiones. Respondes en español mexicano." },
  "gpt-oss-20b":      { model: "openai/gpt-oss-20b:free", persona: "Eres el agente de calculo y forecast. Modelas crecimiento y analizas datos numericos. Respondes en español mexicano." },
  "gemma-12b":        { model: "google/gemma-3-12b-it:free", persona: "Eres el agente clasificador. Categorizas texto, haces NLP y tageas contenido. Respondes en español mexicano." },
  "kimi-thinking":    { model: "moonshotai/kimi-k2-thinking", persona: "Eres el agente de pensamiento profundo. Haces analisis arquitectural y planificacion de sprints. Respondes en español mexicano." },
  "qwen-coder-flash": { model: "qwen/qwen3-coder-flash", persona: "Eres el agente de quick fixes. Manejas hotfixes, migraciones y scripts rapidos. Respondes en español mexicano." },
};

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { threadId, content } = body as {
      threadId: string;
      content: string;
    };

    if (!threadId || !content) {
      return Response.json(
        { error: "threadId and content are required" },
        { status: 400 },
      );
    }

    const supabase = getServerSupabase();

    // 1. Save Javier's message
    const { error: insertErr } = await supabase
      .from("direct_messages")
      .insert({
        thread_id: threadId,
        sender: "javier",
        content: content.trim(),
      });

    if (insertErr) {
      console.error("[api/chat/send] Insert error:", insertErr);
      return Response.json({ error: insertErr.message }, { status: 500 });
    }

    // 2. Get agent config
    const agentConfig = AGENT_MODELS[threadId];
    if (!agentConfig) {
      return Response.json({ ok: true, agentResponse: false });
    }

    // 3. Get OpenRouter API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("[api/chat/send] OPENROUTER_API_KEY not set, skipping agent response");
      return Response.json({ ok: true, agentResponse: false, reason: "no_api_key" });
    }

    // 4. Load recent conversation context
    const { data: recentMsgs } = await supabase
      .from("direct_messages")
      .select("sender, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatHistory = (recentMsgs ?? [])
      .reverse()
      .map((m) => ({
        role: m.sender === "javier" ? "user" as const : "assistant" as const,
        content: m.content,
      }));

    // 5. Call OpenRouter for real AI response
    const openrouterRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kairotec.com",
        "X-Title": "Empresa Virtual Dashboard",
      },
      body: JSON.stringify({
        model: agentConfig.model,
        messages: [
          { role: "system", content: agentConfig.persona },
          ...chatHistory,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      console.error("[api/chat/send] OpenRouter error:", errText);
      return Response.json({ ok: true, agentResponse: false, reason: "openrouter_error" });
    }

    const completion = await openrouterRes.json();
    const agentReply =
      completion.choices?.[0]?.message?.content ?? "...";

    // 6. Save agent's response
    await supabase.from("direct_messages").insert({
      thread_id: threadId,
      sender: threadId,
      content: agentReply,
    });

    return Response.json({ ok: true, agentResponse: true });
  } catch (err) {
    console.error("[api/chat/send] Unexpected error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
