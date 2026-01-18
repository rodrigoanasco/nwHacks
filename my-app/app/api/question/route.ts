import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { COLLECTIONS} from "@/lib/db/collections";

export async function GET(req: Request) {
  // 1) Read body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // 2) Load from Mongo
  const db = await getDb();

  const doc = await db.collection(COLLECTIONS.QUESTIONS).findOne(
    { name },
    { projection: { _id: 0, objects: 1 } }
  );

  if (!doc) {
    return NextResponse.json(
      { error: `Question with name '${name}' not found` },
      { status: 404 }
    );
  }

  const payload = { objects: Array.isArray(doc.objects) ? doc.objects : [] };

  // 3) Forward to convert server
  const convertUrl = process.env.CONVERT_API_URL ?? "http://localhost:8000/convert";

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(convertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Failed to reach convert server", detail: String(e?.message ?? e) },
      { status: 502 }
    );
  }

  // 4) Pass through response (best effort)
  const contentType = upstreamRes.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await upstreamRes.json().catch(() => null);
    return NextResponse.json(data ?? { error: "Convert server returned invalid JSON" }, {
      status: upstreamRes.status,
    });
  } else {
    const text = await upstreamRes.text().catch(() => "");
    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: { "content-type": contentType || "text/plain" },
    });
  }
}
