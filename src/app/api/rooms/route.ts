import { NextResponse } from "next/server";
import { createRoom } from "@/lib/room-store";

export async function POST() {
  const id = createRoom();
  return NextResponse.json({ roomId: id });
}
