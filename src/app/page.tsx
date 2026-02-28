"use client";

import { useState, useRef, useCallback } from "react";

const SCENE_IMAGE_URL =
  "https://pocge3esja6nk0zk.public.blob.vercel-storage.com/BF0LFr1_xVCIhqE2wiNQq_CweiVRCC-cRjLFz1yMmeqKO7HvhGw5Rs3aPsdjq.png";

type Stage =
  | "upload"
  | "generating-image"
  | "generating-video"
  | "result";

interface CharacterSlot {
  file: File;
  preview: string;
}

export default function Home() {
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [characters, setCharacters] = useState<(CharacterSlot | null)[]>([null, null]);
  const [stage, setStage] = useState<Stage>("upload");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setCharacters((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index]!.preview);
      next[index] = { file, preview };
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (index: number, e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFile(index, file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(index, file);
      e.target.value = "";
    },
    [handleFile],
  );

  const removeCharacter = useCallback((index: number) => {
    setCharacters((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index]!.preview);
      next[index] = null;
      return next;
    });
  }, []);

  const bothReady = characters[0] !== null && characters[1] !== null;

  const generate = useCallback(async () => {
    if (!characters[0] || !characters[1]) return;
    setStage("generating-image");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("images", characters[0].file, "character1.png");
      formData.append("images", characters[1].file, "character2.png");

      const genRes = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      if (!genRes.ok) {
        const body = await genRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate image");
      }
      const imageData = await genRes.json();
      const imageUrl: string | undefined = imageData.images?.[0]?.url;
      if (!imageUrl) throw new Error("No image was returned");

      setGeneratedImageUrl(imageUrl);
      setStage("generating-video");

      const animRes = await fetch("/api/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!animRes.ok) {
        const body = await animRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to generate video");
      }
      const videoData = await animRes.json();
      const vidUrl: string | undefined = videoData.video?.url;
      if (!vidUrl) throw new Error("No video was returned");

      setVideoUrl(vidUrl);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("upload");
    }
  }, [characters]);

  const reset = useCallback(() => {
    characters.forEach((c) => {
      if (c?.preview) URL.revokeObjectURL(c.preview);
    });
    setCharacters([null, null]);
    setGeneratedImageUrl(null);
    setVideoUrl(null);
    setError(null);
    setStage("upload");
  }, [characters]);

  const isGenerating =
    stage === "generating-image" || stage === "generating-video";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Scene Placer</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Upload two characters, place them in the scene, and watch it come
            alive
          </p>
        </div>

        {/* Upload slots / Generating / Result */}
        {stage === "upload" && (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="relative">
                <input
                  ref={fileInputRefs[i]}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleInputChange(i, e)}
                />
                {characters[i] ? (
                  <div className="group relative aspect-square overflow-hidden rounded-2xl border border-zinc-700 bg-black">
                    <img
                      src={characters[i]!.preview}
                      alt={`Character ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removeCharacter(i)}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      &times;
                    </button>
                    <p className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-xs text-zinc-300">
                      Character {i + 1}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRefs[i].current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(i, e)}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                  >
                    <svg
                      className="h-8 w-8 text-zinc-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <span className="text-xs text-zinc-500">
                      Character {i + 1}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isGenerating && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            {stage === "generating-image" && (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
                  <p className="text-sm text-zinc-300">
                    Placing characters in the scene&hellip;
                  </p>
                </div>
              </div>
            )}
            {stage === "generating-video" && generatedImageUrl && (
              <>
                <img
                  src={generatedImageUrl}
                  alt="Generated scene"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
                    <p className="text-sm text-zinc-300">
                      Animating the scene&hellip;
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {stage === "result" && videoUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <video
              src={videoUrl}
              autoPlay
              loop
              playsInline
              controls
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Scene thumbnail */}
        {stage !== "result" && (
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <img
              src={SCENE_IMAGE_URL}
              alt="Target scene"
              className="h-16 w-16 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-500">Target Scene</p>
              <p className="text-sm text-zinc-300">
                Both characters will be placed and animated here
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {stage === "upload" && (
            <button
              onClick={generate}
              disabled={!bothReady}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity ${
                bothReady
                  ? "bg-white text-black hover:opacity-90 active:opacity-80"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500"
              }`}
            >
              Place Us in Scene
            </button>
          )}

          {isGenerating && (
            <button
              disabled
              className="flex-1 cursor-not-allowed rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-500"
            >
              {stage === "generating-image"
                ? "Placing in scene\u2026"
                : "Animating\u2026"}
            </button>
          )}

          {stage === "result" && (
            <button
              onClick={reset}
              className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
