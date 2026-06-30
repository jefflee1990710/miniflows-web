# MiniFlows Timeline Search — Design Spec
Date: 2026-06-30

## Overview

A Next.js web app that accepts a keyword, dispatches multiple LangChain.js subagents to search the web from AI-determined angles, extracts real event dates from results, and presents everything as a chronological timeline.

---

## Architecture

**Stack:** Next.js (App Router) · LangChain.js · Gemini 2.0 Flash (with Google Search grounding) · MongoDB · shadcn/ui + Tailwind · Vercel

```
Next.js App Router
├── /app/page.tsx                    — Search home page
├── /app/search/[id]/page.tsx        — Timeline results page
├── /app/api/search/route.ts         — POST: create search, return search_id
└── /app/api/search/[id]/stream/route.ts  — GET: SSE stream (progress + results)
```

### Request Flow

1. User submits keyword → `POST /api/search` → creates `searches` doc with `status: "pending"`, returns `search_id`
2. Frontend navigates to `/search/[id]`, opens SSE connection to `/api/search/[id]/stream`
3. API route checks MongoDB cache: if same keyword exists within 24 hours → stream cached results immediately
4. Otherwise: LangChain.js pipeline runs:
   a. **Angle planner** — Gemini analyzes keyword, returns 4–6 search angles (e.g. "historical context", "social impact", "technical development", "criticism", "recent news"); count is dynamic based on topic breadth
   b. **Subagents (parallel)** — one per angle, each runs a Gemini grounded web search with a tailored query
   c. **Date extractor** — for each result, Gemini extracts the real event date from the content (not publish date); falls back to publish date with low confidence label
   d. **Aggregator** — deduplicates by URL, sorts by extracted date ascending
5. Timeline written to MongoDB → SSE pushes final `done` event with full timeline

---

## MongoDB Schema

### `searches` collection

```json
{
  "_id": "ObjectId",
  "keyword": "string",
  "status": "pending | searching | done | error",
  "angles": ["string"],
  "timeline": [
    {
      "date": "Date",
      "dateLabel": "string",
      "dateConfidence": "exact | approximate | unknown",
      "title": "string",
      "summary": "string",
      "url": "string",
      "angle": "string"
    }
  ],
  "created_at": "Date",
  "completed_at": "Date"
}
```

### `search_history` collection

```json
{
  "_id": "ObjectId",
  "keyword": "string",
  "search_id": "ObjectId",
  "created_at": "Date"
}
```

**Cache rule:** Before running agents, query `searches` for matching `keyword` where `status = "done"` and `created_at > now - 24h`. If found, stream that doc's timeline directly.

---

## Frontend UI

### Home page (`/`)

- Centered search input, full-width on mobile
- Submit on Enter or button click
- Below input: recent search history list (last 10, clickable to reopen)

### Timeline page (`/search/[id]`)

**Loading state (SSE streaming):**
```
Analyzing keyword...
🔍 Historical context  ✓
🔍 Social impact       ⏳
🔍 Technical details   ⏳
🔍 Criticism           ⏳
🔍 Recent news         ⏳
```

**Done state — vertical timeline (old → new, top → bottom):**
```
[1995]  Title of event
        Summary text...
        Source: example.com  [historical context]

[2003]  Title of event
        ...
```

Each node: date badge · title · summary · source link · angle tag

**UI implementation:** shadcn/ui components, timeline built with pure CSS (no extra library).

---

## Environment Variables

```
MONGODB_URI=mongodb+srv://novahradmin:...@novahr-saas-v2...
MONGODB_DB=miniflows-db
GOOGLE_SERVICE_ACCOUNT_JSON=<contents of mentalok2-3cb02183b8c5.json>
```

---

## Out of Scope (for now)

- User authentication
- Per-user search isolation
- Real-time collaborative viewing
- Export / share timeline
- Mobile native app
