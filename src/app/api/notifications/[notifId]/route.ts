import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { respondToNotification } from "@/lib/notification-store";

function getUser(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  try {
    return JSON.parse(cookie.value) as { id: string; name: string };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ notifId: string }> },
) {
  const user = getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { notifId } = await params;
  const { action } = (await req.json()) as { action: "accept" | "decline" };

  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const response = action === "accept" ? "accepted" : "declined";
  const notif = respondToNotification(notifId, user.id, response);

  if (!notif) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({ notif });
}
