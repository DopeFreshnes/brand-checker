import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "No name provided." },
        { status: 400 }
      );
    }

    // Forward request to Python backend
    const response = await fetch(`${BACKEND_URL}/api/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend error ${response.status}: ${errorText}`);
      return NextResponse.json(
        {
          success: false,
          error: "Backend service unavailable",
        },
        { status: response.status || 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Error in /api/check:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
