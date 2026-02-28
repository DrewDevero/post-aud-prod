type Listener = (event: string, data: unknown) => void;

export interface FriendRequest {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: "pending" | "accepted";
  createdAt: number;
}

const globalForFriends = globalThis as unknown as {
  __friendRequests?: FriendRequest[];
  __userListeners?: Map<string, Set<Listener>>;
};

const friendRequests = (globalForFriends.__friendRequests ??= []);
const userListeners = (globalForFriends.__userListeners ??= new Map());

function getListeners(userId: string): Set<Listener> {
  let set = userListeners.get(userId);
  if (!set) {
    set = new Set();
    userListeners.set(userId, set);
  }
  return set;
}

export function sendFriendRequest(
  from: { id: string; name: string },
  to: { id: string; name: string },
): "sent" | "already_friends" | "already_pending" | "self" {
  if (from.id === to.id) return "self";

  const existing = friendRequests.find(
    (r) =>
      (r.fromUserId === from.id && r.toUserId === to.id) ||
      (r.fromUserId === to.id && r.toUserId === from.id),
  );

  if (existing?.status === "accepted") return "already_friends";
  if (existing?.status === "pending") return "already_pending";

  friendRequests.push({
    fromUserId: from.id,
    fromUserName: from.name,
    toUserId: to.id,
    toUserName: to.name,
    status: "pending",
    createdAt: Date.now(),
  });

  broadcastUser(to.id);
  return "sent";
}

export function acceptFriendRequest(
  userId: string,
  fromUserId: string,
): boolean {
  const req = friendRequests.find(
    (r) =>
      r.fromUserId === fromUserId &&
      r.toUserId === userId &&
      r.status === "pending",
  );
  if (!req) return false;
  req.status = "accepted";
  broadcastUser(userId);
  broadcastUser(fromUserId);
  return true;
}

export function declineFriendRequest(
  userId: string,
  fromUserId: string,
): boolean {
  const idx = friendRequests.findIndex(
    (r) =>
      r.fromUserId === fromUserId &&
      r.toUserId === userId &&
      r.status === "pending",
  );
  if (idx === -1) return false;
  friendRequests.splice(idx, 1);
  broadcastUser(userId);
  return true;
}

export function removeFriend(userId: string, friendId: string): boolean {
  const idx = friendRequests.findIndex(
    (r) =>
      ((r.fromUserId === userId && r.toUserId === friendId) ||
        (r.fromUserId === friendId && r.toUserId === userId)) &&
      r.status === "accepted",
  );
  if (idx === -1) return false;
  friendRequests.splice(idx, 1);
  broadcastUser(userId);
  broadcastUser(friendId);
  return true;
}

export function getFriends(userId: string) {
  return friendRequests
    .filter(
      (r) =>
        r.status === "accepted" &&
        (r.fromUserId === userId || r.toUserId === userId),
    )
    .map((r) =>
      r.fromUserId === userId
        ? { id: r.toUserId, name: r.toUserName }
        : { id: r.fromUserId, name: r.fromUserName },
    );
}

export function getPendingRequests(userId: string) {
  return friendRequests.filter(
    (r) => r.toUserId === userId && r.status === "pending",
  );
}

export function getSentRequests(userId: string) {
  return friendRequests.filter(
    (r) => r.fromUserId === userId && r.status === "pending",
  );
}

export function getFriendsState(userId: string) {
  return {
    friends: getFriends(userId),
    pendingRequests: getPendingRequests(userId).map((r) => ({
      fromUserId: r.fromUserId,
      fromUserName: r.fromUserName,
    })),
    sentRequests: getSentRequests(userId).map((r) => ({
      toUserId: r.toUserId,
      toUserName: r.toUserName,
    })),
  };
}

export function subscribeUser(userId: string, listener: Listener) {
  getListeners(userId).add(listener);
}

export function unsubscribeUser(userId: string, listener: Listener) {
  getListeners(userId).delete(listener);
}

function broadcastUser(userId: string) {
  const state = getFriendsState(userId);
  for (const listener of getListeners(userId)) {
    try {
      listener("friends", state);
    } catch {
      /* closed */
    }
  }
}
