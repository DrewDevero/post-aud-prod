import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt } = await req.json();
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 },
      );
    }

    const result = await fal.subscribe(
      "fal-ai/veo3.1/fast/image-to-video",
      {
        input: {
          prompt: prompt || "they both walk up the stairs slowly",
          image_url: imageUrl,
          aspect_ratio: "16:9",
          duration: "4s",
          resolution: "720p",
        },
      },
    );

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Animate error:", err);
    return NextResponse.json(
      { error: "Failed to generate video" },
      { status: 500 },
    );
  }
}
