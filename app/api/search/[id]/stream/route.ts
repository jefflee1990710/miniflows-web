import { getSearchesCol } from "@/lib/models/search";
import { runPipeline, type ProgressEvent } from "@/lib/agents/pipeline";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        const col = await getSearchesCol();
        const doc = await col.findOne({ _id: new ObjectId(id) });
        if (!doc) {
          send({ type: "error", message: "Search not found" });
          controller.close();
          return;
        }

        if (doc.status === "done") {
          send({ type: "done", timeline: doc.timeline });
          controller.close();
          return;
        }

        await runPipeline(id, doc.keyword, send);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
          );
        } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
