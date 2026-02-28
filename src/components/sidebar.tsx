"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { COOKIE_NAME } from "@/lib/auth";
import { FriendsPanel } from "@/components/friends-panel";
import { NotificationBell } from "@/components/notification-bell";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Sequence",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
        />
      </svg>
    ),
  },
  {
    href: "/crew",
    label: "Cast & Crew",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
        />
      </svg>
    ),
  },
  {
    href: "/wardrobe",
    label: "Wardrobe",
    icon: (
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
        />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    // Initial load from storage
    const stored = localStorage.getItem("lastRoomId");
    if (stored) setActiveRoomId(stored);
  }, []);

  useEffect(() => {
    const match = pathname.match(/\/room\/([^/]+)/);
    if (match) {
      const roomId = match[1];
      setActiveRoomId(roomId);
      localStorage.setItem("lastRoomId", roomId);
    }
  }, [pathname]);

  const logout = () => {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    router.push("/login");
  };

  return (
    <>
      <aside className="flex h-dvh w-48 shrink-0 flex-col border-r border-border bg-background">
        <div className="px-4 py-6">
          <h2 className="text-xs font-black tracking-[0.2em] text-accent uppercase">
            Studio
          </h2>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const href = item.href === "/" && activeRoomId ? `/room/${activeRoomId}` : item.href;
            const active =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/room")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-colors ${active
                  ? "bg-surface text-accent"
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
                  }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={() => setFriendsOpen(true)}
            className={`flex items-center gap-2.5 rounded px-3 py-2 text-[13px] font-medium transition-colors text-muted hover:bg-surface-hover hover:text-foreground ${friendsOpen ? "bg-surface text-accent" : ""}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            Friends
          </button>
        </nav>

        {user && (
          <div className="border-t border-border px-2 py-4 space-y-3">
            <div className="flex items-center justify-between px-2">
              <NotificationBell />
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface border border-border text-[10px] font-bold text-foreground">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                <button
                  onClick={logout}
                  className="text-[10px] text-muted hover:text-accent uppercase tracking-wider"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <FriendsPanel open={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  );
}
