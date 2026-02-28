import { NextRequest, NextResponse } from "next/server";
import { generateImageFromFiles } from "@/lib/gemini";

const PREFIX = "[api/generate]";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];
    const outfitFiles = formData.getAll("outfits") as File[];
    const sceneImageUrl = formData.get("sceneImageUrl") as string | null;
    const customPrompt = formData.get("prompt") as string | null;

    console.log(PREFIX, "POST request:", {
      characterFiles: files.length,
      fileSizes: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      outfitFiles: outfitFiles.length,
      outfitSizes: outfitFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      sceneImageUrl,
      customPrompt,
    });

    if (files.length < 1) {
      console.log(PREFIX, "rejected: no character images");
      return NextResponse.json(
        { error: "At least one character image is required" },
        { status: 400 },
      );
    }
    if (!sceneImageUrl) {
      console.log(PREFIX, "rejected: no scene image URL");
      return NextResponse.json(
        { error: "Scene image URL is required" },
        { status: 400 },
      );
    }

    const hasOutfits = outfitFiles.length > 0;
    const prompt =
      customPrompt ||
      (() => {
        if (files.length === 1 && !hasOutfits)
          return "Place the character into the scene";
        if (files.length === 1 && hasOutfits)
          return "Place the character into the scene wearing the provided outfit";
        if (!hasOutfits) return "Place all characters into the scene";
        return "Place all characters into the scene wearing the provided outfits";
      })();

    console.log(PREFIX, `resolved prompt: "${prompt}"`);

    const imageUrl = await generateImageFromFiles({
      characterFiles: files,
      outfitFiles,
      sceneImageUrl,
      prompt,
    });

    console.log(PREFIX, `success in ${Date.now() - t0}ms → ${imageUrl}`);
    return NextResponse.json({ images: [{ url: imageUrl }] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(PREFIX, `FAILED after ${Date.now() - t0}ms:`, msg, err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 },
    );
  }
}
