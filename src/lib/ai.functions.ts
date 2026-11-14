import { createServerFn } from "@tanstack/react-start";
import { generateImage, generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

const SYSTEM = `You are a writing assistant for an independent artist (often a ceramicist).
Write ONLY from the facts provided in the record. Never invent dimensions, materials, prices, awards, exhibitions, or provenance.
If a fact is missing, leave it out. Keep a warm, plain, honest voice. Output plain text with no markdown headings.`;

const IMG_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
function cleanImage(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 4_000_000 || !IMG_RE.test(v)) return null
  return v
}

function textOf(res: { output: Array<{ type: string; content?: unknown }> }): string {
  return (res.output as Array<{ type: string; content?: Array<{ type: string; text?: string }> }>)
    .flatMap((item) => (item.type === "message" ? item.content ?? [] : []))
    .map((c) => (c.type === "output_text" ? c.text ?? "" : ""))
    .join("")
    .trim();
}

const TASKS: Record<string, string> = {
  title: "Suggest 5 short title options for this piece, one per line, no numbering.",
  description: "Write a 2-3 paragraph product/catalog description for this piece.",
  statement: "Write a concise artist statement (about 150 words) grounded in the series and artist info.",
  caption: "Write a social media caption for the destination given, with a few relevant hashtags at the end.",
  brainstorm: "Brainstorm 6 concrete ideas for new work or presentation, as a short list with dashes.",
};

function failure(e: unknown): string {
  if (e instanceof GatewayError) {
    if (e.httpStatus === 402) return "AI credits are used up. Add credits in your workspace to keep drafting.";
    if (e.httpStatus === 429) return "Too many requests right now — wait a moment and try again.";
    return `AI request failed: ${e.message}`;
  }
  return "AI request failed. Please try again.";
}

export const draftText = createServerFn({ method: "POST" })
  .validator((d: { kind: string; context: string; note: string; image?: string | null }) => {
    if (!TASKS[d.kind]) throw new Error("Unknown draft kind");
    return { kind: d.kind, context: String(d.context).slice(0, 8000), note: String(d.note ?? "").slice(0, 1000), image: cleanImage(d.image) };
  })
  .handler(async ({ data }) => {
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${TASKS[data.kind]}\n\nRECORD:\n${data.context}${data.note ? `\n\nARTIST NOTE: ${data.note}` : ""}${data.image ? "\n\nThe attached image is the artist's own sketch / notebook page / reference. Use it only as creative direction for themes, forms and mood; never describe it as the finished piece." : ""}`,
              },
              ...(data.image ? [{ type: "input_image" as const, image_url: data.image, detail: "auto" as const }] : []),
            ],
          },
        ],
      });
      return { ok: true as const, text: textOf(res) };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: failure(e) };
    }
  });

export const conceptImage = createServerFn({ method: "POST" })
  .validator((d: { prompt: string; image?: string | null }) => ({ prompt: String(d.prompt).slice(0, 1000), image: cleanImage(d.image) }))
  .handler(async ({ data }) => {
    try {
      let sketch = "";
      if (data.image) {
        // Read the artist's sketch into a visual brief that guides the concept image.
        const desc = await generateResponse({
          model: "openai/gpt-6-astra",
          instructions: "Describe this artist's sketch or reference image as a concise visual brief (forms, proportions, textures, palette, composition) in under 120 words. Plain text.",
          input: [{ role: "user", content: [{ type: "input_image", image_url: data.image, detail: "auto" }] }],
        });
        sketch = textOf(desc);
      }
      const res = await generateImage({
        model: "openai/gpt-image-2.5-sunburst",
        prompt: `Concept sketch / reference image for an artwork idea (not a photo of a finished piece): ${data.prompt}${sketch ? `\n\nFollow the artist's own sketch, described here: ${sketch}` : ""}`,
        size: "1024x1024",
        quality: "medium",
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) return { ok: false as const, error: "No image was returned." };
      return { ok: true as const, dataUrl: `data:image/png;base64,${b64}` };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: failure(e) };
    }
  });
