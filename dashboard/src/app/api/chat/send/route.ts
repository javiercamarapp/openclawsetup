/**
 * POST /api/chat/send — Phase 4
 *
 * Inserts a direct message from Javier into the direct_messages table.
 */

import { getServerSupabase } from "@/lib/supabase/server";

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

    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        thread_id: threadId,
        sender: "javier",
        content: content.trim(),
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      console.error("[api/chat/send] Insert error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    console.error("[api/chat/send] Unexpected error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
