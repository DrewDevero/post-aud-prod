type Listener = (event: string, data: unknown) => void;

export interface RoomCharacter {
  id: string;
  name: string;
  imageUrl: string;
  userId: string;
  userName: string;
}

export interface RoomOutfit {
  id: string;
  name: string;
  imageUrl: string;
  userId: string;
  userName: string;
}

export interface PipelineStatus {
  imageDone: boolean;
  videoDone: boolean;
  imageUrl?: string;
  videoUrl?: string;
}

export interface RoomGeneration {
  stage:
    | "generating-images"
    | "generating-videos"
    | "merging"
    | "done"
    | "error";
  pipelines: PipelineStatus[];
  mergedVideoUrl?: string;
  error?: string;
}

interface Room {
  id: string;
  members: Map<string, { id: string; name: string }>;
  characters: RoomCharacter[];
  outfits: RoomOutfit[];
  generation: RoomGeneration | null;
  listeners: Set<Listener>;
}

const globalForRooms = globalThis as unknown as {
  __rooms?: Map<string, Room>;
};
const rooms = (globalForRooms.__rooms ??= new Map<string, Room>());

export function createRoom(): string {
  const id = crypto.randomUUID().slice(0, 8);
  rooms.set(id, {
    id,
    members: new Map(),
    characters: [],
    outfits: [],
    generation: null,
    listeners: new Set(),
  });
  return id;
}

export function getRoom(id: string) {
  return rooms.get(id) ?? null;
}

export function roomExists(id: string) {
  return rooms.has(id);
}

export function joinRoom(
  roomId: string,
  user: { id: string; name: string },
) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.members.set(user.id, user);
  broadcast(roomId);
  return true;
}

export function leaveRoom(roomId: string, userId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.members.delete(userId);
  broadcast(roomId);
}

export function addCharacter(roomId: string, character: RoomCharacter) {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (
    room.characters.some(
      (c) => c.id === character.id && c.userId === character.userId,
    )
  )
    return true;
  room.characters.push(character);
  broadcast(roomId);
  return true;
}

export function removeCharacter(
  roomId: string,
  characterId: string,
  userId: string,
) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.characters = room.characters.filter(
    (c) => !(c.id === characterId && c.userId === userId),
  );
  broadcast(roomId);
}

export function addOutfit(roomId: string, outfit: RoomOutfit) {
  const room = rooms.get(roomId);
  if (!room) return false;
  if (
    room.outfits.some(
      (o) => o.id === outfit.id && o.userId === outfit.userId,
    )
  )
    return true;
  room.outfits.push(outfit);
  broadcast(roomId);
  return true;
}

export function removeOutfit(
  roomId: string,
  outfitId: string,
  userId: string,
) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.outfits = room.outfits.filter(
    (o) => !(o.id === outfitId && o.userId === userId),
  );
  broadcast(roomId);
}

export function setGeneration(
  roomId: string,
  generation: RoomGeneration | null,
) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.generation = generation;
  broadcast(roomId);
}

export function updatePipeline(
  roomId: string,
  index: number,
  update: Partial<PipelineStatus>,
) {
  const room = rooms.get(roomId);
  if (!room || !room.generation) return;
  room.generation.pipelines[index] = {
    ...room.generation.pipelines[index],
    ...update,
  };
  broadcast(roomId);
}

export function subscribe(roomId: string, listener: Listener) {
  const room = rooms.get(roomId);
  if (room) room.listeners.add(listener);
}

export function unsubscribe(roomId: string, listener: Listener) {
  const room = rooms.get(roomId);
  if (room) room.listeners.delete(listener);
}

function broadcast(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = serializeRoom(room);
  for (const listener of room.listeners) {
    try {
      listener("update", data);
    } catch {
      /* stream may have closed */
    }
  }
}

export function serializeRoom(room: Room) {
  return {
    id: room.id,
    members: Array.from(room.members.values()),
    characters: room.characters,
    outfits: room.outfits,
    generation: room.generation,
  };
}

export type SerializedRoom = ReturnType<typeof serializeRoom>;
