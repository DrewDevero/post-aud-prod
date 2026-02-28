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
      setJoinError("Sequence not found");
      return;
    }
    router.push(`/room/${code}`);
  }, [joinCode, router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-4 w-4 animate-spin rounded border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8 text-foreground selection:bg-accent/30">
      <div className="w-full max-w-[280px] space-y-10">
        <div className="space-y-2 text-center">
          <h1 className="text-xs font-black tracking-[0.3em] text-accent uppercase">
            New Sequence
          </h1>
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider">
            Collaboration Engine v2.0
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={createRoom}
            disabled={creating}
            className="group relative w-full overflow-hidden rounded bg-foreground px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.1em] text-background transition-all hover:bg-white active:scale-[0.98] disabled:opacity-50"
          >
            <span className="relative z-10">
              {creating ? "Initializing..." : "Create Sequence"}
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <div className="relative group">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="SEQUENCE_ID"
                className="w-full rounded border border-border bg-surface px-4 py-3 text-center font-mono text-sm tracking-widest text-foreground placeholder:text-muted/50 outline-none transition-colors focus:border-accent/50"
              />
            </div>
            {joinError && (
              <p className="text-center text-[10px] font-bold text-red-500 uppercase tracking-tight">
                {joinError}
              </p>
            )}
            <button
              onClick={joinRoom}
              disabled={!joinCode.trim()}
              className={`w-full rounded border border-border py-3 text-[11px] font-black uppercase tracking-[0.1em] transition-all ${joinCode.trim()
                ? "bg-surface text-foreground hover:bg-surface-hover hover:border-accent/30"
                : "cursor-not-allowed text-muted/30"
                }`}
            >
              Join Sequence
            </button>
          </div>
        </div>

        <div className="pt-4 text-center">
          <p className="text-[10px] font-medium text-muted/50 uppercase tracking-widest">
            Signed in as <span className="text-muted">{user.name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
