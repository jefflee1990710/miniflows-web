# MiniFlows Timeline Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app where users search a keyword and get results presented as an AI-generated chronological timeline.

**Architecture:** User submits keyword → API creates a MongoDB doc and returns `search_id` → frontend opens SSE stream → LangChain.js pipeline: AI plans 4–6 search angles, runs parallel Gemini-grounded web searches, AI extracts real event dates per result, aggregates into sorted timeline → streams to frontend, caches in MongoDB.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · LangChain.js (`@langchain/google-vertexai`) · Gemini 2.0 Flash with Google Search grounding · MongoDB (driver: `mongodb`) · Zod · shadcn/ui · Tailwind CSS

## Global Constraints

- Node.js 20+ required (for native `fetch` and `ReadableStream`)
- All LLM calls use `gemini-2.0-flash` model via Vertex AI
- Google credentials loaded from `GOOGLE_SERVICE_ACCOUNT_JSON` env var (full JSON string)
- MongoDB: URI from `MONGODB_URI`, db name from `MONGODB_DB` (value: `miniflows-db`)
- SSE route must set `Cache-Control: no-cache` and `Connection: keep-alive`
- Cache rule: re-use existing `searches` doc if `status=done` and `created_at > now-24h` for same keyword (case-insensitive)
- Timeline sorted ascending by event date (oldest first)
- No user auth — searches are anonymous

---

## File Map

```
app/
  layout.tsx                              — Root layout with global styles
  page.tsx                                — Home: search form + recent history
  search/[id]/page.tsx                    — Timeline page (SSE client)
  api/search/route.ts                     — POST /api/search
  api/search/[id]/stream/route.ts         — GET SSE stream

lib/
  mongodb.ts                              — Singleton MongoDB client
  models/search.ts                        — TypeScript types + collection helpers
  agents/
    gemini.ts                             — Shared Gemini model factory
    angle-planner.ts                      — AI determines search angles
    search-agent.ts                       — Subagent: grounded web search for one angle
    date-extractor.ts                     — AI extracts real event date per result
    pipeline.ts                           — Orchestrates full search pipeline

components/
  search-form.tsx                         — Controlled search input
  search-progress.tsx                     — Live angle status list (SSE-fed)
  timeline-view.tsx                       — Vertical timeline nodes
```

---

## Task 1: Bootstrap Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `.env.local`

**Interfaces:**
- Produces: running dev server at `localhost:3000`

- [ ] **Step 1: Scaffold Next.js**

```bash
cd /Users/jefflee/Projects/MiniFlows/miniflows-web
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --eslint \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

Expected: files created, no errors.

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  @langchain/google-vertexai \
  @langchain/core \
  mongodb \
  zod
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input card badge
```

- [ ] **Step 4: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
MONGODB_URI=mongodb+srv://novahradmin:P%40ssw0rd2%4024@novahr-saas-v2.vd0pf94.mongodb.net/
MONGODB_DB=miniflows-db
GOOGLE_SERVICE_ACCOUNT_JSON=PASTE_FULL_JSON_HERE
EOF
```

Replace `PASTE_FULL_JSON_HERE` with the contents of `/Users/jefflee/Projects/Mentalok/mentalok-edu-company-website/mentalok2-3cb02183b8c5.json` (minified to one line).

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: `ready - started server on localhost:3000`. Open browser → should see default Next.js page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with deps and shadcn/ui"
```

---

## Task 2: MongoDB Connection + Types

**Files:**
- Create: `lib/mongodb.ts`
- Create: `lib/models/search.ts`

**Interfaces:**
- Produces:
  - `getDb(): Promise<Db>` from `lib/mongodb.ts`
  - `SearchDoc`, `TimelineEntry`, `SearchHistoryDoc` types from `lib/models/search.ts`
  - `getSearchesCol(): Promise<Collection<SearchDoc>>`
  - `getHistoryCol(): Promise<Collection<SearchHistoryDoc>>`

- [ ] **Step 1: Write `lib/mongodb.ts`**

```typescript
// lib/mongodb.ts
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
const dbName = process.env.MONGODB_DB!;

let client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db(dbName);
}
```

- [ ] **Step 2: Write `lib/models/search.ts`**

```typescript
// lib/models/search.ts
import { ObjectId, Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";

export interface TimelineEntry {
  date: Date;
  dateLabel: string;
  dateConfidence: "exact" | "approximate" | "unknown";
  title: string;
  summary: string;
  url: string;
  angle: string;
}

export interface SearchDoc {
  _id?: ObjectId;
  keyword: string;
  status: "pending" | "searching" | "done" | "error";
  angles: string[];
  timeline: TimelineEntry[];
  created_at: Date;
  completed_at?: Date;
  error?: string;
}

export interface SearchHistoryDoc {
  _id?: ObjectId;
  keyword: string;
  search_id: ObjectId;
  created_at: Date;
}

export async function getSearchesCol(): Promise<Collection<SearchDoc>> {
  const db = await getDb();
  return db.collection<SearchDoc>("searches");
}

export async function getHistoryCol(): Promise<Collection<SearchHistoryDoc>> {
  const db = await getDb();
  return db.collection<SearchHistoryDoc>("search_history");
}

export async function findCachedSearch(keyword: string): Promise<SearchDoc | null> {
  const col = await getSearchesCol();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return col.findOne({
    keyword: { $regex: new RegExp(`^${keyword}$`, "i") },
    status: "done",
    created_at: { $gte: cutoff },
  });
}
```

- [ ] **Step 3: Run a quick connection check**

Create and run `lib/models/search.test.ts` locally only (delete after):

```typescript
// temporary check — run with: npx tsx lib/models/search.test.ts
import { getDb } from "./mongodb";

async function check() {
  const db = await getDb();
  const collections = await db.listCollections().toArray();
  console.log("Connected to:", db.databaseName);
  console.log("Collections:", collections.map(c => c.name));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
```

```bash
npx tsx lib/models/search.test.ts
```

Expected: prints `Connected to: miniflows-db` with no errors. Delete this file after.

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add MongoDB client and search types"
```

---

## Task 3: Gemini Client + Angle Planner

**Files:**
- Create: `lib/agents/gemini.ts`
- Create: `lib/agents/angle-planner.ts`

**Interfaces:**
- Consumes: `GOOGLE_SERVICE_ACCOUNT_JSON` env var
- Produces:
  - `getGeminiModel(): ChatVertexAI` from `lib/agents/gemini.ts`
  - `getGeminiModelWithSearch(): Runnable` from `lib/agents/gemini.ts`
  - `planAngles(keyword: string): Promise<string[]>` from `lib/agents/angle-planner.ts`

- [ ] **Step 1: Write `lib/agents/gemini.ts`**

```typescript
// lib/agents/gemini.ts
import { ChatVertexAI } from "@langchain/google-vertexai";

let _model: ChatVertexAI | null = null;

function credentials() {
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
}

export function getGeminiModel(): ChatVertexAI {
  if (!_model) {
    const creds = credentials();
    _model = new ChatVertexAI({
      model: "gemini-2.0-flash",
      location: "us-central1",
      authOptions: {
        credentials: creds,
        projectId: creds.project_id,
      },
      maxOutputTokens: 2048,
    });
  }
  return _model;
}

export function getGeminiModelWithSearch() {
  const model = getGeminiModel();
  // ponytail: google_search is the Gemini 2.0 grounding tool name
  return model.bind({ tools: [{ google_search: {} }] });
}
```

- [ ] **Step 2: Write `lib/agents/angle-planner.ts`**

```typescript
// lib/agents/angle-planner.ts
import { z } from "zod";
import { getGeminiModel } from "./gemini";

const Schema = z.object({
  angles: z.array(z.string()).min(4).max(6),
});

export async function planAngles(keyword: string): Promise<string[]> {
  const model = getGeminiModel();
  const structured = model.withStructuredOutput(Schema);

  const result = await structured.invoke([
    {
      role: "user",
      content: `You are a research strategist. Given the search keyword "${keyword}", return 4-6 distinct research angles to comprehensively cover the topic. Each angle should be a short phrase like "historical origins", "social impact", "technical details", "criticism and controversy", "recent developments", "geographic spread". Make the angles specific to "${keyword}".`,
    },
  ]);

  return result.angles;
}

// Self-check: npx tsx lib/agents/angle-planner.ts
if (process.argv[1]?.endsWith("angle-planner.ts")) {
  planAngles("Bitcoin")
    .then(angles => { console.log("Angles:", angles); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 3: Run self-check**

```bash
npx tsx lib/agents/angle-planner.ts
```

Expected: prints 4–6 strings about Bitcoin, exits 0.

- [ ] **Step 4: Commit**

```bash
git add lib/agents/
git commit -m "feat: add Gemini client and angle planner"
```

---

## Task 4: Search Subagent

**Files:**
- Create: `lib/agents/search-agent.ts`

**Interfaces:**
- Consumes: `getGeminiModelWithSearch()` from `lib/agents/gemini.ts`
- Produces:
  ```typescript
  interface RawResult {
    title: string;
    url: string;
    snippet: string;
    angle: string;
    rawContent: string;
  }
  searchAngle(keyword: string, angle: string): Promise<RawResult[]>
  ```

- [ ] **Step 1: Write `lib/agents/search-agent.ts`**

```typescript
// lib/agents/search-agent.ts
import { getGeminiModelWithSearch } from "./gemini";

export interface RawResult {
  title: string;
  url: string;
  snippet: string;
  angle: string;
  rawContent: string;
}

export async function searchAngle(keyword: string, angle: string): Promise<RawResult[]> {
  const model = getGeminiModelWithSearch();

  const response = await model.invoke([
    {
      role: "user",
      content: `Research the topic "${keyword}" from the angle of "${angle}". Find key facts, events, and developments with specific dates. Summarize your findings.`,
    },
  ]);

  const rawContent = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  // Extract grounding metadata (sources from Google Search)
  const meta = (response as any).response_metadata;
  const chunks: Array<{ web?: { title?: string; uri?: string; snippet?: string } }> =
    meta?.groundingMetadata?.groundingChunks ?? [];

  if (chunks.length === 0) {
    // ponytail: fallback — no grounding sources, return raw content as single result
    return [{
      title: `${angle} — ${keyword}`,
      url: "",
      snippet: rawContent.slice(0, 500),
      angle,
      rawContent,
    }];
  }

  return chunks.map((c) => ({
    title: c.web?.title ?? `${angle} source`,
    url: c.web?.uri ?? "",
    snippet: c.web?.snippet ?? rawContent.slice(0, 300),
    angle,
    rawContent,
  }));
}

// Self-check: npx tsx lib/agents/search-agent.ts
if (process.argv[1]?.endsWith("search-agent.ts")) {
  searchAngle("Bitcoin", "historical origins")
    .then(r => { console.log(`Got ${r.length} results`); console.log(r[0]); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Run self-check**

```bash
npx tsx lib/agents/search-agent.ts
```

Expected: prints result count and first result object, exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/search-agent.ts
git commit -m "feat: add Gemini grounded search subagent"
```

---

## Task 5: Date Extractor

**Files:**
- Create: `lib/agents/date-extractor.ts`

**Interfaces:**
- Consumes: `RawResult` from `lib/agents/search-agent.ts`, `TimelineEntry` from `lib/models/search.ts`
- Produces:
  - `extractDate(item: RawResult): Promise<TimelineEntry | null>`

- [ ] **Step 1: Write `lib/agents/date-extractor.ts`**

```typescript
// lib/agents/date-extractor.ts
import { z } from "zod";
import { getGeminiModel } from "./gemini";
import type { RawResult } from "./search-agent";
import type { TimelineEntry } from "@/lib/models/search";

const Schema = z.object({
  date: z.string().nullable().describe("ISO date: YYYY-MM-DD, YYYY-MM, or YYYY. Null if truly unknown."),
  dateLabel: z.string().describe("Human readable, e.g. 'January 2009' or 'circa 2003'"),
  confidence: z.enum(["exact", "approximate", "unknown"]),
  title: z.string().describe("Short event title (max 10 words)"),
  summary: z.string().describe("1-2 sentence summary of what happened"),
});

export async function extractDate(item: RawResult): Promise<TimelineEntry | null> {
  if (!item.title && !item.snippet) return null;

  const model = getGeminiModel();
  const structured = model.withStructuredOutput(Schema);

  const result = await structured.invoke([
    {
      role: "user",
      content: `Extract the real date when this event HAPPENED (not when the article was published).

Title: ${item.title}
Content: ${item.snippet}
Additional context: ${item.rawContent.slice(0, 800)}

Focus on WHEN the described event or development actually occurred.`,
    },
  ]);

  if (result.confidence === "unknown") return null;

  const parsed = result.date ? new Date(result.date) : null;
  if (!parsed || isNaN(parsed.getTime())) return null;

  return {
    date: parsed,
    dateLabel: result.dateLabel,
    dateConfidence: result.confidence,
    title: result.title,
    summary: result.summary,
    url: item.url,
    angle: item.angle,
  };
}

// Self-check: npx tsx lib/agents/date-extractor.ts
if (process.argv[1]?.endsWith("date-extractor.ts")) {
  const sample = {
    title: "Satoshi Nakamoto publishes Bitcoin whitepaper",
    url: "https://example.com",
    snippet: "In October 2008, Satoshi Nakamoto published the Bitcoin whitepaper...",
    angle: "historical origins",
    rawContent: "Bitcoin was created in 2008 by the pseudonymous Satoshi Nakamoto.",
  };
  extractDate(sample)
    .then(r => { console.log("Entry:", r); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Run self-check**

```bash
npx tsx lib/agents/date-extractor.ts
```

Expected: prints a `TimelineEntry` with `date` near 2008-10-XX, exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/agents/date-extractor.ts
git commit -m "feat: add AI date extractor"
```

---

## Task 6: Pipeline Orchestrator

**Files:**
- Create: `lib/agents/pipeline.ts`

**Interfaces:**
- Consumes: `planAngles`, `searchAngle`, `extractDate`, `getSearchesCol`
- Produces:
  ```typescript
  type ProgressEvent =
    | { type: "planning" }
    | { type: "angles"; angles: string[] }
    | { type: "searching"; angle: string }
    | { type: "angle_done"; angle: string }
    | { type: "extracting" }
    | { type: "done"; timeline: TimelineEntry[] }
    | { type: "error"; message: string }

  runPipeline(
    searchId: string,
    keyword: string,
    onProgress: (event: ProgressEvent) => void
  ): Promise<TimelineEntry[]>
  ```

- [ ] **Step 1: Write `lib/agents/pipeline.ts`**

```typescript
// lib/agents/pipeline.ts
import { ObjectId } from "mongodb";
import { planAngles } from "./angle-planner";
import { searchAngle } from "./search-agent";
import { extractDate } from "./date-extractor";
import { getSearchesCol } from "@/lib/models/search";
import type { TimelineEntry } from "@/lib/models/search";

export type ProgressEvent =
  | { type: "planning" }
  | { type: "angles"; angles: string[] }
  | { type: "searching"; angle: string }
  | { type: "angle_done"; angle: string }
  | { type: "extracting" }
  | { type: "done"; timeline: TimelineEntry[] }
  | { type: "error"; message: string };

export async function runPipeline(
  searchId: string,
  keyword: string,
  onProgress: (event: ProgressEvent) => void
): Promise<TimelineEntry[]> {
  const col = await getSearchesCol();
  const oid = new ObjectId(searchId);

  try {
    // 1. Plan angles
    onProgress({ type: "planning" });
    const angles = await planAngles(keyword);
    onProgress({ type: "angles", angles });

    await col.updateOne({ _id: oid }, {
      $set: { status: "searching", angles },
    });

    // 2. Search all angles in parallel
    const rawBatches = await Promise.all(
      angles.map(async (angle) => {
        onProgress({ type: "searching", angle });
        const results = await searchAngle(keyword, angle);
        onProgress({ type: "angle_done", angle });
        return results;
      })
    );

    // 3. Deduplicate by URL
    const seen = new Set<string>();
    const unique = rawBatches.flat().filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    // 4. Extract dates in parallel
    onProgress({ type: "extracting" });
    const entries = await Promise.all(unique.map(extractDate));

    // 5. Filter nulls, sort ascending
    const timeline = entries
      .filter((e): e is TimelineEntry => e !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // 6. Persist
    await col.updateOne({ _id: oid }, {
      $set: { status: "done", timeline, completed_at: new Date() },
    });

    onProgress({ type: "done", timeline });
    return timeline;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await col.updateOne({ _id: oid }, { $set: { status: "error", error: message } });
    onProgress({ type: "error", message });
    throw err;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agents/pipeline.ts
git commit -m "feat: add pipeline orchestrator"
```

---

## Task 7: POST /api/search Route

**Files:**
- Create: `app/api/search/route.ts`

**Interfaces:**
- Consumes: `getSearchesCol`, `getHistoryCol`, `findCachedSearch` from `lib/models/search.ts`
- Produces:
  - `POST /api/search` with body `{ keyword: string }` → `{ search_id: string }` (200) or `{ error: string }` (400/500)

- [ ] **Step 1: Write `app/api/search/route.ts`**

```typescript
// app/api/search/route.ts
import { NextResponse } from "next/server";
import { getSearchesCol, getHistoryCol, findCachedSearch } from "@/lib/models/search";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const keyword = body?.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  // Check cache
  const cached = await findCachedSearch(keyword);
  if (cached) {
    return NextResponse.json({ search_id: cached._id!.toString() });
  }

  // Create new search doc
  const col = await getSearchesCol();
  const result = await col.insertOne({
    keyword,
    status: "pending",
    angles: [],
    timeline: [],
    created_at: new Date(),
  });

  // Record in history
  const history = await getHistoryCol();
  await history.insertOne({
    keyword,
    search_id: result.insertedId,
    created_at: new Date(),
  });

  return NextResponse.json({ search_id: result.insertedId.toString() });
}
```

- [ ] **Step 2: Test with curl**

```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"test"}'
```

Expected: `{"search_id":"<some-objectid>"}`, no errors in server logs.

- [ ] **Step 3: Commit**

```bash
git add app/api/search/route.ts
git commit -m "feat: add POST /api/search route"
```

---

## Task 8: GET /api/search/[id]/stream SSE Route

**Files:**
- Create: `app/api/search/[id]/stream/route.ts`

**Interfaces:**
- Consumes: `runPipeline` from `lib/agents/pipeline.ts`, `getSearchesCol`, `findCachedSearch` from `lib/models/search.ts`
- Produces: SSE stream at `GET /api/search/[id]/stream`
  - Event types (all as `data: <JSON>\n\n`): `planning`, `angles`, `searching`, `angle_done`, `extracting`, `done`, `error`
  - `done` event data: `{ timeline: TimelineEntry[] }`

- [ ] **Step 1: Write `app/api/search/[id]/stream/route.ts`**

```typescript
// app/api/search/[id]/stream/route.ts
import { getSearchesCol, findCachedSearch } from "@/lib/models/search";
import { runPipeline, type ProgressEvent } from "@/lib/agents/pipeline";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        // Look up the search doc
        const col = await getSearchesCol();
        const doc = await col.findOne({ _id: new ObjectId(id) });
        if (!doc) {
          send({ type: "error", message: "Search not found" });
          controller.close();
          return;
        }

        // If already done, stream cached result
        if (doc.status === "done") {
          send({ type: "done", timeline: doc.timeline });
          controller.close();
          return;
        }

        // Run pipeline
        await runPipeline(id, doc.keyword, send);
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Smoke-test SSE route**

With dev server running and a valid `search_id` from Task 7's curl:

```bash
curl -N http://localhost:3000/api/search/<YOUR_SEARCH_ID>/stream
```

Expected: stream of `data: {"type":"planning"}` etc., ending with `data: {"type":"done","timeline":[...]}`. May take 30–60s for a real keyword.

- [ ] **Step 3: Commit**

```bash
git add app/api/search/
git commit -m "feat: add SSE stream route for search pipeline"
```

---

## Task 9: Home Page

**Files:**
- Create: `components/search-form.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/search` API
- Produces: page that submits keyword → redirects to `/search/[id]`

- [ ] **Step 1: Write `components/search-form.tsx`**

```tsx
// components/search-form.tsx
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
```

- [ ] **Step 2: Write `app/page.tsx`**

```tsx
// app/page.tsx
import { SearchForm } from "@/components/search-form";
import { getHistoryCol } from "@/lib/models/search";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getRecentHistory() {
  const col = await getHistoryCol();
  return col
    .find({})
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
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
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000`. Should see "MiniFlows" title, search input, and recent history list. Type "test" and press Enter — should navigate to `/search/<id>` (page 404 is fine, we build it next).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/search-form.tsx
git commit -m "feat: add home page with search form and history"
```

---

## Task 10: Timeline Page

**Files:**
- Create: `components/search-progress.tsx`
- Create: `components/timeline-view.tsx`
- Create: `app/search/[id]/page.tsx`

**Interfaces:**
- Consumes: SSE stream from `GET /api/search/[id]/stream`
- Produces: page that shows live angle progress then renders vertical timeline

- [ ] **Step 1: Write `components/search-progress.tsx`**

```tsx
// components/search-progress.tsx
import { Badge } from "@/components/ui/badge";

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
```

- [ ] **Step 2: Write `components/timeline-view.tsx`**

```tsx
// components/timeline-view.tsx
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
                  {new URL(entry.url).hostname}
                </a>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 3: Write `app/search/[id]/page.tsx`**

```tsx
// app/search/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SearchProgress } from "@/components/search-progress";
import { TimelineView } from "@/components/timeline-view";
import type { TimelineEntry } from "@/lib/models/search";

type Phase = "planning" | "searching" | "extracting" | "done" | "error";

export default function SearchPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>("planning");
  const [angleStatuses, setAngleStatuses] = useState<{ angle: string; done: boolean }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/search/${id}/stream`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "planning") {
        setPhase("planning");
      } else if (event.type === "angles") {
        setAngleStatuses(event.angles.map((a: string) => ({ angle: a, done: false })));
        setPhase("searching");
      } else if (event.type === "angle_done") {
        setAngleStatuses((prev) =>
          prev.map((a) => a.angle === event.angle ? { ...a, done: true } : a)
        );
      } else if (event.type === "extracting") {
        setPhase("extracting");
      } else if (event.type === "done") {
        setTimeline(event.timeline.map((e: TimelineEntry) => ({
          ...e,
          date: new Date(e.date),
        })));
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
    <main className="min-h-screen p-8 max-w-3xl mx-auto space-y-8">
      <a href="/" className="text-sm text-muted-foreground hover:underline">
        ← New search
      </a>

      {phase === "error" && (
        <div className="text-red-500">Error: {error}</div>
      )}

      {(phase === "planning" || phase === "searching" || phase === "extracting") && (
        <SearchProgress
          phase={phase}
          angles={angleStatuses}
        />
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Timeline</h2>
          <TimelineView entries={timeline} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: End-to-end test in browser**

1. Open `http://localhost:3000`
2. Type "Bitcoin" and press Enter
3. Observe: navigates to `/search/<id>`, shows "Analyzing keyword...", then angle progress, then timeline
4. Verify: timeline nodes appear in chronological order with date badges

- [ ] **Step 5: Commit**

```bash
git add app/search/ components/search-progress.tsx components/timeline-view.tsx
git commit -m "feat: add timeline page with SSE progress and timeline view"
```

---

## Self-Review

**Spec coverage:**
- ✓ Keyword search input → `/` home page (Task 9)
- ✓ POST /api/search → create/cache (Task 7)
- ✓ SSE stream (Task 8)
- ✓ AI angle planner 4-6 angles (Task 3)
- ✓ Parallel subagents per angle (Task 4 + pipeline)
- ✓ AI date extraction (Task 5)
- ✓ MongoDB cache (24h, Tasks 7+8)
- ✓ MongoDB search_history (Task 7)
- ✓ Timeline page: progress + timeline display (Task 10)
- ✓ shadcn/ui + Tailwind (Task 1)
- ✓ Env vars documented (Task 1)

**No placeholders found.**

**Type consistency:**
- `TimelineEntry` defined in `lib/models/search.ts`, imported by `date-extractor.ts`, `pipeline.ts`, `timeline-view.tsx`, `search/[id]/page.tsx` ✓
- `RawResult` defined in `search-agent.ts`, imported by `date-extractor.ts` ✓
- `ProgressEvent` defined in `pipeline.ts`, imported by SSE route ✓
- `getSearchesCol`, `getHistoryCol`, `findCachedSearch` from `lib/models/search.ts` used in Tasks 7, 8 ✓
