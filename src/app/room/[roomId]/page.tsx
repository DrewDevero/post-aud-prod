"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import {
  getAllCharacters,
  type SavedCharacter,
} from "@/lib/character-store";
import type { SerializedRoom } from "@/lib/room-store";

const SCENE_IMAGES = [
  "https://pocge3esja6nk0zk.public.blob.vercel-storage.com/BF0LFr1_xVCIhqE2wiNQq_CweiVRCC-cRjLFz1yMmeqKO7HvhGw5Rs3aPsdjq.png",
  "https://v3b.fal.media/files/b/0a904ff6/zh54kzzHSHF5K9G1LlTVb_nY4Pvu3d.png",
];

const DEFAULT_VIDEO_PROMPT = "they both walk up the stairs slowly";

interface LocalChar {
  character: SavedCharacter;
  url: string;
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const user = useUser();

  const [roomState, setRoomState] = useState<SerializedRoom | null>(null);
  const [connected, setConnected] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [localChars, setLocalChars] = useState<LocalChar[]>([]);
  const [pendingChars, setPendingChars] = useState<Set<string>>(new Set());

  const [promptMode, setPromptMode] = useState<"auto" | "manual">("auto");
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  // Load local characters
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getAllCharacters(user.id).then((chars) => {
      if (cancelled) return;
      setLocalChars(
        chars.map((c) => ({ character: c, url: URL.createObjectURL(c.blob) })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      localChars.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, [localChars]);

  // SSE connection
  useEffect(() => {
    if (!roomId) return;

    const es = new EventSource(`/api/rooms/${roomId}/events`);

    es.addEventListener("update", (e) => {
      setRoomState(JSON.parse(e.data));
      setConnected(true);
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setNotFound(true);
      }
      setConnected(false);
    };

    return () => es.close();
  }, [roomId]);

  const copyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  const toggleCharacter = useCallback(
    async (char: SavedCharacter) => {
      if (!user || !roomState) return;

      const inRoom = roomState.characters.some(
        (c) => c.id === char.id && c.userId === user.id,
      );

      setPendingChars((prev) => new Set(prev).add(char.id));

      try {
        const formData = new FormData();
        if (inRoom) {
          formData.append("action", "remove");
          formData.append("characterId", char.id);
        } else {
          formData.append("action", "add");
          formData.append("characterId", char.id);
          formData.append("characterName", char.name);
          formData.append("image", char.blob);
        }

        await fetch(`/api/rooms/${roomId}/characters`, {
          method: "POST",
          body: formData,
        });
      } finally {
        setPendingChars((prev) => {
          const next = new Set(prev);
          next.delete(char.id);
          return next;
        });
      }
    },
    [user, roomState, roomId],
  );

  const generate = useCallback(async () => {
    const resolvedImagePrompt =
      promptMode === "manual" && imagePrompt.trim()
        ? imagePrompt.trim()
        : undefined;
    const resolvedVideoPrompt =
      promptMode === "manual" && videoPrompt.trim()
        ? videoPrompt.trim()
        : undefined;

    await fetch(`/api/rooms/${roomId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePrompt: resolvedImagePrompt,
        videoPrompt: resolvedVideoPrompt,
      }),
    });
  }, [roomId, promptMode, imagePrompt, videoPrompt]);

  const resetGeneration = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/generate`, { method: "DELETE" });
  }, [roomId]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 p-8 text-white">
        <p className="text-lg font-medium">Room not found</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          Go home
        </button>
      </div>
    );
  }

  if (!user || !roomState) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
      </div>
    );
  }

  const gen = roomState.generation;
  const isIdle = !gen || gen.stage === "done" || gen.stage === "error";
  const isGenerating = gen && !["done", "error"].includes(gen.stage);
  const isDone = gen?.stage === "done";
  const hasError = gen?.stage === "error";
  const canGenerate = roomState.characters.length >= 1 && isIdle;

  const charCount = roomState.characters.length;
  const autoImagePrompt =
    charCount === 1
      ? "Place the character into the scene"
      : "Place all characters into the scene";

  const stageLabel = (() => {
    switch (gen?.stage) {
      case "generating-images":
        return "Placing characters in scenes\u2026";
      case "generating-videos":
        return "Animating scenes\u2026";
      case "merging":
        return "Merging clips\u2026";
      default:
        return "";
    }
  })();

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 p-8 text-white">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* Room header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Room</h1>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-zinc-800 px-2 py-0.5 text-sm text-zinc-300">
                {roomId}
              </code>
              <button
                onClick={copyRoomCode}
                className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roomState.members.map((m) => (
              <div
                key={m.id}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  m.id === user.id
                    ? "bg-white text-black"
                    : "bg-zinc-700 text-white"
                }`}
                title={m.name}
              >
                {m.name.slice(-1)}
              </div>
            ))}
            <div
              className={`ml-1 h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-zinc-600"}`}
              title={connected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>

        {/* Your characters */}
        {isIdle && !isDone && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-500">
              Your Characters
            </p>
            {localChars.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600">
                No characters. Add some on the Character Crew page.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {localChars.map(({ character, url }) => {
                  const inRoom = roomState.characters.some(
                    (c) =>
                      c.id === character.id && c.userId === user.id,
                  );
                  const pending = pendingChars.has(character.id);
                  return (
                    <button
                      key={character.id}
                      onClick={() => toggleCharacter(character)}
                      disabled={pending}
                      className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                        inRoom
                          ? "border-white ring-2 ring-white/20"
                          : "border-zinc-800 hover:border-zinc-600"
                      } ${pending ? "opacity-50" : ""}`}
                    >
                      <div className="aspect-square overflow-hidden bg-black">
                        <img
                          src={url}
                          alt={character.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="bg-zinc-900 px-1.5 py-1">
                        <p className="truncate text-[10px] text-zinc-300">
                          {character.name}
                        </p>
                      </div>
                      {inRoom && (
                        <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
                          <svg
                            className="h-2.5 w-2.5 text-black"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                      {pending && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Room characters */}
        {isIdle && !isDone && roomState.characters.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-zinc-500">In This Room</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {roomState.characters.map((c) => (
                <div
                  key={`${c.userId}-${c.id}`}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
                >
                  <div className="aspect-square overflow-hidden bg-black">
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-xs text-zinc-200">{c.name}</p>
                    <p className="truncate text-[10px] text-zinc-500">
                      {c.userName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompts */}
        {isIdle && !isDone && roomState.characters.length > 0 && (
          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">Prompts</p>
              <div className="flex rounded-lg bg-zinc-800 p-0.5">
                {(["auto", "manual"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPromptMode(mode)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      promptMode === mode
                        ? "bg-zinc-600 text-white"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {mode === "auto" ? "Auto" : "Manual"}
                  </button>
                ))}
              </div>
            </div>

            {promptMode === "auto" ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-[11px] font-medium text-zinc-500">
                    Image prompt
                  </p>
                  <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-sm text-zinc-400">
                    {autoImagePrompt}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-zinc-500">
                    Video prompt
                  </p>
                  <p className="rounded-lg bg-zinc-800/60 px-3 py-2 text-sm text-zinc-400">
                    {DEFAULT_VIDEO_PROMPT}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="room-image-prompt"
                    className="mb-1 block text-[11px] font-medium text-zinc-500"
                  >
                    Image prompt
                  </label>
                  <textarea
                    id="room-image-prompt"
                    rows={2}
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder={autoImagePrompt}
                    className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="room-video-prompt"
                    className="mb-1 block text-[11px] font-medium text-zinc-500"
                  >
                    Video prompt
                  </label>
                  <textarea
                    id="room-video-prompt"
                    rows={2}
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder={DEFAULT_VIDEO_PROMPT}
                    className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pipeline progress */}
        {isGenerating && gen && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {gen.pipelines.map((p, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-800 bg-black"
                >
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={`Scene ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src={SCENE_IMAGES[i]}
                      alt={`Target scene ${i + 1}`}
                      className="h-full w-full object-cover opacity-30"
                    />
                  )}
                  {!p.videoDone && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
                        <p className="text-xs text-zinc-300">
                          {!p.imageDone
                            ? "Generating\u2026"
                            : "Animating\u2026"}
                        </p>
                      </div>
                    </div>
                  )}
                  {p.videoDone && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg
                        className="h-8 w-8 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  <p className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    Scene {i + 1}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
              <p className="text-sm text-zinc-400">{stageLabel}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {isDone && gen?.mergedVideoUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <video
              src={gen.mergedVideoUrl}
              autoPlay
              loop
              playsInline
              controls
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Error */}
        {hasError && gen?.error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {gen.error}
          </div>
        )}

        {/* Scene thumbnails */}
        {!isDone && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">Target Scenes</p>
            <div className="grid grid-cols-2 gap-3">
              {SCENE_IMAGES.map((url, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-2"
                >
                  <img
                    src={url}
                    alt={`Target scene ${i + 1}`}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                  <p className="text-xs text-zinc-400">Scene {i + 1}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isIdle && !isDone && (
            <button
              onClick={generate}
              disabled={!canGenerate}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity ${
                canGenerate
                  ? "bg-white text-black hover:opacity-90 active:opacity-80"
                  : "cursor-not-allowed bg-zinc-800 text-zinc-500"
              }`}
            >
              Generate
              {roomState.characters.length > 0 && (
                <span className="ml-1.5 text-zinc-500">
                  ({roomState.characters.length} characters)
                </span>
              )}
            </button>
          )}

          {isGenerating && (
            <button
              disabled
              className="flex-1 cursor-not-allowed rounded-xl bg-zinc-800 py-3 text-sm font-medium text-zinc-500"
            >
              {stageLabel}
            </button>
          )}

          {(isDone || hasError) && (
            <button
              onClick={resetGeneration}
              className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80"
            >
              {isDone ? "Generate Again" : "Try Again"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
