import { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  serializeRoom,
  subscribe,
  unsubscribe,
} from "@/lib/room-store";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  const userCookie = req.cookies.get(COOKIE_NAME);
  if (!userCookie) {
    return new Response("Not authenticated", { status: 401 });
  }
  const user = JSON.parse(userCookie.value) as { id: string; name: string };

  joinRoom(roomId, user);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const state = serializeRoom(room);
      controller.enqueue(
        encoder.encode(`event: update\ndata: ${JSON.stringify(state)}\n\n`),
      );

      const listener = (_event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };

      subscribe(roomId, listener);

      req.signal.addEventListener("abort", () => {
        unsubscribe(roomId, listener);
        leaveRoom(roomId, user.id);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
