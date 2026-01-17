import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Simple validation (replace with real authentication)
    if (email === "user@example.com" && password === "password123") {
      return NextResponse.json(
        {
          success: true,
          message: "Login successful",
          user: { email, id: 1, name: "User" },
          token: "fake-jwt-token",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
