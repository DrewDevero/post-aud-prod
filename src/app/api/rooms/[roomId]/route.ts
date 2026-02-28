import { NextRequest, NextResponse } from "next/server";
import { getRoom, serializeRoom } from "@/lib/room-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(serializeRoom(room));
}
