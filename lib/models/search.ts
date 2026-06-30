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
