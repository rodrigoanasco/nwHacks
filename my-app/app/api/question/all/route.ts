import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import {COLLECTIONS} from "@/lib/db/collections";

export async function GET(req: Request) {

  const db = await getDb();

  const questionBank = await db
  .collection(COLLECTIONS.QUESTIONS)
  .find({},
    {
        projection: {
            _id: 0,
            name: 1,
            difficulty: 1,
        }
    }
  )
  .toArray();

  return NextResponse.json({questionBank})
    
}