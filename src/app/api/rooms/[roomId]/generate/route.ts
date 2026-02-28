import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { getRoom, setGeneration, updatePipeline } from "@/lib/room-store";

fal.config({ credentials: process.env.FAL_KEY! });

const SCENE_IMAGES = [
  "https://pocge3esja6nk0zk.public.blob.vercel-storage.com/BF0LFr1_xVCIhqE2wiNQq_CweiVRCC-cRjLFz1yMmeqKO7HvhGw5Rs3aPsdjq.png",
  "https://v3b.fal.media/files/b/0a904ff6/zh54kzzHSHF5K9G1LlTVb_nY4Pvu3d.png",
];

async function runGeneration(
  roomId: string,
  imagePrompt?: string,
  videoPrompt?: string,
) {
  const room = getRoom(roomId);
  if (!room) return;

  const characterUrls = room.characters.map((c) => c.imageUrl);
  const outfitUrls = room.outfits.map((o) => o.imageUrl);
  const hasOutfits = outfitUrls.length > 0;

  const defaultImagePrompt = (() => {
    if (characterUrls.length === 1 && !hasOutfits)
      return "Place the character into the scene";
    if (characterUrls.length === 1 && hasOutfits)
      return "Place the character into the scene wearing the provided outfit";
    if (!hasOutfits) return "Place all characters into the scene";
    return "Place all characters into the scene wearing the provided outfits";
  })();
  const defaultVideoPrompt = "they both walk up the stairs slowly";

  setGeneration(roomId, {
    stage: "generating-images",
    pipelines: SCENE_IMAGES.map(() => ({ imageDone: false, videoDone: false })),
  });

  const imageUrls = await Promise.all(
    SCENE_IMAGES.map(async (sceneUrl, i) => {
      const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
        input: {
          prompt: imagePrompt || defaultImagePrompt,
          image_urls: [...characterUrls, ...outfitUrls, sceneUrl],
          aspect_ratio: "16:9",
          output_format: "png",
          resolution: "1K",
        },
      });
      const url = (result.data as { images?: { url: string }[] }).images?.[0]
        ?.url;
      if (!url) throw new Error(`No image returned for scene ${i + 1}`);
      updatePipeline(roomId, i, { imageDone: true, imageUrl: url });
      return url;
    }),
  );

  setGeneration(roomId, {
    stage: "generating-videos",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: false })),
  });

  const videoUrls = await Promise.all(
    imageUrls.map(async (imageUrl, i) => {
      const result = await fal.subscribe(
        "xai/grok-imagine-video/image-to-video",
        {
          input: {
            prompt: videoPrompt || defaultVideoPrompt,
            image_url: imageUrl,
            duration: 6,
            resolution: "720p",
          },
        },
      );
      const url = (result.data as { video?: { url: string } }).video?.url;
      if (!url) throw new Error(`No video returned for scene ${i + 1}`);
      updatePipeline(roomId, i, { videoDone: true, videoUrl: url });
      return url;
    }),
  );

  setGeneration(roomId, {
    stage: "merging",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: true })),
  });

  const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
    input: {
      video_urls: videoUrls,
      resolution: "landscape_16_9",
    },
  });
  const mergedUrl = (mergeResult.data as { video?: { url: string } }).video
    ?.url;
  if (!mergedUrl) throw new Error("No merged video returned");

  setGeneration(roomId, {
    stage: "done",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: true })),
    mergedVideoUrl: mergedUrl,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.characters.length === 0) {
    return NextResponse.json(
      { error: "No characters in room" },
      { status: 400 },
    );
  }

  if (
    room.generation &&
    !["done", "error"].includes(room.generation.stage)
  ) {
    return NextResponse.json(
      { error: "Generation already in progress" },
      { status: 409 },
    );
  }

  const { imagePrompt, videoPrompt } = await req.json().catch(() => ({}));

  runGeneration(roomId, imagePrompt, videoPrompt).catch((err) => {
    console.error("Room generation error:", err);
    setGeneration(roomId, {
      stage: "error",
      pipelines:
        getRoom(roomId)?.generation?.pipelines ??
        SCENE_IMAGES.map(() => ({ imageDone: false, videoDone: false })),
      error: err instanceof Error ? err.message : "Generation failed",
    });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  setGeneration(roomId, null);
  return NextResponse.json({ ok: true });
}
