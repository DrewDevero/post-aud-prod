"use client";

import { useState, useEffect } from "react";
import { COOKIE_NAME, type User } from "@/lib/auth";

export function useUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (match) {
      try {
        const value = decodeURIComponent(match.split("=").slice(1).join("="));
        setUser(JSON.parse(value));
      } catch {
        /* invalid cookie */
      }
    }
  }, []);

  return user;
}
