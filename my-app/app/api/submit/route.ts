import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

type SubmitBody = {
  userId: string;
  questionName: string;
  passed: boolean;
};

export async function POST(req: Request) {
  let body: SubmitBody;

  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = body?.userId?.trim();
  const questionName = body?.questionName?.trim();
  const passed = body?.passed;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!questionName) {
    return NextResponse.json({ error: "questionName is required" }, { status: 400 });
  }
  if (typeof passed !== "boolean") {
    return NextResponse.json({ error: "passed must be boolean" }, { status: 400 });
  }

  const db = await getDb();
  const col = db.collection(COLLECTIONS.USER_PROGRESS);

  // 1) Try update existing question entry
  const updateExisting = await col.updateOne(
    { userId, "questions.name": questionName },
    {
      $inc: { "questions.$.attempts": 1 },
      ...(passed ? { $set: { "questions.$.passed": true } } : {}),
    }
  );

  // If matched, we're done
  if (updateExisting.matchedCount > 0) {
    const updatedDoc = await col.findOne(
      { userId },
      { projection: { _id: 0, userId: 1, questions: 1 } }
    );

    return NextResponse.json({ ok: true, progress: updatedDoc });
  }

  // 2) Otherwise, push new question entry.
  // Also upsert user doc if it doesn't exist.
  await col.updateOne(
    { userId },
    {
      $setOnInsert: { userId, questions: [] },
      $push: {
        questions: {
          name: questionName,
          attempts: 1,
          passed: passed,
        },
      },
    },
    { upsert: true }
  );

  const updatedDoc = await col.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, questions: 1 } }
  );

  return NextResponse.json({ ok: true, progress: updatedDoc });
}
