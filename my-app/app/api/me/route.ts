import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

export async function POST(req: Request) {
  // 1) Parse request
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Question name is required" }, { status: 400 });
  }

  // 2) Get userId from Kinde (or default)
  const { isAuthenticated, getUser } = getKindeServerSession();
  const authed = await isAuthenticated();

  let userId = "default";
  if (authed) {
    const user = await getUser();
    if (user?.id) userId = user.id;
  }

  // 3) Fetch question data
  const db = await getDb();
  const doc = await db.collection(COLLECTIONS.QUESTIONS).findOne(
    { name },
    {
      projection: {
        _id: 0,
        objects: 1,
        expectedCompletionTime: 1,
        expectedNumOfActions: 1,
      },
    }
  );

  if (!doc) {
    return NextResponse.json({ error: `Question '${name}' not found` }, { status: 404 });
  }

  // 4) Build payload for convert server
  const payload = {
    userId,
    expectedCompletionTime: doc.expectedCompletionTime ?? null,
    expectedNumOfActions: doc.expectedNumOfActions ?? null,
    objects: Array.isArray(doc.objects) ? doc.objects : [],
  };

  // 5) Call convert server
  const convertUrl = process.env.CONVERT_API_URL ?? "http://localhost:8000/convert";

  try {
    const upstreamRes = await fetch(convertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      const detail = await upstreamRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Convert server error", status: upstreamRes.status, detail },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach convert server", detail: String(e?.message ?? e) },
      { status: 502 }
    );
  }

  // 6) No response body needed
  return new NextResponse(null, { status: 204 });
}