import { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import {
  getPendingNotifications,
  subscribeNotifications,
  unsubscribeNotifications,
} from "@/lib/notification-store";

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
      const pending = getPendingNotifications(user.id);
      controller.enqueue(
        encoder.encode(
          `event: notifications\ndata: ${JSON.stringify(pending)}\n\n`,
        ),
      );

      const listener = (_event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: notifications\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          /* closed */
        }
      };

      subscribeNotifications(user.id, listener);

      req.signal.addEventListener("abort", () => {
        unsubscribeNotifications(user.id, listener);
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
