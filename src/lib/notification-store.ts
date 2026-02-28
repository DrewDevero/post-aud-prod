type Listener = (event: string, data: unknown) => void;

export interface Notification {
  id: string;
  userId: string;
  type: "room-invite" | "friend-request";
  fromUserId: string;
  fromUserName: string;
  roomId?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

const globalForNotifs = globalThis as unknown as {
  __notifications?: Notification[];
  __notifListeners?: Map<string, Set<Listener>>;
};

const notifications = (globalForNotifs.__notifications ??= []);
const notifListeners = (globalForNotifs.__notifListeners ??= new Map());

function getListeners(userId: string): Set<Listener> {
  let set = notifListeners.get(userId);
  if (!set) {
    set = new Set();
    notifListeners.set(userId, set);
  }
  return set;
}

export function createNotification(
  notif: Omit<Notification, "id" | "status" | "createdAt">,
): Notification {
  const n: Notification = {
    ...notif,
    id: crypto.randomUUID().slice(0, 8),
    status: "pending",
    createdAt: Date.now(),
  };
  notifications.push(n);
  broadcastUser(n.userId);
  return n;
}

export function getNotifications(userId: string) {
  return notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getPendingNotifications(userId: string) {
  return getNotifications(userId).filter((n) => n.status === "pending");
}

export function respondToNotification(
  notifId: string,
  userId: string,
  response: "accepted" | "declined",
): Notification | null {
  const notif = notifications.find(
    (n) => n.id === notifId && n.userId === userId && n.status === "pending",
  );
  if (!notif) return null;
  notif.status = response;
  broadcastUser(userId);
  return notif;
}

export function subscribeNotifications(userId: string, listener: Listener) {
  getListeners(userId).add(listener);
}

export function unsubscribeNotifications(userId: string, listener: Listener) {
  getListeners(userId).delete(listener);
}

function broadcastUser(userId: string) {
  const pending = getPendingNotifications(userId);
  for (const listener of getListeners(userId)) {
    try {
      listener("notifications", pending);
    } catch {
      /* closed */
    }
  }
}
