import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { videoUrls } = await req.json();

    if (!Array.isArray(videoUrls) || videoUrls.length < 2) {
      return NextResponse.json(
        { error: "At least two video URLs are required" },
        { status: 400 },
      );
    }

    const result = await fal.subscribe("fal-ai/ffmpeg-api/merge-videos", {
      input: {
        video_urls: videoUrls,
        resolution: "landscape_16_9",
      },
    });

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Merge error:", err);
    return NextResponse.json(
      { error: "Failed to merge videos" },
      { status: 500 },
    );
  }
}
