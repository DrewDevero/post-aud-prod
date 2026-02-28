import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { getFriends } from "@/lib/friends-store";
import { getRoom } from "@/lib/room-store";
import { createNotification } from "@/lib/notification-store";

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
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { friendId } = await req.json();
  if (!friendId) {
    return NextResponse.json({ error: "friendId required" }, { status: 400 });
  }

  const friends = getFriends(user.id);
  const friend = friends.find((f) => f.id === friendId);
  if (!friend) {
    return NextResponse.json(
      { error: "Not friends with this user" },
      { status: 403 },
    );
  }

  const notif = createNotification({
    userId: friendId,
    type: "room-invite",
    fromUserId: user.id,
    fromUserName: user.name,
    roomId,
  });

  return NextResponse.json({ notif });
}
