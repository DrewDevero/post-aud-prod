"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";

export default function Home() {
  const router = useRouter();
  const user = useUser();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const createRoom = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const { roomId } = await res.json();
      router.push(`/room/${roomId}`);
    } catch {
      setCreating(false);
    }
  }, [router]);

  const joinRoom = useCallback(async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoinError(null);

    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      setJoinError("Room not found");
      return;
    }
    router.push(`/room/${code}`);
  }, [joinCode, router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 p-8 text-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Scene Placer</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Create or join a room to collaborate live
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Logged in as <span className="text-zinc-400">{user.name}</span>
          </p>
        </div>

        <button
          onClick={createRoom}
          disabled={creating}
          className="w-full rounded-2xl bg-white py-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
        >
          {creating ? "Creating\u2026" : "Create Room"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">or join existing</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value);
              setJoinError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="Enter room code"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
          {joinError && (
            <p className="text-xs text-red-400">{joinError}</p>
          )}
          <button
            onClick={joinRoom}
            disabled={!joinCode.trim()}
            className={`w-full rounded-xl py-3 text-sm font-semibold transition-opacity ${
              joinCode.trim()
                ? "bg-zinc-800 text-white hover:bg-zinc-700"
                : "cursor-not-allowed bg-zinc-900 text-zinc-600"
            }`}
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
