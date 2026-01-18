import type { Db } from "mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

export async function resetDefaultUserProgress(db: Db) {
    console.log("here called reset")
  return db.collection(COLLECTIONS.USER_PROGRESS).updateOne(
    { userId: "default" },
    {
      $set: {
        "questions.$[].attempts": 0,
        "questions.$[].passed": false,
      },
    }
  );
}
