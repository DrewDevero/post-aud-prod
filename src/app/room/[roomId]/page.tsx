"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import {
  getAllCharacters,
  type SavedCharacter,
} from "@/lib/character-store";
import {
  getAllOutfits,
  type SavedOutfit,
} from "@/lib/outfit-store";
import type { SerializedRoom } from "@/lib/room-store";
import { InviteModal } from "@/components/invite-modal";
import { GENRES, getGenreById } from "@/lib/genres";

const DEFAULT_VIDEO_PROMPT = "they both walk up the stairs slowly";

interface LocalChar {
  character: SavedCharacter;
  url: string;
}

interface LocalOutfit {
  outfit: SavedOutfit;
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
  const [localOutfits, setLocalOutfits] = useState<LocalOutfit[]>([]);
  const [pendingChars, setPendingChars] = useState<Set<string>>(new Set());
  const [pendingOutfits, setPendingOutfits] = useState<Set<string>>(new Set());

  const [promptMode, setPromptMode] = useState<"auto" | "manual">("auto");
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [genreOpen, setGenreOpen] = useState(false);
  const [selectedGenreId, setSelectedGenreId] = useState(GENRES[0]?.id ?? "noir");

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

  // Load local outfits
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getAllOutfits(user.id).then((outfits) => {
      if (cancelled) return;
      setLocalOutfits(
        outfits.map((o) => ({ outfit: o, url: URL.createObjectURL(o.blob) })),
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

  useEffect(() => {
    return () => {
      localOutfits.forEach((o) => URL.revokeObjectURL(o.url));
    };
  }, [localOutfits]);

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

  const toggleOutfit = useCallback(
    async (outfit: SavedOutfit) => {
      if (!user || !roomState) return;

      const inRoom = roomState.outfits.some(
        (o) => o.id === outfit.id && o.userId === user.id,
      );

      setPendingOutfits((prev) => new Set(prev).add(outfit.id));

      try {
        const formData = new FormData();
        if (inRoom) {
          formData.append("action", "remove");
          formData.append("outfitId", outfit.id);
        } else {
          formData.append("action", "add");
          formData.append("outfitId", outfit.id);
          formData.append("outfitName", outfit.name);
          formData.append("image", outfit.blob);
        }

        await fetch(`/api/rooms/${roomId}/outfits`, {
          method: "POST",
          body: formData,
        });
      } finally {
        setPendingOutfits((prev) => {
          const next = new Set(prev);
          next.delete(outfit.id);
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
        genreId: selectedGenreId,
      }),
    });
  }, [roomId, promptMode, imagePrompt, videoPrompt, selectedGenreId]);

  const resetGeneration = useCallback(async () => {
    await fetch(`/api/rooms/${roomId}/generate`, { method: "DELETE" });
  }, [roomId]);

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8 text-foreground group">
        <p className="text-xs font-black tracking-widest uppercase text-red-500">Sequence Not Found</p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 rounded border border-border px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-surface transition-colors"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  if (!user || !roomState) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-4 w-4 animate-spin rounded border-2 border-border border-t-accent" />
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
  const hasOutfits = roomState.outfits.length > 0;
  const autoImagePrompt = (() => {
    if (charCount === 1 && !hasOutfits)
      return "Place the character into the scene";
    if (charCount === 1 && hasOutfits)
      return "Place the character into the scene wearing the provided outfit";
    if (!hasOutfits) return "Place all characters into the scene";
    return "Place all characters into the scene wearing the provided outfits";
  })();

  const stageLabel = (() => {
    switch (gen?.stage) {
      case "generating-images":
        return "Rendering Frames...";
      case "generating-videos":
        return "Processing Motion...";
      case "merging":
        return "Final Assembly...";
      default:
        return "";
    }
  })();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted">Sequence</span>
            <code className="text-[11px] font-mono font-bold text-accent">{roomId}</code>
            <button
              onClick={copyRoomCode}
              className="ml-1 text-[9px] font-bold uppercase tracking-tighter text-muted hover:text-foreground"
            >
              {copied ? "ID Copied" : "Copy ID"}
            </button>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500"}`} />
            <span className="text-[10px] font-bold uppercase tracking-tight text-muted">
              {connected ? "Live" : "Offline"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {roomState.members.map((m) => (
              <div
                key={m.id}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface text-[9px] font-black ${m.id === user.id ? "bg-accent text-background" : "bg-muted text-surface"
                  }`}
                title={m.name}
              >
                {m.name.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-muted hover:text-accent hover:border-accent/30 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
            Invite
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane - Assets */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background">
          <div className="p-3 border-b border-border">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Asset Browser</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {/* Characters Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/50">Cast</span>
                <span className="text-[9px] font-mono text-accent">{localChars.length} items</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {localChars.map(({ character, url }) => {
                  const inRoom = roomState.characters.some(c => c.id === character.id && c.userId === user.id);
                  const pending = pendingChars.has(character.id);
                  return (
                    <button
                      key={character.id}
                      onClick={() => toggleCharacter(character)}
                      disabled={pending || !isIdle}
                      className={`group relative aspect-square overflow-hidden rounded border transition-all ${inRoom ? "border-accent ring-1 ring-accent/20" : "border-border hover:border-muted"
                        } ${!isIdle ? "opacity-30 grayscale" : ""}`}
                    >
                      <img src={url} alt={character.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="truncate text-[8px] font-bold text-white uppercase">{character.name}</p>
                      </div>
                      {inRoom && (
                        <div className="absolute top-1 right-1 h-3 w-3 rounded-full bg-accent flex items-center justify-center">
                          <svg className="h-2 w-2 text-background" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Outfits Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted/50">Wardrobe</span>
                <span className="text-[9px] font-mono text-accent">{localOutfits.length} items</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {localOutfits.map(({ outfit, url }) => {
                  const inRoom = roomState.outfits.some(o => o.id === outfit.id && o.userId === user.id);
                  const pending = pendingOutfits.has(outfit.id);
                  return (
                    <button
                      key={outfit.id}
                      onClick={() => toggleOutfit(outfit)}
                      disabled={pending || !isIdle}
                      className={`group relative aspect-[3/4] overflow-hidden rounded border transition-all ${inRoom ? "border-accent ring-1 ring-accent/20" : "border-border hover:border-muted"
                        } ${!isIdle ? "opacity-30 grayscale" : ""}`}
                    >
                      <img src={url} alt={outfit.name} className="h-full w-full object-cover" />
                      {inRoom && (
                        <div className="absolute inset-0 bg-accent/10 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>

        {/* Center Pane - Preview and Controls */}
        <main className="flex flex-1 flex-col bg-surface overflow-hidden">
          {/* Top - Viewport */}
          <div className="flex-1 flex items-center justify-center p-6 bg-[#0a0a0a] relative">
            <div className="max-w-4xl w-full aspect-video bg-background border border-border rounded shadow-2xl relative overflow-hidden flex items-center justify-center">
              {/* Overlay labels */}
              <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-[10px] font-mono font-bold tracking-tighter text-red-600">REC</span>
              </div>
              <div className="absolute top-4 right-4 text-[10px] font-mono font-bold text-muted  z-10 uppercase">
                SCENE_PREVIEW_V1
              </div>

              {!isDone && !isGenerating && !hasError && (
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted/50 italic">No Media Rendered</p>
                  <p className="text-[9px] text-muted uppercase tracking-widest">Select assets and click Re-Render</p>
                </div>
              )}

              {isGenerating && gen && (
                <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
                  {gen.pipelines.map((p, i) => (
                    <div key={i} className="relative aspect-video bg-surface overflow-hidden border border-border/50">
                      <img
                        src={p.imageUrl || (getGenreById(selectedGenreId)?.scenes[i] ?? "")}
                        className={`h-full w-full object-cover transition-opacity duration-500 ${!p.imageUrl ? "opacity-20" : "opacity-60"}`}
                        alt=""
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        {!p.videoDone && (
                          <div className="w-full space-y-2 max-w-[120px]">
                            <div className="relative h-1 w-full bg-border overflow-hidden rounded-full">
                              <div className="absolute inset-0 bg-accent animate-[shimmer_2s_infinite]" />
                            </div>
                            <p className="text-[8px] font-black text-center uppercase tracking-widest text-accent">
                              {!p.imageDone ? "Mapping" : "Animating"}
                            </p>
                          </div>
                        )}
                        {p.videoDone && <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Done</span>}
                      </div>
                      <span className="absolute bottom-2 left-2 text-[8px] font-mono text-muted uppercase">S_{i + 1}</span>
                    </div>
                  ))}
                </div>
              )}

              {isDone && gen?.mergedVideoUrl && (
                <video
                  src={gen.mergedVideoUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="h-full w-full object-contain"
                />
              )}

              {hasError && (
                <div className="p-8 text-center bg-red-950/20 border border-red-900/50 rounded">
                  <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">Render Process Failed</p>
                  <p className="mt-2 text-[10px] text-red-400 font-medium">{gen?.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom - Controls Area */}
          <div className="h-48 shrink-0 border-t border-border bg-background p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <button
                    onClick={() => setGenreOpen(!genreOpen)}
                    className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted hover:text-foreground hover:border-muted transition-colors"
                  >
                    <span className="text-muted/70">Genre</span>
                    <span className="text-foreground">{getGenreById(selectedGenreId)?.name ?? selectedGenreId}</span>
                    <svg className={`h-3 w-3 transition-transform ${genreOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {genreOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setGenreOpen(false)} />
                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[120px] rounded border border-border bg-background shadow-xl py-1">
                        {GENRES.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setSelectedGenreId(g.id);
                              setGenreOpen(false);
                            }}
                            className={`block w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider transition-colors ${selectedGenreId === g.id ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Prompt Engine</span>
                  <div className="flex rounded-sm bg-surface p-0.5 border border-border">
                    {(["auto", "manual"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPromptMode(mode)}
                        className={`rounded-sm px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${promptMode === mode ? "bg-accent text-background" : "text-muted hover:text-foreground"
                          }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {isIdle && !isDone && (
                  <button
                    onClick={generate}
                    disabled={!canGenerate}
                    className={`h-8 px-6 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${canGenerate ? "bg-accent text-background hover:scale-105 active:scale-95" : "bg-surface text-muted cursor-not-allowed"
                      }`}
                  >
                    Initialize Render
                  </button>
                )}
                {(isDone || hasError) && (
                  <button
                    onClick={resetGeneration}
                    className="h-8 px-6 rounded bg-foreground text-background text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-lg overflow-hidden relative"
                  >
                    Clear Cache & Re-Render
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1">
              {promptMode === "auto" ? (
                <div className="grid grid-cols-2 gap-4 h-full">
                  <div className="space-y-1.5 opacity-60">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted/50">Instructional Basis</p>
                    <div className="rounded border border-border bg-surface/50 p-2 text-[11px] font-medium text-muted font-mono h-20 overflow-y-auto">
                      {autoImagePrompt}
                    </div>
                  </div>
                  <div className="space-y-1.5 opacity-60">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted/50">Contextuals</p>
                    <div className="rounded border border-border bg-surface/50 p-2 text-[11px] font-medium text-muted font-mono h-20 overflow-y-auto">
                      {DEFAULT_VIDEO_PROMPT}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 h-full">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-muted/50">Custom Scene Props</label>
                    <textarea
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder={autoImagePrompt}
                      className="w-full h-20 bg-surface border border-border rounded p-2 text-[11px] font-mono text-accent placeholder:text-muted/30 outline-none focus:border-accent/40 resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase tracking-widest text-muted/50">Kinetic Instructions</label>
                    <textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder={DEFAULT_VIDEO_PROMPT}
                      className="w-full h-20 bg-surface border border-border rounded p-2 text-[11px] font-mono text-accent placeholder:text-muted/30 outline-none focus:border-accent/40 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right Pane - Composition Details */}
        <aside className="w-56 shrink-0 border-l border-border bg-background flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Session Info</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            <section className="space-y-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-tight text-muted/50">Composition Stats</p>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-muted/70 uppercase">Total Scenes</span>
                    <span className="text-accent">02</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-muted/70 uppercase">Resolution</span>
                    <span className="text-foreground">1080P</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-muted/70 uppercase">Framerate</span>
                    <span className="text-foreground">24 FPS</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[8px] font-black uppercase tracking-tight text-muted/50">Active Cast</p>
                <div className="mt-3 space-y-2">
                  {roomState.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 p-1.5 rounded bg-surface/30 border border-border/50">
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[8px] font-black ${m.id === user.id ? "bg-accent text-background" : "bg-muted text-surface"
                        }`}>
                        {m.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase truncate text-foreground">{m.name}</p>
                        <p className="text-[7px] font-bold text-muted truncate uppercase">
                          {m.id === user.id ? "Director" : "Collaborator"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {roomState.members.length === 0 && (
                    <p className="text-[8px] text-muted italic text-center py-2">No Active Session</p>
                  )}
                </div>
              </div>

              {roomState.outfits.length > 0 && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-tight text-muted/50">Active Wardrobe</p>
                  <div className="mt-3 space-y-2">
                    {roomState.outfits.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 p-1.5 rounded bg-surface/30 border border-border/50">
                        <img src={o.imageUrl} className="h-4 w-4 rounded-sm object-cover shrink-0" alt="" />
                        <p className="text-[9px] font-black uppercase truncate text-foreground min-w-0">{o.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
          <div className="p-4 border-t border-border">
            <div className="text-[9px] font-mono text-muted/40 uppercase tracking-tighter">
              System_Node: TR-2938<br />
              Enc: H.264_COLLAB
            </div>
          </div>
        </aside>
      </div>

      <InviteModal roomId={roomId} open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Tailwind animation keyframes injected via style tag for simplicity in this file */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
