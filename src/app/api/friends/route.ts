import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, TEST_USERS } from "@/lib/auth";
import {
  sendFriendRequest,
  getFriendsState,
} from "@/lib/friends-store";

function getUser(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value) as { id: string; name: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const state = getFriendsState(user.id);
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { toUserId } = await req.json();
  if (!toUserId) {
    return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  }

  const target = TEST_USERS.find((u) => u.id === toUserId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = sendFriendRequest(user, target);
  return NextResponse.json({ result });
}
