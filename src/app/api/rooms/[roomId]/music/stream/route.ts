import { NextRequest } from "next/server";
import { getRoom } from "@/lib/room-store";
import {
  subscribeAudio,
  unsubscribeAudio,
  subscribeState,
  unsubscribeState,
  type MusicState,
} from "@/lib/music-session";

export const dynamic = "force-dynamic";

const PREFIX = "[music-stream]";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return new Response("Room not found", { status: 404 });
  }

  console.log(PREFIX, `new connection room=${roomId}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const audioListener = (base64: string) => {
        try {
          controller.enqueue(
            encoder.encode(`event: audio\ndata: ${base64}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };

      const stateListener = (state: MusicState) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: music-state\ndata: ${JSON.stringify(state)}\n\n`,
            ),
          );
        } catch {
          /* stream closed */
        }
      };

      subscribeAudio(roomId, audioListener);
      subscribeState(roomId, stateListener);

      req.signal.addEventListener("abort", () => {
        console.log(PREFIX, `connection closed room=${roomId}`);
        unsubscribeAudio(roomId, audioListener);
        unsubscribeState(roomId, stateListener);
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
