import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];
    const sceneImageUrl = formData.get("sceneImageUrl") as string | null;
    const customPrompt = formData.get("prompt") as string | null;

    if (files.length < 1) {
      return NextResponse.json(
        { error: "At least one character image is required" },
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

    const prompt =
      customPrompt ||
      (files.length === 1
        ? "Place the character into the scene"
        : "Place all characters into the scene");

    const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
      input: {
        prompt,
        image_urls: [...uploadedUrls, sceneImageUrl],
        aspect_ratio: "16:9",
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
