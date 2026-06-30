"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SearchProgress } from "@/components/search-progress";
import { TimelineView } from "@/components/timeline-view";
import type { TimelineEntry } from "@/lib/models/search";

type Phase = "planning" | "searching" | "extracting" | "done" | "error";

export default function SearchPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("planning");
  const [keyword, setKeyword] = useState<string>("");
  const [angleStatuses, setAngleStatuses] = useState<{ angle: string; done: boolean }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/search/${id}/stream`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "meta") {
        setKeyword(event.keyword ?? "");
      } else if (event.type === "planning") {
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
    <main className="min-h-dvh p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        New search
      </Link>

      {/* Keyword heading */}
      {keyword && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-muted-foreground font-normal text-lg block mb-1">Timeline for</span>
            {keyword}
          </h1>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading progress */}
      {(phase === "planning" || phase === "searching" || phase === "extracting") && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-6">
          <SearchProgress phase={phase} angles={angleStatuses} />
        </div>
      )}

      {/* Timeline */}
      {phase === "done" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {timeline.length} event{timeline.length !== 1 ? "s" : ""} found
          </p>
          <TimelineView entries={timeline} />
        </div>
      )}
    </main>
  );
}
