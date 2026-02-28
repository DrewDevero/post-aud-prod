"use client";

import { useState, useEffect } from "react";

interface FriendsState {
  friends: { id: string; name: string }[];
  pendingRequests: { fromUserId: string; fromUserName: string }[];
  sentRequests: { toUserId: string; toUserName: string }[];
}

export function useFriends() {
  const [state, setState] = useState<FriendsState>({
    friends: [],
    pendingRequests: [],
    sentRequests: [],
  });

  useEffect(() => {
    const es = new EventSource("/api/friends/events");

    es.addEventListener("friends", (e) => {
      setState(JSON.parse(e.data));
    });

    es.onerror = () => {
      /* reconnects automatically */
    };

    return () => es.close();
  }, []);

  return state;
}
