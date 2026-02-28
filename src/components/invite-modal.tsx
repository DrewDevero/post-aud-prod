"use client";

import { useState, useCallback } from "react";
import { useFriends } from "@/hooks/use-friends";

export function InviteModal({
  roomId,
  open,
  onClose,
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { friends } = useFriends();
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const invite = useCallback(
    async (friendId: string) => {
      setSending(friendId);
      await fetch(`/api/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      setInvitedIds((prev) => new Set(prev).add(friendId));
      setSending(null);
    },
    [roomId],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-80 rounded border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-accent">
            Invite to Sequence
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {friends.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-[10px] text-muted italic">No friends to invite</p>
              <p className="text-[9px] text-muted/50">
                Add friends from the sidebar first
              </p>
            </div>
          ) : (
            friends.map((f) => {
              const invited = invitedIds.has(f.id);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded border border-border bg-surface/30 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface border border-border text-[11px] font-black text-foreground">
                    {f.name.slice(0, 1).toUpperCase()}
                  </div>
                  <p className="flex-1 text-[12px] font-bold text-foreground truncate">
                    {f.name}
                  </p>
                  {invited ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-green-500">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                      Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => invite(f.id)}
                      disabled={sending === f.id}
                      className="rounded bg-accent px-3 py-1.5 text-[9px] font-black uppercase text-background hover:bg-accent/80 transition-colors disabled:opacity-50"
                    >
                      {sending === f.id ? "..." : "Invite"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border">
          <p className="text-[9px] text-muted/50 text-center uppercase tracking-wider">
            Sequence <span className="text-accent font-mono">{roomId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
