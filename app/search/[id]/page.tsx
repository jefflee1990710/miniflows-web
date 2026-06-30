"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SearchProgress } from "@/components/search-progress";
import { TimelineView } from "@/components/timeline-view";
import type { TimelineEntry } from "@/lib/models/search";

type Phase = "planning" | "searching" | "extracting" | "done" | "error";

export default function SearchPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("planning");
  const [angleStatuses, setAngleStatuses] = useState<{ angle: string; done: boolean }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/search/${id}/stream`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "planning") {
        setPhase("planning");
      } else if (event.type === "angles") {
        setAngleStatuses(event.angles.map((a: string) => ({ angle: a, done: false })));
        setPhase("searching");
      } else if (event.type === "angle_done") {
        setAngleStatuses((prev) =>
          prev.map((a) => (a.angle === event.angle ? { ...a, done: true } : a))
        );
      } else if (event.type === "extracting") {
        setPhase("extracting");
      } else if (event.type === "done") {
        setTimeline(
          event.timeline.map((e: TimelineEntry) => ({ ...e, date: new Date(e.date) }))
        );
        setPhase("done");
        es.close();
      } else if (event.type === "error") {
        setError(event.message);
        setPhase("error");
        es.close();
      }
    };

    es.onerror = () => {
      setError("Connection lost");
      setPhase("error");
      es.close();
    };

    return () => es.close();
  }, [id]);

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto space-y-8">
      <a href="/" className="text-sm text-muted-foreground hover:underline">
        ← New search
      </a>

      {phase === "error" && (
        <div className="text-red-500">Error: {error}</div>
      )}

      {(phase === "planning" || phase === "searching" || phase === "extracting") && (
        <SearchProgress phase={phase} angles={angleStatuses} />
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Timeline</h2>
          <TimelineView entries={timeline} />
        </div>
      )}
    </main>
  );
}
