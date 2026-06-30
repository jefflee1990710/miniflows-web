"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchForm() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) return;
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <Input
        placeholder="Search anything..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        disabled={loading}
        className="flex-1"
        autoFocus
      />
      <Button type="submit" disabled={loading || !keyword.trim()}>
        {loading ? "..." : "Search"}
      </Button>
    </form>
  );
}
