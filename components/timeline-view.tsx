import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TimelineEntry } from "@/lib/models/search";

export function TimelineView({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground">No timeline events found.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {entries.map((entry, i) => (
        <li key={i} className="ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
            {i + 1}
          </span>
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{entry.dateLabel}</Badge>
                <Badge variant="secondary">{entry.angle}</Badge>
              </div>
              <h3 className="font-semibold">{entry.title}</h3>
              <p className="text-sm text-muted-foreground">{entry.summary}</p>
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
        </li>
      ))}
    </ol>
  );
}
