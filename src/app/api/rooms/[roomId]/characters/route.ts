import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { addCharacter, removeCharacter, getRoom } from "@/lib/room-store";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  if (!getRoom(roomId)) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const userCookie = req.cookies.get(COOKIE_NAME);
  if (!userCookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = JSON.parse(userCookie.value) as { id: string; name: string };

  const formData = await req.formData();
  const action = formData.get("action") as string;

  if (action === "add") {
    const characterId = formData.get("characterId") as string;
    const characterName = formData.get("characterName") as string;
    const file = formData.get("image") as File | null;

    if (!characterId || !characterName || !file) {
      return NextResponse.json(
        { error: "Missing character data" },
        { status: 400 },
      );
    }

    const imageUrl = await fal.storage.upload(file);

    addCharacter(roomId, {
      id: characterId,
      name: characterName,
      imageUrl,
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    const characterId = formData.get("characterId") as string;
    if (!characterId) {
      return NextResponse.json(
        { error: "Missing characterId" },
        { status: 400 },
      );
    }
    removeCharacter(roomId, characterId, user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
