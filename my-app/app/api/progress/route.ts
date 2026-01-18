import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

export async function GET() {
    const db = await getDb();

    const { isAuthenticated, getUser } = getKindeServerSession();
    const authed = await isAuthenticated();

    // 1) Default progress if not logged in
    if (!authed) {
        const defaultDoc = await db.collection(COLLECTIONS.USER_PROGRESS).findOne(
            { userId: "default" },
            { projection: { _id: 0, userId: 1, questions: 1 } }
        );

        return NextResponse.json({
            userId: "default",
            questions: defaultDoc?.questions ?? [],
        });
    }

    // 2) Logged in: get Kinde user id
    const user = await getUser();
    const userId = user?.id;

    if (!userId) {
        return NextResponse.json({ error: "Missing Kinde user id" }, { status: 401 });
    }

    // 3) Fetch user's progress doc
    const userDoc = await db.collection(COLLECTIONS.USER_PROGRESS).findOne(
        { userId },
        { projection: { _id: 0, userId: 1, questions: 1 } }
    );

    return NextResponse.json({
        userId,
        questions: userDoc?.questions ?? [],
    });
}
