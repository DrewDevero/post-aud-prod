"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";

export function NotificationBell() {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const respond = useCallback(
    async (notif: NotificationItem, action: "accept" | "decline") => {
      await fetch(`/api/notifications/${notif.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (action === "accept" && notif.type === "room-invite" && notif.roomId) {
        router.push(`/room/${notif.roomId}`);
      }
    },
    [router],
  );

  const count = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded border border-border text-muted hover:text-foreground hover:border-muted transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[8px] font-black text-background animate-pulse">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded border border-border bg-background shadow-2xl">
            <div className="p-3 border-b border-border">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                Notifications
              </h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-[10px] text-muted italic">No new notifications</p>
                </div>
              ) : (
                <div className="p-2 space-y-1.5">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="rounded border border-accent/20 bg-accent/5 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[9px] font-black text-accent mt-0.5">
                          {notif.fromUserName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-foreground">
                            {notif.fromUserName}
                          </p>
                          <p className="text-[10px] text-muted">
                            {notif.type === "room-invite"
                              ? `Invited you to sequence ${notif.roomId}`
                              : "Sent you a friend request"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 pl-8">
                        <button
                          onClick={() => respond(notif, "accept")}
                          className="rounded bg-accent px-3 py-1 text-[9px] font-black uppercase text-background hover:bg-accent/80 transition-colors"
                        >
                          {notif.type === "room-invite" ? "Join" : "Accept"}
                        </button>
                        <button
                          onClick={() => respond(notif, "decline")}
                          className="rounded border border-border px-3 py-1 text-[9px] font-black uppercase text-muted hover:text-foreground transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
