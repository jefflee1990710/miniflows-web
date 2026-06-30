"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TimelineEntry } from "@/lib/models/search";

function EntryCard({ entry }: { entry: TimelineEntry }) {
  return (
    <Card className="text-sm">
      <CardContent className="pt-3 pb-3 space-y-1">
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-xs">{entry.dateLabel}</Badge>
        </div>
        <p className="font-medium leading-tight">{entry.title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">{entry.summary}</p>
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline break-all"
          >
            {(() => { try { return new URL(entry.url).hostname; } catch { return entry.url; } })()}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function MergedTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {entries.map((entry, i) => (
        <li key={i} className="ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
            {i + 1}
          </span>
          <div className="space-y-1">
            <Badge variant="secondary" className="text-xs">{entry.angle}</Badge>
            <EntryCard entry={entry} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function BranchingTimeline({ entries }: { entries: TimelineEntry[] }) {
  const angles = [...new Set(entries.map((e) => e.angle))];
  const years = [...new Set(entries.map((e) => e.date.getFullYear()))].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-x-3"
        style={{ gridTemplateColumns: `64px repeat(${angles.length}, minmax(180px, 1fr))` }}
      >
        {/* Header row */}
        <div />
        {angles.map((a) => (
          <div key={a} className="pb-2">
            <Badge variant="secondary" className="text-xs w-full justify-center truncate">{a}</Badge>
          </div>
        ))}

        {/* Year rows */}
        {years.map((year) => (
          <>
            {/* Year label */}
            <div
              key={`year-${year}`}
              className="flex items-start pt-1 text-sm font-semibold text-muted-foreground"
            >
              {year}
            </div>
            {/* Angle columns */}
            {angles.map((angle) => {
              const cell = entries.filter(
                (e) => e.date.getFullYear() === year && e.angle === angle
              );
              return (
                <div key={`${year}-${angle}`} className="space-y-2 pb-4 border-l border-border pl-3">
                  {cell.map((e, i) => (
                    <EntryCard key={i} entry={e} />
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

  if (entries.length === 0) {
    return <p className="text-muted-foreground">No timeline events found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={mode === "merged" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("merged")}
        >
          Merged
        </Button>
        <Button
          variant={mode === "branching" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("branching")}
        >
          Branching
        </Button>
      </div>
      {mode === "merged" ? (
        <MergedTimeline entries={entries} />
      ) : (
        <BranchingTimeline entries={entries} />
      )}
    </div>
  );
}
