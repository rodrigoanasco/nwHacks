import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS } from "@/lib/db/collections";

export async function POST(req: Request) {
  // 1) Read body
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

  // 2) Load from Mongo (pull needed fields)
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
    return NextResponse.json(
      { error: `Question with name '${name}' not found` },
      { status: 404 }
    );
  }

  const payload = {
    name,
    expectedCompletionTime: doc.expectedCompletionTime ?? null,
    expectedNumOfActions: doc.expectedNumOfActions ?? null,
    objects: Array.isArray(doc.objects) ? doc.objects : [],
  };

  console.log(payload)

  // 3) Forward to convert server
  const convertUrl = process.env.CONVERT_API_URL ?? "http://localhost:8000/convert";

  try {
    const upstreamRes = await fetch(convertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => "");
      return NextResponse.json(
        { error: "Convert server returned error", status: upstreamRes.status, detail: text },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach convert server", detail: String(e?.message ?? e) },
      { status: 502 }
    );
  }

  // 4) Minimal response
  return new NextResponse(null, { status: 204 });
}
