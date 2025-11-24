import { api } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await api.post("/images/upload/finalize", await request.json());
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to finalize image upload" },
      { status: 500 }
    );
  }
}

