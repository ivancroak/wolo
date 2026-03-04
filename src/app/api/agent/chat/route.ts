import type { ToolContext } from "@/lib/agent/schema";
import { generateSystemPrompt } from "@/lib/agent/system-prompt";
import { executeTool } from "@/lib/agent/tool-executor";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { getSessionUser } from "@/server/auth";
import { checkSessionRateLimit } from "@/server/with-rate-limit";
import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";
const MAX_ITERATIONS = 6;

interface HistoryMessage {
  role: "user" | "agent";
  text: string;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimitResponse = checkSessionRateLimit(user.id, "agent:chat", 20, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: { message: string; history: HistoryMessage[]; listingType: "offer" | "request" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, history = [], listingType } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const systemPrompt = generateSystemPrompt(listingType ?? "offer");

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({
      role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: msg.text,
    })),
    { role: "user", content: message },
  ];

  const collectedContext: ToolContext = {};

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
      });

      const msg = response.choices[0].message;
      messages.push(msg as Groq.Chat.ChatCompletionMessageParam);

      // No tool calls → final text response
      if (!msg.tool_calls?.length) {
        return NextResponse.json({
          text: msg.content ?? "",
          services: collectedContext.services ?? null,
          action: collectedContext.action ?? null,
        });
      }

      // Execute all tool calls in this iteration
      const toolResultMessages: Groq.Chat.ChatCompletionMessageParam[] = [];
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          args = {};
        }

        const { result, context } = await executeTool(call.function.name, args, user.id);
        Object.assign(collectedContext, context);

        toolResultMessages.push({
          role: "tool",
          content: result,
          tool_call_id: call.id,
        });
      }

      messages.push(...toolResultMessages);
    }

    // Iteration limit reached — return whatever we have
    const lastMsg = messages.findLast((m) => m.role === "assistant");
    const text = typeof lastMsg?.content === "string" ? lastMsg.content : "I was unable to complete this request. Please try again.";
    return NextResponse.json({
      text,
      services: collectedContext.services ?? null,
      action: collectedContext.action ?? null,
    });
  } catch (err) {
    console.error("[agent/chat] Groq error:", err);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
