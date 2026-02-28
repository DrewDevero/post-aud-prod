import { NextRequest, NextResponse } from "next/server";
import { getRoom, setMusic } from "@/lib/room-store";
import {
  startMusic,
  pauseMusic,
  resumeMusic,
  stopMusic,
  updatePrompts,
  updateConfig,
  getMusicState,
  type MusicConfig,
} from "@/lib/music-session";

const PREFIX = "[api/music]";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action } = body as { action: string };
  console.log(PREFIX, `POST room=${roomId} action=${action}`, body);

  let state;

  switch (action) {
    case "play": {
      const { prompts, config } = body as {
        prompts: Array<{ text: string; weight: number }>;
        config?: MusicConfig;
      };
      if (!prompts?.length) {
        console.log(PREFIX, `rejected: no prompts provided`);
        return NextResponse.json(
          { error: "At least one prompt is required" },
          { status: 400 },
        );
      }
      state = await startMusic(roomId, prompts, config ?? {});
      break;
    }

    case "pause":
      state = await pauseMusic(roomId);
      break;

    case "resume":
      state = await resumeMusic(roomId);
      break;

    case "stop":
      state = await stopMusic(roomId);
      break;

    case "setPrompts": {
      const { prompts } = body as {
        prompts: Array<{ text: string; weight: number }>;
      };
      if (!prompts?.length) {
        return NextResponse.json(
          { error: "At least one prompt is required" },
          { status: 400 },
        );
      }
      state = await updatePrompts(roomId, prompts);
      break;
    }

    case "setConfig": {
      const { config, resetContext } = body as {
        config: MusicConfig;
        resetContext?: boolean;
      };
      state = await updateConfig(roomId, config, resetContext ?? false);
      break;
    }

    default:
      console.log(PREFIX, `unknown action: ${action}`);
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  setMusic(roomId, state);
  console.log(PREFIX, `room=${roomId} action=${action} result:`, state);
  return NextResponse.json({ music: state });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({ music: getMusicState(roomId) });
}
