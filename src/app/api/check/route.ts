import { NextRequest, NextResponse } from "next/server";
import { getDemoResults } from "../../../lib/checkers";

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

    const results = await getDemoResults(name);

    return NextResponse.json(
      {
        success: true,
        results,
      },
      { status: 200 }
    );
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
