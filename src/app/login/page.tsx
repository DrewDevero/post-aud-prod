"use client";

import { useRouter } from "next/navigation";
import { COOKIE_NAME, TEST_USERS, type User } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const login = (user: User) => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400; SameSite=Lax`;
    router.push("/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-6 text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Scene Placer</h1>
          <p className="mt-1 text-sm text-zinc-400">Choose a test profile</p>
        </div>

        <div className="grid gap-3">
          {TEST_USERS.map((user) => (
            <button
              key={user.id}
              onClick={() => login(user)}
              className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold">
                {user.name.slice(-1)}
              </div>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-zinc-500">{user.id}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
