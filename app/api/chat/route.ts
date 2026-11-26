import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ClosetItem = { name?: string; category?: string; color?: string; brand?: string; material?: string; fit?: string; season?: string; notes?: string };

function localStylist(message: string, closet: ClosetItem[], weather: any, season: string, localTime: string, style: string) {
  const q = message.toLowerCase();
  const items = closet.filter(x => x && x.name);
  const find = (terms: string[]) => items.filter(x => terms.some(t => `${x.category || ""} ${x.name || ""}`.toLowerCase().includes(t)));
  const tops = find(["top", "shirt", "tee", "t-shirt", "sweater", "blouse", "hoodie", "polo", "shirt"]);
  const bottoms = find(["bottom", "pant", "jean", "trouser", "short", "skirt"]);
  const shoes = find(["shoe", "sneaker", "boot", "heel", "loafer", "sandal"]);
  const outerwear = find(["outerwear", "jacket", "coat", "cardigan"]);
  const accessories = find(["accessor", "watch", "belt", "bag", "jewelry", "hat", "scarf"]);
  const temp = typeof weather?.temperature === "number" ? `${Math.round(weather.temperature)}°` : "not available";
  const condition = weather?.description || weather?.condition || "";
  const requested = q.includes("formal") || q.includes("wedding") || q.includes("interview") ? "formal" : q.includes("date") ? "date night" : q.includes("work") || q.includes("office") ? "smart casual" : q.includes("gym") || q.includes("workout") ? "athletic" : q.includes("street") ? "streetwear" : q.includes("casual") ? "casual" : style || "everyday";
  const pick = (arr: ClosetItem[]) => arr[0];
  const chosen = [pick(tops), pick(bottoms), pick(shoes)].filter(Boolean) as ClosetItem[];
  const line = (x?: ClosetItem) => x ? `- **${x.name}**${x.color ? ` (${x.color})` : ""}${x.brand ? ` — ${x.brand}` : ""}` : "";
  if (!items.length) return `I'd love to style you. First, add a few pieces to your digital closet using **Add item**. Start with one top, one pair of pants, and your favorite shoes.\n\nThen tell me the occasion and the look you're after—casual, formal, date night, streetwear, or anything else.\n\nI can already see your local season is **${season}**, and the current time is **${localTime}**. The weather is **${temp}**${condition ? ` (${condition})` : ""}.`;
  let reply = `## Your ${requested} outfit\n\n`;
  if (chosen.length) reply += `### Start with these pieces\n${chosen.map(line).join("\n")}\n\n`;
  if (outerwear.length && (weather?.temperature < 16 || /rain|wind|snow/i.test(condition))) reply += `### Layer\n${line(outerwear[0])}\n\n`;
  if (accessories.length) reply += `### Finish it\n${accessories.slice(0, 2).map(line).join("\n")}\n\n`;
  if (!tops.length || !bottoms.length || !shoes.length) reply += `### What your closet is missing\n${[!tops.length && "a top", !bottoms.length && "a pair of bottoms", !shoes.length && "shoes"].filter(Boolean).join(", ")}. These are suggestions—not items I think you already own.\n\n`;
  reply += `### Styling notes\nKeep the palette intentional: pair a neutral base with one complementary color, and avoid competing statement pieces. Make sure the fit of your top and bottom balances (for example, a relaxed top works well with a cleaner, more structured bottom).\n\n**Weather check:** ${temp}${condition ? `, ${condition}` : ""}. **Season:** ${season}. **Local time:** ${localTime}.`;
  reply += `\n\n*This no-key starter mode uses wardrobe rules rather than a hosted generative AI model. Add an AI provider later to enable open-ended conversational styling and automatic image recognition.*`;
  return reply;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message ?? "").trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: "Please enter a message under 4,000 characters." }, { status: 400 });
    const closet = Array.isArray(body.closet) ? body.closet.slice(0, 150) : [];
    const weather = body.weather ?? null;
    const season = String(body.season ?? "unknown");
    const localTime = String(body.localTime ?? "unknown");
    const style = String(body.style ?? "personal style");

    // Zero-configuration mode: the app still works when no API key is supplied.
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reply: localStylist(message, closet, weather, season, localTime, style), mode: "built-in-stylist" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `You are FORME, an exceptionally thoughtful personal fashion stylist. Style the user using their actual wardrobe. Never claim they own items not listed. Clearly label missing pieces as shopping suggestions. Explain color harmony, proportions, layering, shoes and accessories. Adapt to occasion, dress code, comfort, budget and taste. Consider the supplied weather and season; never invent weather. Local time: ${localTime}. Season: ${season}. Style direction: ${style}. Weather: ${JSON.stringify(weather)}. Closet: ${JSON.stringify(closet)}. Give one strongest recommendation first and concise alternatives when useful.`,
      input: message,
    });
    return NextResponse.json({ reply: response.output_text || "I couldn't put together a response. Try asking another way.", mode: "ai" });
  } catch (error) {
    console.error("/api/chat error", error);
    return NextResponse.json({ error: "The stylist is having trouble right now. Please try again." }, { status: 500 });
  }
}
