import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { image, hint } = await req.json();
    if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 5_500_000) {
      return NextResponse.json({ error: "Upload a valid image smaller than 4 MB." }, { status: 400 });
    }
    // Without an AI key, preserve the photo and let the user confirm item details manually.
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ item: { name: "New wardrobe item", category: "Other", color: "", brand: "", material: "", fit: "", season: "Unknown", notes: "Photo saved. Fill in the item details manually; automatic image recognition is available when an AI provider is configured." }, mode: "manual-confirmation" });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `Inspect the image of a clothing item, shoe, accessory, or its label. Use visible evidence only. Read brand and material from a tag if legible; do not guess. Return ONLY valid JSON with keys: name, category, color, brand, material, fit, season, notes. category must be one of: Tops, Bottoms, Outerwear, Shoes, Accessories, Bags, Activewear, Formalwear, Other. Use empty strings for unknown fields.`,
      input: [{ role: "user", content: [{ type: "input_text", text: `Identify this wardrobe item. User note: ${String(hint || "No extra details")}` }, { type: "input_image", image_url: image, detail: "high" }] }],
    });
    const raw = response.output_text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return NextResponse.json({ item: JSON.parse(raw), mode: "ai" });
  } catch (error) {
    console.error("/api/analyze-item error", error);
    return NextResponse.json({ error: "I couldn't read that image. Try a clearer photo of the item or tag." }, { status: 500 });
  }
}
