import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { acceptFriendRequest, declineFriendRequest, removeFriend } from "@/lib/friends-store";

function getUser(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value) as { id: string; name: string };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { friendId } = await params;
  const { action } = await req.json();

  if (action === "accept") {
    const ok = acceptFriendRequest(user.id, friendId);
    return NextResponse.json({ ok });
  }

  if (action === "decline") {
    const ok = declineFriendRequest(user.id, friendId);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> },
) {
  const user = getUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { friendId } = await params;
  const ok = removeFriend(user.id, friendId);
  return NextResponse.json({ ok });
}
