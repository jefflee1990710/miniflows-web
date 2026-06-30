import { z } from "zod";
import { getGeminiModel } from "./gemini";

const Schema = z.object({
  angles: z.array(z.string()).min(4).max(6),
});

export async function planAngles(keyword: string): Promise<string[]> {
  const model = getGeminiModel();
  const structured = model.withStructuredOutput(Schema);

  const result = await structured.invoke([
    {
      role: "user",
      content: `You are a research strategist. Given the search keyword "${keyword}", return 4-6 distinct research angles to comprehensively cover the topic. Each angle should be a short phrase like "historical origins", "social impact", "technical details", "criticism and controversy", "recent developments", "geographic spread". Make the angles specific to "${keyword}".`,
    },
  ]);

  return result.angles;
}

// Self-check: npx tsx --env-file=.env.local lib/agents/angle-planner.ts
if (process.argv[1]?.endsWith("angle-planner.ts")) {
  planAngles("Bitcoin")
    .then((angles) => { console.log("Angles:", angles); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
