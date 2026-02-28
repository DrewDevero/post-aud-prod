import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { getRoom, setGeneration, updatePipeline } from "@/lib/room-store";
import { generateImageFromUrls } from "@/lib/gemini";

fal.config({ credentials: process.env.FAL_KEY! });

const PREFIX = "[room-generate]";

const SCENE_IMAGES = [
  "https://pocge3esja6nk0zk.public.blob.vercel-storage.com/BF0LFr1_xVCIhqE2wiNQq_CweiVRCC-cRjLFz1yMmeqKO7HvhGw5Rs3aPsdjq.png",
  "https://v3b.fal.media/files/b/0a904ff6/zh54kzzHSHF5K9G1LlTVb_nY4Pvu3d.png",
];

async function runGeneration(
  roomId: string,
  imagePrompt?: string,
  videoPrompt?: string,
) {
  const t0 = Date.now();
  console.log(PREFIX, `starting generation for room=${roomId}`);

  const room = getRoom(roomId);
  if (!room) {
    console.log(PREFIX, `room=${roomId} not found, aborting`);
    return;
  }

  const characterUrls = room.characters.map((c) => c.imageUrl);
  const outfitUrls = room.outfits.map((o) => o.imageUrl);
  const hasOutfits = outfitUrls.length > 0;

  console.log(PREFIX, `room=${roomId} inputs:`, {
    characters: characterUrls.length,
    characterUrls,
    outfits: outfitUrls.length,
    outfitUrls,
    scenes: SCENE_IMAGES.length,
    imagePrompt: imagePrompt || "(default)",
    videoPrompt: videoPrompt || "(default)",
  });

  const defaultImagePrompt = (() => {
    if (characterUrls.length === 1 && !hasOutfits)
      return "Place the character into the scene";
    if (characterUrls.length === 1 && hasOutfits)
      return "Place the character into the scene wearing the provided outfit";
    if (!hasOutfits) return "Place all characters into the scene";
    return "Place all characters into the scene wearing the provided outfits";
  })();
  const defaultVideoPrompt = "they both walk up the stairs slowly";

  const resolvedImagePrompt = imagePrompt || defaultImagePrompt;
  const resolvedVideoPrompt = videoPrompt || defaultVideoPrompt;
  console.log(PREFIX, `resolved prompts: image="${resolvedImagePrompt}" video="${resolvedVideoPrompt}"`);

  setGeneration(roomId, {
    stage: "generating-images",
    pipelines: SCENE_IMAGES.map(() => ({ imageDone: false, videoDone: false })),
  });

  console.log(PREFIX, `[stage=generating-images] starting ${SCENE_IMAGES.length} parallel image generations`);
  const tImg = Date.now();
  const imageUrls = await Promise.all(
    SCENE_IMAGES.map(async (sceneUrl, i) => {
      const tScene = Date.now();
      console.log(PREFIX, `[image ${i + 1}/${SCENE_IMAGES.length}] starting, scene=${sceneUrl.slice(-40)}`);
      try {
        const url = await generateImageFromUrls({
          characterUrls,
          outfitUrls,
          sceneImageUrl: sceneUrl,
          prompt: resolvedImagePrompt,
        });
        console.log(PREFIX, `[image ${i + 1}/${SCENE_IMAGES.length}] done in ${Date.now() - tScene}ms → ${url}`);
        updatePipeline(roomId, i, { imageDone: true, imageUrl: url });
        return url;
      } catch (err) {
        console.error(PREFIX, `[image ${i + 1}/${SCENE_IMAGES.length}] FAILED after ${Date.now() - tScene}ms:`, err);
        throw err;
      }
    }),
  );
  console.log(PREFIX, `[stage=generating-images] all done in ${Date.now() - tImg}ms`);

  setGeneration(roomId, {
    stage: "generating-videos",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: false })),
  });

  console.log(PREFIX, `[stage=generating-videos] starting ${imageUrls.length} parallel video generations`);
  const tVid = Date.now();
  const videoUrls = await Promise.all(
    imageUrls.map(async (imageUrl, i) => {
      const tScene = Date.now();
      console.log(PREFIX, `[video ${i + 1}/${imageUrls.length}] starting, imageUrl=${imageUrl}`);
      try {
        const result = await fal.subscribe(
          "fal-ai/veo3.1/fast/image-to-video",
          {
            input: {
              prompt: resolvedVideoPrompt,
              image_url: imageUrl,
              aspect_ratio: "16:9",
              duration: "4s",
              resolution: "720p",
            },
          },
        );
        console.log(PREFIX, `[video ${i + 1}/${imageUrls.length}] fal response:`, JSON.stringify(result.data).slice(0, 500));
        const url = (result.data as { video?: { url: string } }).video?.url;
        if (!url) {
          console.error(PREFIX, `[video ${i + 1}/${imageUrls.length}] no video URL in response`, JSON.stringify(result.data));
          throw new Error(`No video returned for scene ${i + 1}`);
        }
        console.log(PREFIX, `[video ${i + 1}/${imageUrls.length}] done in ${Date.now() - tScene}ms → ${url}`);
        updatePipeline(roomId, i, { videoDone: true, videoUrl: url });
        return url;
      } catch (err) {
        console.error(PREFIX, `[video ${i + 1}/${imageUrls.length}] FAILED after ${Date.now() - tScene}ms:`, err);
        throw err;
      }
    }),
  );
  console.log(PREFIX, `[stage=generating-videos] all done in ${Date.now() - tVid}ms`);

  setGeneration(roomId, {
    stage: "merging",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: true })),
  });

  console.log(PREFIX, `[stage=merging] merging ${videoUrls.length} videos`, videoUrls);
  const tMerge = Date.now();
  const mergeResult = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
    input: {
      video_urls: videoUrls,
      resolution: "landscape_16_9",
    },
  });
  console.log(PREFIX, `[stage=merging] fal response:`, JSON.stringify(mergeResult.data).slice(0, 500));
  const mergedUrl = (mergeResult.data as { video?: { url: string } }).video
    ?.url;
  if (!mergedUrl) {
    console.error(PREFIX, `[stage=merging] no merged video URL`, JSON.stringify(mergeResult.data));
    throw new Error("No merged video returned");
  }
  console.log(PREFIX, `[stage=merging] done in ${Date.now() - tMerge}ms → ${mergedUrl}`);

  setGeneration(roomId, {
    stage: "done",
    pipelines:
      getRoom(roomId)?.generation?.pipelines ??
      SCENE_IMAGES.map(() => ({ imageDone: true, videoDone: true })),
    mergedVideoUrl: mergedUrl,
  });

  console.log(PREFIX, `room=${roomId} generation complete, total ${Date.now() - t0}ms`);
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
  console.log(PREFIX, `POST room=${roomId} imagePrompt=${imagePrompt ?? "(none)"} videoPrompt=${videoPrompt ?? "(none)"}`);

  runGeneration(roomId, imagePrompt, videoPrompt).catch((err) => {
    const msg = err instanceof Error ? err.message : "Generation failed";
    console.error(PREFIX, `room=${roomId} generation FAILED:`, msg, err);
    setGeneration(roomId, {
      stage: "error",
      pipelines:
        getRoom(roomId)?.generation?.pipelines ??
        SCENE_IMAGES.map(() => ({ imageDone: false, videoDone: false })),
      error: msg,
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
