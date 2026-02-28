import { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import {
  getFriendsState,
  subscribeUser,
  unsubscribeUser,
} from "@/lib/friends-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userCookie = req.cookies.get(COOKIE_NAME);
  if (!userCookie) {
    return new Response("Not authenticated", { status: 401 });
  }
  const user = JSON.parse(userCookie.value) as { id: string; name: string };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const state = getFriendsState(user.id);
      controller.enqueue(
        encoder.encode(`event: friends\ndata: ${JSON.stringify(state)}\n\n`),
      );

      const listener = (_event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: friends\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* closed */
        }
      };

      subscribeUser(user.id, listener);

      req.signal.addEventListener("abort", () => {
        unsubscribeUser(user.id, listener);
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
