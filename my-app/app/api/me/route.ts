import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function GET() {
  const { isAuthenticated, getUser } = getKindeServerSession();

  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await getUser();

  return NextResponse.json({
    authenticated: true,
    userId: user?.id,
    email: user?.email,
  });
}
