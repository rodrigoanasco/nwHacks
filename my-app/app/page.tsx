import { redirect } from "next/navigation";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const userId = "default";

  const userName = "User";

  const db = await getDb();

  const progressCol = db.collection(COLLECTIONS.USER_PROGRESS);

  // 1) Check if user already exists
  let progressDoc = await progressCol.findOne(
    { userId },
    { projection: { _id: 0, userId: 1, userName: 1, questions: 1 } },
  );

  // 2) If not, build default questions from QUESTIONS collection and insert
  if (!progressDoc) {
    const allQuestions = await db
      .collection(COLLECTIONS.QUESTIONS)
      .find({}, { projection: { _id: 0, name: 1 } })
      .toArray();

    const questionsInit = allQuestions.map((q) => ({
      name: q.name,
      attempts: 0,
      passed: false,
    }));

    await progressCol.insertOne({
      userId,
      userName,
      questions: questionsInit,
    });

    // fetch it back (so the page has it in memory if you want to pass it down)
    progressDoc = await progressCol.findOne(
      { userId },
      { projection: { _id: 0, userId: 1, userName: 1, questions: 1 } },
    );
  }

  // now you have progressDoc available

  return <DashboardClient userName={userName} />;
}
