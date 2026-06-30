import { SearchForm } from "@/components/search-form";
import { getHistoryCol } from "@/lib/models/search";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getRecentHistory() {
  const col = await getHistoryCol();
  return col.find({}).sort({ created_at: -1 }).limit(10).toArray();
}

export default async function HomePage() {
  const history = await getRecentHistory();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">MiniFlows</h1>
        <p className="text-muted-foreground">AI-powered timeline search</p>
      </div>
      <SearchForm />
      {history.length > 0 && (
        <div className="w-full max-w-xl">
          <p className="text-sm text-muted-foreground mb-2">Recent searches</p>
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h._id!.toString()}>
                <Link
                  href={`/search/${h.search_id.toString()}`}
                  className="text-sm hover:underline"
                >
                  {h.keyword}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
