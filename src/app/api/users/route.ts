import { NextResponse } from "next/server";
import { TEST_USERS } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ users: TEST_USERS });
}
