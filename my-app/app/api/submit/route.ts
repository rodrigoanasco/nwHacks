import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import type { UserProgressDoc } from "@/lib/db/types";


export async function POST(req: Request) {
  const { questionName, passed, numberOfActions, timeTaken, score } = await req.json();

  console.log(questionName);
  console.log(passed);
  console.log(numberOfActions);
  console.log(timeTaken);
  console.log(score);

  const db = await getDb();
  const userId = "default";
  const col = db.collection<UserProgressDoc>(COLLECTIONS.USER_PROGRESS);

  // try update existing entry
  const res1 = await col.updateOne(
    { userId, "questions.name": questionName },
    {
      $inc: { "questions.$.attempts": 1 },
      ...(passed ? { $set: { "questions.$.passed": true } } : {}),
    }
  );

  if (res1.matchedCount === 0) {

    // push new entry (upsert user doc)
    await col.updateOne(
      { userId },
      {
        $setOnInsert: { userId },
        $push: {
          questions: { name: questionName, attempts: 1, passed },
        },
      },
      { upsert: true }
    );
  }

  const updated = await col.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, questions: 1 } }
  );

  return NextResponse.json({ ok: true, progress: updated });
}
