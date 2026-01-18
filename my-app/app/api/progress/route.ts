import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

type ProgressQuestion = {
  name: string;
  attempts: number;
  passed: boolean;
};

type UserProgressDoc = {
  userId: string;
  userName?: string;
  questions: ProgressQuestion[];
};

async function buildInitialQuestions(db: any): Promise<ProgressQuestion[]> {
  const allQuestions = await db
    .collection(COLLECTIONS.QUESTIONS)
    .find({}, { projection: { _id: 0, name: 1 } })
    .toArray();

  return (allQuestions ?? []).map((q: any) => ({
    name: q.name,
    attempts: 0,
    passed: false,
  }));
}

export async function GET() {
  const db = await getDb();

  const { isAuthenticated, getUser } = getKindeServerSession();
  const authed = await isAuthenticated();

  // Guest / default user
  if (!authed) {
    const defaultDoc = await db
      .collection<UserProgressDoc>(COLLECTIONS.USER_PROGRESS)
      .findOne({ userId: "default" }, { projection: { _id: 0, userId: 1, questions: 1 } });

    return NextResponse.json({
      userId: "default",
      questions: defaultDoc?.questions ?? [],
    });
  }

  // Logged in user
  const user = await getUser();
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Missing Kinde user id" }, { status: 401 });
  }

  const userName =
    [user?.given_name, user?.family_name].filter(Boolean).join(" ") ||
    user?.email ||
    "User";

  const progressCol = db.collection<UserProgressDoc>(COLLECTIONS.USER_PROGRESS);

  // Try fetch existing
  let doc = await progressCol.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, questions: 1 } }
  );

  // If missing, create initialized doc
  if (!doc) {
    const questionsInit = await buildInitialQuestions(db);

    await progressCol.insertOne({
      userId,
      userName,
      questions: questionsInit,
    });

    doc = await progressCol.findOne(
      { userId },
      { projection: { _id: 0, userId: 1, questions: 1 } }
    );
  }

  return NextResponse.json({
    userId,
    questions: doc?.questions ?? [],
  });
}
