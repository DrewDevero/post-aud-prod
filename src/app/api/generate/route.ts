import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];
    const sceneImageUrl = formData.get("sceneImageUrl") as string | null;

    if (files.length < 2) {
      return NextResponse.json(
        { error: "Two character images are required" },
        { status: 400 },
      );
    }
    if (!sceneImageUrl) {
      return NextResponse.json(
        { error: "Scene image URL is required" },
        { status: 400 },
      );
    }

    const uploadedUrls = await Promise.all(
      files.map((f) => fal.storage.upload(f)),
    );

    const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
      input: {
        prompt: "Place both characters into the scene",
        image_urls: [...uploadedUrls, sceneImageUrl],
        output_format: "png",
        resolution: "1K",
      },
    });

    return NextResponse.json(result.data);
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 },
    );
  }
}
