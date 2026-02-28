"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import {
  getAllOutfits,
  saveOutfit,
  deleteOutfit,
  renameOutfit,
  type SavedOutfit,
} from "@/lib/outfit-store";

function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function OutfitCard({
  outfit,
  onDelete,
  onRename,
}: {
  outfit: SavedOutfit;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const url = useBlobUrl(outfit.blob);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(outfit.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== outfit.name) {
      onRename(outfit.id, trimmed);
    } else {
      setDraft(outfit.name);
    }
    setEditing(false);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="aspect-square overflow-hidden bg-black">
        {url && (
          <img
            src={url}
            alt={outfit.name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(outfit.name);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded bg-zinc-800 px-2 py-0.5 text-sm text-white outline-none ring-1 ring-zinc-600 focus:ring-zinc-400"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="min-w-0 flex-1 truncate text-left text-sm text-zinc-200 hover:text-white"
            title="Click to rename"
          >
            {outfit.name}
          </button>
        )}

        <button
          onClick={() => onDelete(outfit.id)}
          className="shrink-0 rounded-md p-1 text-zinc-500 opacity-0 transition-all hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
          title="Delete"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function WardrobePage() {
  const user = useUser();
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const all = await getAllOutfits(user.id);
    setOutfits(all);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!imageFiles.length) return;

    for (const file of imageFiles) {
      const name = file.name.replace(/\.[^.]+$/, "");
      await saveOutfit(user.id, name, file);
    }
    await load();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteOutfit(user.id, id);
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  const handleRename = async (id: string, name: string) => {
    if (!user) return;
    await renameOutfit(user.id, id, name);
    setOutfits((prev) =>
      prev.map((o) => (o.id === id ? { ...o, name } : o)),
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 p-8 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wardrobe</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Upload outfit grids to dress your characters in scenes
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-10 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
          >
            <svg
              className="h-6 w-6"
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
            Drop outfit images here or click to upload
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          </div>
        ) : outfits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <svg
              className="h-12 w-12 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <p className="text-sm text-zinc-500">
              No outfits yet. Upload some outfit grids to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {outfits.map((o) => (
              <OutfitCard
                key={o.id}
                outfit={o}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
