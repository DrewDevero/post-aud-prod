import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { addOutfit, removeOutfit, getRoom } from "@/lib/room-store";

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
    const outfitId = formData.get("outfitId") as string;
    const outfitName = formData.get("outfitName") as string;
    const file = formData.get("image") as File | null;

    if (!outfitId || !outfitName || !file) {
      return NextResponse.json(
        { error: "Missing outfit data" },
        { status: 400 },
      );
    }

    const imageUrl = await fal.storage.upload(file);

    addOutfit(roomId, {
      id: outfitId,
      name: outfitName,
      imageUrl,
      userId: user.id,
      userName: user.name,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    const outfitId = formData.get("outfitId") as string;
    if (!outfitId) {
      return NextResponse.json(
        { error: "Missing outfitId" },
        { status: 400 },
      );
    }
    removeOutfit(roomId, outfitId, user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
