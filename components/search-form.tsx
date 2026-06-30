"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

export function SearchForm() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q || loading) return;
    setLoading(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: q }),
    });
    const data = await res.json();
    router.push(`/search/${data.search_id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search any topic..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          disabled={loading}
          className="pl-9 h-11 bg-white/5 border-white/10 focus:border-primary/60 focus:ring-primary/20 transition-colors duration-150"
          autoFocus
        />
      </div>
      <Button
        type="submit"
        disabled={loading || !keyword.trim()}
        className="h-11 px-5 bg-primary hover:bg-primary/90 text-white font-medium cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
      </Button>
    </form>
  );
}
