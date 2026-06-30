interface AngleStatus {
  angle: string;
  done: boolean;
}

interface Props {
  phase: "planning" | "searching" | "extracting";
  angles: AngleStatus[];
}

export function SearchProgress({ phase, angles }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {phase === "planning" && "Analyzing keyword..."}
        {phase === "searching" && "Searching from multiple angles..."}
        {phase === "extracting" && "Extracting event dates..."}
      </p>
      {angles.length > 0 && (
        <ul className="space-y-1">
          {angles.map((a) => (
            <li key={a.angle} className="flex items-center gap-2 text-sm">
              <span>{a.done ? "✓" : "⏳"}</span>
              <span className={a.done ? "text-foreground" : "text-muted-foreground"}>
                {a.angle}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
