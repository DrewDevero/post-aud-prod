"use client";

import { useState, useEffect, useCallback } from "react";
import { useFriends } from "@/hooks/use-friends";
import { useUser } from "@/hooks/use-user";

interface AvailableUser {
  id: string;
  name: string;
}

export function FriendsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUser();
  const { friends, pendingRequests, sentRequests } = useFriends();
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setAllUsers(d.users));
  }, []);

  const addableUsers = allUsers.filter(
    (u) =>
      u.id !== user?.id &&
      !friends.some((f) => f.id === u.id) &&
      !sentRequests.some((s) => s.toUserId === u.id) &&
      !pendingRequests.some((p) => p.fromUserId === u.id),
  );

  const sendRequest = useCallback(async (toUserId: string) => {
    setLoading(toUserId);
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId }),
    });
    setLoading(null);
  }, []);

  const respond = useCallback(async (fromUserId: string, action: "accept" | "decline") => {
    setLoading(fromUserId);
    await fetch(`/api/friends/${fromUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
  }, []);

  const removeFriend = useCallback(async (friendId: string) => {
    setLoading(friendId);
    await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
    setLoading(null);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-48 w-72 h-full bg-background border-r border-border flex flex-col animate-in slide-in-from-left-2 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-accent">
            Friends
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

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted/50">
                Incoming Requests
              </h3>
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.fromUserId}
                    className="flex items-center gap-3 rounded border border-accent/20 bg-accent/5 p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-black text-accent">
                      {req.fromUserName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-foreground truncate">
                        {req.fromUserName}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => respond(req.fromUserId, "accept")}
                        disabled={loading === req.fromUserId}
                        className="rounded bg-accent px-2 py-1 text-[9px] font-black uppercase text-background hover:bg-accent/80 transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(req.fromUserId, "decline")}
                        disabled={loading === req.fromUserId}
                        className="rounded border border-border px-2 py-1 text-[9px] font-black uppercase text-muted hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends List */}
          <section className="space-y-3">
            <h3 className="text-[9px] font-black uppercase tracking-widest text-muted/50">
              Your Friends
            </h3>
            {friends.length === 0 ? (
              <p className="text-[10px] text-muted italic">No friends yet</p>
            ) : (
              <div className="space-y-1.5">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center gap-3 rounded border border-border bg-surface/30 p-2.5 hover:border-border/80 transition-colors"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface border border-border text-[10px] font-black text-foreground">
                      {f.name.slice(0, 1).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[11px] font-bold text-foreground truncate">
                      {f.name}
                    </p>
                    <button
                      onClick={() => removeFriend(f.id)}
                      disabled={loading === f.id}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sent Requests */}
          {sentRequests.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted/50">
                Sent Requests
              </h3>
              <div className="space-y-1.5">
                {sentRequests.map((s) => (
                  <div
                    key={s.toUserId}
                    className="flex items-center gap-3 rounded border border-border bg-surface/30 p-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface border border-border text-[10px] font-black text-muted">
                      {s.toUserName.slice(0, 1).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[11px] font-medium text-muted truncate">
                      {s.toUserName}
                    </p>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-muted/50">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Add Friends */}
          {addableUsers.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted/50">
                Add Friends
              </h3>
              <div className="space-y-1.5">
                {addableUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded border border-border/50 bg-surface/20 p-2.5"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface border border-border text-[10px] font-black text-muted/70">
                      {u.name.slice(0, 1).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[11px] font-medium text-muted truncate">
                      {u.name}
                    </p>
                    <button
                      onClick={() => sendRequest(u.id)}
                      disabled={loading === u.id}
                      className="rounded border border-accent/30 px-2.5 py-1 text-[9px] font-black uppercase text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
