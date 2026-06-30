import { SearchForm } from "@/components/search-form";
import { getHistoryCol } from "@/lib/models/search";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getRecentHistory() {
  const col = await getHistoryCol();
  return col.find({}).sort({ created_at: -1 }).limit(8).toArray();
}

export default async function HomePage() {
  const history = await getRecentHistory();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-10 p-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-muted-foreground mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Powered by Gemini · LangChain
        </div>
        <h1 className="text-5xl font-bold tracking-tight glow-pink">
          Mini<span className="text-primary">Flows</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
          Enter any topic. AI searches from multiple angles and builds you a chronological timeline.
        </p>
      </div>

      {/* Search */}
      <div className="w-full max-w-xl space-y-3">
        <SearchForm />
        <p className="text-center text-xs text-muted-foreground">
          Try: Bitcoin history · Climate change · Space exploration
        </p>
      </div>

      {/* Recent searches */}
      {history.length > 0 && (
        <div className="w-full max-w-xl">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">
            Recent searches
          </p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <Link
                key={h._id!.toString()}
                href={`/search/${h.search_id.toString()}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
              >
                {h.keyword}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
