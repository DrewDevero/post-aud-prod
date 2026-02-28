"use client";

import { useState, useEffect } from "react";

export interface NotificationItem {
  id: string;
  userId: string;
  type: "room-invite" | "friend-request";
  fromUserId: string;
  fromUserName: string;
  roomId?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/notifications/events");

    es.addEventListener("notifications", (e) => {
      setNotifications(JSON.parse(e.data));
    });

    es.onerror = () => {
      /* reconnects automatically */
    };

    return () => es.close();
  }, []);

  return notifications;
}
