import { NextResponse } from "next/server";
import { getSearchesCol, getHistoryCol, findCachedSearch } from "@/lib/models/search";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const keyword = body?.keyword?.trim();
  if (!keyword) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const cached = await findCachedSearch(keyword);
  if (cached) {
    return NextResponse.json({ search_id: cached._id!.toString() });
  }

  const col = await getSearchesCol();
  const result = await col.insertOne({
    keyword,
    status: "pending",
    angles: [],
    timeline: [],
    created_at: new Date(),
  });

  const history = await getHistoryCol();
  await history.insertOne({
    keyword,
    search_id: result.insertedId,
    created_at: new Date(),
  });

  return NextResponse.json({ search_id: result.insertedId.toString() });
}
