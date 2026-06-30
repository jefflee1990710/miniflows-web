import { ObjectId } from "mongodb";
import { planAngles } from "./angle-planner";
import { searchAngle } from "./search-agent";
import { extractDate } from "./date-extractor";
import { getSearchesCol } from "@/lib/models/search";
import type { TimelineEntry } from "@/lib/models/search";

export type ProgressEvent =
  | { type: "planning" }
  | { type: "angles"; angles: string[] }
  | { type: "searching"; angle: string }
  | { type: "angle_done"; angle: string }
  | { type: "extracting" }
  | { type: "done"; timeline: TimelineEntry[] }
  | { type: "error"; message: string };

export async function runPipeline(
  searchId: string,
  keyword: string,
  onProgress: (event: ProgressEvent) => void
): Promise<TimelineEntry[]> {
  const col = await getSearchesCol();
  const oid = new ObjectId(searchId);

  try {
    // 1. Plan angles
    onProgress({ type: "planning" });
    const angles = await planAngles(keyword);
    onProgress({ type: "angles", angles });

    await col.updateOne({ _id: oid }, { $set: { status: "searching", angles } });

    // 2. Search all angles in parallel
    const rawBatches = await Promise.all(
      angles.map(async (angle) => {
        onProgress({ type: "searching", angle });
        const results = await searchAngle(keyword, angle);
        onProgress({ type: "angle_done", angle });
        return results;
      })
    );

    // 3. Deduplicate by URL
    const seen = new Set<string>();
    const unique = rawBatches.flat().filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // 4. Extract dates in parallel
    onProgress({ type: "extracting" });
    const entries = await Promise.all(unique.map(extractDate));

    // 5. Filter nulls, dedup by year+title-prefix, sort ascending
    const seenKeys = new Set<string>();
    const timeline = entries
      .filter((e): e is TimelineEntry => {
        if (e === null) return false;
        const titleKey = e.title.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
        const key = `${e.date.getFullYear()}-${titleKey}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // 6. Persist
    await col.updateOne({ _id: oid }, {
      $set: { status: "done", timeline, completed_at: new Date() },
    });

    onProgress({ type: "done", timeline });
    return timeline;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await col.updateOne({ _id: oid }, { $set: { status: "error", error: message } });
    onProgress({ type: "error", message });
    throw err;
  }
}
