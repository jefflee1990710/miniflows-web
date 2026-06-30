import { CheckCircle2, Loader2, Sparkles, Globe, CalendarSearch } from "lucide-react";

interface AngleStatus {
  angle: string;
  done: boolean;
}

interface Props {
  phase: "planning" | "searching" | "extracting";
  angles: AngleStatus[];
}

const PHASE_META = {
  planning: { icon: Sparkles, label: "Analyzing topic & planning search angles…" },
  searching: { icon: Globe, label: "Searching the web from multiple angles…" },
  extracting: { icon: CalendarSearch, label: "Extracting event dates from results…" },
};

export function SearchProgress({ phase, angles }: Props) {
  const { icon: PhaseIcon, label } = PHASE_META[phase];

  return (
    <div className="space-y-5">
      {/* Phase indicator */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
          <PhaseIcon className="h-4 w-4 text-primary animate-pulse" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>

      {/* Angle list */}
      {angles.length > 0 && (
        <ul className="space-y-2 pl-1">
          {angles.map((a) => (
            <li key={a.angle} className="flex items-center gap-3 text-sm">
              {a.done ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
              )}
              <span className={a.done ? "text-foreground" : "text-muted-foreground"}>
                {a.angle}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Skeleton shimmer for angles not yet revealed */}
      {angles.length === 0 && phase === "planning" && (
        <div className="space-y-2 pl-1">
          {[120, 96, 140, 108].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-white/8"
              style={{ width: w }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
