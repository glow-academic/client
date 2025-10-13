import { DeleteDepartmentRequestSchema } from "@/lib/api/v2/schemas/departments";
import { NextRequest, NextResponse } from "next/server";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deleteRequest = DeleteDepartmentRequestSchema.parse(body);

    const response = await fetch(`${SERVER_URL}/api/v2/departments/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deleteRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Server error:", error);
      return NextResponse.json(
        { error: "Failed to delete department" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in department delete route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
