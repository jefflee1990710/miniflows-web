"use client";
import { useState } from "react";
import { ExternalLink, GitBranch, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineEntry } from "@/lib/models/search";

const ANGLE_COLORS = [
  "border-pink-500/40 bg-pink-500/10 text-pink-300",
  "border-blue-500/40 bg-blue-500/10 text-blue-300",
  "border-violet-500/40 bg-violet-500/10 text-violet-300",
  "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
];

function useAngleColor(angles: string[]) {
  const map = new Map<string, string>();
  angles.forEach((a, i) => map.set(a, ANGLE_COLORS[i % ANGLE_COLORS.length]));
  return map;
}

function SourceLink({ url }: { url: string }) {
  if (!url) return null;
  let host = url;
  try { host = new URL(url).hostname.replace("www.", ""); } catch { /* noop */ }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors duration-150 cursor-pointer"
    >
      <ExternalLink className="h-3 w-3" />
      {host}
    </a>
  );
}

function AngleBadge({ angle, colorClass }: { angle: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {angle}
    </span>
  );
}

function EntryCard({ entry, colorClass }: { entry: TimelineEntry; colorClass: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-card p-4 space-y-2 hover:border-white/16 transition-colors duration-150">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">{entry.dateLabel}</span>
        <AngleBadge angle={entry.angle} colorClass={colorClass} />
      </div>
      <p className="font-semibold text-sm leading-snug">{entry.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{entry.summary}</p>
      <SourceLink url={entry.url} />
    </div>
  );
}

function MergedTimeline({ entries, colorMap }: { entries: TimelineEntry[]; colorMap: Map<string, string> }) {
  return (
    <ol className="relative space-y-0">
      {entries.map((entry, i) => (
        <li key={i} className="flex gap-4">
          {/* Timeline spine */}
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20 mt-4 shrink-0" />
            {i < entries.length - 1 && (
              <div className="w-px flex-1 bg-white/8 my-1" />
            )}
          </div>
          <div className="pb-6 flex-1 min-w-0">
            <EntryCard entry={entry} colorClass={colorMap.get(entry.angle) ?? ANGLE_COLORS[0]} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function BranchingTimeline({ entries, angles, colorMap }: { entries: TimelineEntry[]; angles: string[]; colorMap: Map<string, string> }) {
  const years = [...new Set(entries.map((e) => e.date.getFullYear()))].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div
        className="grid gap-x-3 min-w-max"
        style={{ gridTemplateColumns: `72px repeat(${angles.length}, minmax(200px, 1fr))` }}
      >
        {/* Header */}
        <div />
        {angles.map((a, i) => (
          <div key={a} className="pb-3 px-1">
            <AngleBadge angle={a} colorClass={colorMap.get(a) ?? ANGLE_COLORS[i]} />
          </div>
        ))}

        {/* Year rows */}
        {years.map((year) => (
          <>
            <div key={`y-${year}`} className="flex items-start pt-3">
              <span className="text-xs font-mono font-semibold text-muted-foreground">{year}</span>
            </div>
            {angles.map((angle, i) => {
              const cell = entries.filter(
                (e) => e.date.getFullYear() === year && e.angle === angle
              );
              const color = colorMap.get(angle) ?? ANGLE_COLORS[i];
              return (
                <div
                  key={`${year}-${angle}`}
                  className="space-y-2 pb-4 border-l border-white/8 pl-3 pt-3"
                >
                  {cell.map((e, j) => (
                    <div key={j} className="rounded-lg border border-white/8 bg-card p-3 space-y-1 text-xs">
                      <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-xs ${color}`}>
                        {e.dateLabel}
                      </span>
                      <p className="font-medium leading-snug">{e.title}</p>
                      <p className="text-muted-foreground leading-relaxed line-clamp-2">{e.summary}</p>
                      <SourceLink url={e.url} />
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

export function TimelineView({ entries }: { entries: TimelineEntry[] }) {
  const [mode, setMode] = useState<"merged" | "branching">("merged");
  const angles = [...new Set(entries.map((e) => e.angle))];
  const colorMap = useAngleColor(angles);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-card p-10 text-center space-y-2">
        <p className="text-muted-foreground text-sm">No timeline events found.</p>
        <p className="text-xs text-muted-foreground/60">Try a different search term.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "merged" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("merged")}
          className="cursor-pointer gap-1.5 h-8"
        >
          <ListOrdered className="h-3.5 w-3.5" />
          Merged
        </Button>
        <Button
          variant={mode === "branching" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("branching")}
          className="cursor-pointer gap-1.5 h-8"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Branching
        </Button>
      </div>

      {mode === "merged" ? (
        <MergedTimeline entries={entries} colorMap={colorMap} />
      ) : (
        <BranchingTimeline entries={entries} angles={angles} colorMap={colorMap} />
      )}
    </div>
  );
}
