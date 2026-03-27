import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aiEditSchema } from "@/lib/validations";
import { reserveAiFillCredits, InsufficientCreditsError } from "@/lib/credits";
import type { AttributeConfigJson, Attribute } from "@/lib/attributes";
import { parseGeminiUsage, classifyError } from "@/lib/api-usage";
import { API_USAGE_TYPE } from "@/lib/constants";
import { Prisma } from "@/generated/prisma/client";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash";
const FETCH_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a book cover attribute configuration editor. Your job is to modify attribute configurations based on user instructions.

You will receive the user's current attribute configuration as JSON — an array of attributes, each with id, name, type, enabled, description, values, and optional scaleLabels.

## Attribute Types

- "single": Pick one value from a list. Values have: value (slug), label, builtIn, description (optional), colors (optional).
- "multi": Pick multiple values as tags. Same value structure as single.
- "text": Free-form text. No predefined values array (keep it empty).
- "toggle": On/off. No predefined values array (keep it empty).
- "scale": Number 0-10. No predefined values array. May have scaleLabels: { min, max } for endpoint labels.
- "color": Hex color value. No predefined values array.
- "palette": Curated color sets. Values MUST include a "colors" array with exactly 5 hex strings, e.g. ["#0a0a0f", "#1a1a2e", "#4a1942", "#c84b31", "#fbbf24"].

## Rules

- Return the COMPLETE attributes array with all modifications applied.
- Only change what the user asks for. Preserve all other attributes, values, and fields exactly as-is.
- Preserve the original ordering of attributes and values. Append new items at the end.
- For new attributes: set builtIn to false, enabled to true. Generate a slug id from the name (lowercase, hyphens for spaces).
- For new values: set builtIn to false. Generate a slug value from the label. Include a description explaining how it affects the cover.
- Preserve existing builtIn flags — never change them.
- The result must have at least 1 attribute.
- Do NOT include explanations or commentary — only the JSON object.

## Response Format

Respond with valid JSON:
{ "attributes": [ ...complete attribute array... ] }`;

function serializeConfig(config: AttributeConfigJson): string {
  return JSON.stringify({ attributes: config.attributes }, null, 2);
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const zodResult = aiEditSchema.safeParse(body);
  if (!zodResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: zodResult.error.issues },
      { status: 400 },
    );
  }

  const { prompt } = zodResult.data;

  const configRecord = await prisma.attributeConfig.findUnique({
    where: { userId: session.user.id },
    select: { config: true },
  });

  if (!configRecord) {
    return NextResponse.json({ error: "No attribute config found" }, { status: 404 });
  }

  try {
    await reserveAiFillCredits(session.user.id);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: `Insufficient credits: need ${err.required}, have ${err.available}` },
        { status: 403 },
      );
    }
    throw err;
  }

  const startTime = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const before = configRecord.config as unknown as AttributeConfigJson;
    const configJson = serializeConfig(before);
    const userPrompt = `Current attribute configuration:\n\n${configJson}\n\n---\n\nUser's instruction: ${prompt}`;

    const res = await fetch(
      `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 },
          },
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[ai-edit] Gemini HTTP ${res.status}:`, errorBody);
      throw new Error(
        res.status === 429
          ? "Rate limited — please try again in a moment"
          : "Failed to generate config changes",
      );
    }

    const geminiData = await res.json();
    const durationMs = Date.now() - startTime;
    const textPart = geminiData?.candidates?.[0]?.content?.parts?.find(
      (p: Record<string, unknown>) => typeof p.text === "string",
    );

    if (!textPart?.text) throw new Error("No response from AI model");

    let geminiParsed: unknown;
    try {
      geminiParsed = JSON.parse(textPart.text);
    } catch {
      console.error("[ai-edit] Failed to parse Gemini JSON:", textPart.text);
      throw new Error("AI returned invalid response — please try again");
    }

    // Basic shape validation
    if (
      !geminiParsed ||
      typeof geminiParsed !== "object" ||
      !Array.isArray((geminiParsed as { attributes?: unknown }).attributes)
    ) {
      throw new Error("AI returned unexpected format — please try again");
    }

    const afterAttributes = (geminiParsed as { attributes: Attribute[] }).attributes.map(
      (a) => ({
        ...a,
        enabled: a.enabled ?? true,
        builtIn: a.builtIn ?? false,
        values: (a.values ?? []).map((v) => ({
          ...v,
          builtIn: v.builtIn ?? false,
        })),
      }),
    );

    // Preserve briefPosition from original config
    const after: AttributeConfigJson = {
      ...before,
      attributes: afterAttributes,
    };

    // Log API usage (best-effort)
    try {
      const parsed = parseGeminiUsage(geminiData as Record<string, unknown>, "gemini-2.5-flash");
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_EDIT,
          provider: "gemini",
          model: "gemini-2.5-flash",
          promptTokens: parsed.promptTokens,
          candidatesTokens: parsed.candidatesTokens,
          totalTokens: parsed.totalTokens,
          estimatedCostUsd: parsed.estimatedCostUsd,
          success: true,
          durationMs,
          responseMetadata: parsed.responseMetadata != null ? parsed.responseMetadata as unknown as Prisma.InputJsonValue : undefined,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Edit usage:", logErr);
    }

    return NextResponse.json({ before, after });
  } catch (err) {
    console.error("[ai-edit] Failed:", err);

    try {
      const errObj = err as Error & { status?: number; durationMs?: number };
      const errorType = classifyError(errObj.status ?? 0, errObj.message);
      await prisma.apiUsage.create({
        data: {
          userId: session.user.id,
          type: API_USAGE_TYPE.AI_EDIT,
          provider: "gemini",
          model: "gemini-2.5-flash",
          success: false,
          durationMs: errObj.durationMs ?? null,
          errorCode: errObj.status ? String(errObj.status) : null,
          errorType,
          errorMessage: errObj.message,
        },
      });
    } catch (logErr) {
      console.error("[api-usage] Failed to log AI Edit error:", logErr);
    }

    const message = err instanceof Error ? err.message : "Failed to edit attributes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
