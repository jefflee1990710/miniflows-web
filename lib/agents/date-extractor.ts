import { z } from "zod";
import { getGeminiModel } from "./gemini";
import type { RawResult } from "./search-agent";
import type { TimelineEntry } from "@/lib/models/search";

const Schema = z.object({
  date: z.string().nullable().describe("ISO date: YYYY-MM-DD, YYYY-MM, or YYYY. Null if truly unknown."),
  dateLabel: z.string().describe("Human readable, e.g. 'January 2009' or 'circa 2003'"),
  confidence: z.enum(["exact", "approximate", "unknown"]),
  title: z.string().describe("Short event title (max 10 words)"),
  summary: z.string().describe("1-2 sentence summary of what happened"),
});

export async function extractDate(item: RawResult): Promise<TimelineEntry | null> {
  if (!item.title && !item.snippet) return null;

  const model = getGeminiModel();
  const structured = model.withStructuredOutput(Schema);

  const result = await structured.invoke([
    {
      role: "user",
      content: `Extract the real date when this event HAPPENED (not when the article was published).

Title: ${item.title}
Content: ${item.snippet}
Additional context: ${item.rawContent.slice(0, 800)}

Focus on WHEN the described event or development actually occurred.`,
    },
  ]);

  if (result.confidence === "unknown") return null;

  const parsed = result.date ? new Date(result.date) : null;
  if (!parsed || isNaN(parsed.getTime())) return null;

  return {
    date: parsed,
    dateLabel: result.dateLabel,
    dateConfidence: result.confidence,
    title: result.title,
    summary: result.summary,
    url: item.url,
    angle: item.angle,
  };
}

// Self-check: env -u GOOGLE_API_KEY npx tsx --env-file=.env.local lib/agents/date-extractor.ts
if (process.argv[1]?.endsWith("date-extractor.ts")) {
  const sample: RawResult = {
    title: "Satoshi Nakamoto publishes Bitcoin whitepaper",
    url: "https://example.com",
    snippet: "In October 2008, Satoshi Nakamoto published the Bitcoin whitepaper...",
    angle: "historical origins",
    rawContent: "Bitcoin was created in October 2008 by the pseudonymous Satoshi Nakamoto who published the whitepaper.",
  };
  extractDate(sample)
    .then((r) => {
      console.log("Entry:", r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
