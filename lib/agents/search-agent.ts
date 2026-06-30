import { getGeminiModelWithSearch } from "./gemini";

export interface RawResult {
  title: string;
  url: string;
  snippet: string;
  angle: string;
  rawContent: string;
}

export async function searchAngle(keyword: string, angle: string): Promise<RawResult[]> {
  const model = getGeminiModelWithSearch();

  const response = await model.invoke([
    {
      role: "user",
      content: `Research the topic "${keyword}" from the angle of "${angle}". Find key facts, events, and developments with specific dates. Summarize your findings.`,
    },
  ]);

  const rawContent =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Extract grounding metadata (sources from Google Search)
  const meta = (response as any).response_metadata;
  const chunks: Array<{ web?: { title?: string; uri?: string; snippet?: string } }> =
    meta?.groundingMetadata?.groundingChunks ?? [];

  if (chunks.length === 0) {
    // ponytail: fallback — no grounding sources, return synthesized content as single result
    return [
      {
        title: `${angle} — ${keyword}`,
        url: "",
        snippet: rawContent.slice(0, 500),
        angle,
        rawContent,
      },
    ];
  }

  return chunks.map((c) => ({
    title: c.web?.title ?? `${angle} source`,
    url: c.web?.uri ?? "",
    snippet: c.web?.snippet ?? rawContent.slice(0, 300),
    angle,
    rawContent,
  }));
}

// Self-check: env -u GOOGLE_API_KEY npx tsx --env-file=.env.local lib/agents/search-agent.ts
if (process.argv[1]?.endsWith("search-agent.ts")) {
  searchAngle("Bitcoin", "historical origins")
    .then((r) => {
      console.log(`Got ${r.length} results`);
      console.log(r[0]);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
