import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";

export async function GET() {
  const db = await getDb();
  const collections = await db.listCollections().toArray();
  return NextResponse.json({ ok: true, collections: collections.map(c => c.name) });
}
