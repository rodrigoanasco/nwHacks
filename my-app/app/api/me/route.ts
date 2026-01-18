import { NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function GET() {
  const { isAuthenticated, getUser } = getKindeServerSession();

  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({
      authenticated: false,
      userId: "default",
      email: null,
      name: "Guest",
    });
  }

  const user = await getUser();

  const name =
    user?.given_name ||
    user?.family_name ||
    user?.email ||
    "User";

  return NextResponse.json({
    authenticated: true,
    userId: user?.id,
    email: user?.email ?? null,
    name,
  });
}