"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import {
  getAllCharacters,
  saveCharacter,
  deleteCharacter,
  renameCharacter,
  type SavedCharacter,
} from "@/lib/character-store";

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

function CharacterCard({
  character,
  onDelete,
  onRename,
}: {
  character: SavedCharacter;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const url = useBlobUrl(character.blob);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(character.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== character.name) {
      onRename(character.id, trimmed);
    } else {
      setDraft(character.name);
    }
    setEditing(false);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="aspect-square overflow-hidden bg-black">
        {url && (
          <img
            src={url}
            alt={character.name}
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
                setDraft(character.name);
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
            {character.name}
          </button>
        )}

        <button
          onClick={() => onDelete(character.id)}
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

export default function CrewPage() {
  const user = useUser();
  const [characters, setCharacters] = useState<SavedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const all = await getAllCharacters(user.id);
    setCharacters(all);
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
      await saveCharacter(user.id, name, file);
    }
    await load();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteCharacter(user.id, id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRename = async (id: string, name: string) => {
    if (!user) return;
    await renameCharacter(user.id, id, name);
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
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
          <h1 className="text-2xl font-bold tracking-tight">Character Crew</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Add characters here, then pick them in a room
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
            Drop images here or click to upload
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
          </div>
        ) : characters.length === 0 ? (
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
                d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <p className="text-sm text-zinc-500">
              No characters yet. Upload some images to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
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
