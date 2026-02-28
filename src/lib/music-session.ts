import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY!,
  apiVersion: "v1alpha",
});

const PREFIX = "[lyria]";
function log(...args: unknown[]) {
  console.log(PREFIX, ...args);
}
function logError(...args: unknown[]) {
  console.error(PREFIX, ...args);
}

export interface MusicState {
  status: "idle" | "connecting" | "playing" | "paused" | "stopped" | "error";
  prompts: Array<{ text: string; weight: number }>;
  config: MusicConfig;
  error?: string;
}

export interface MusicConfig {
  bpm?: number;
  temperature?: number;
  density?: number;
  brightness?: number;
  scale?: string;
}

type AudioListener = (base64: string) => void;
type StateListener = (state: MusicState) => void;

interface RoomMusicSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  state: MusicState;
  audioListeners: Set<AudioListener>;
  stateListeners: Set<StateListener>;
}

const globalForMusic = globalThis as unknown as {
  __musicSessions?: Map<string, RoomMusicSession>;
};
const sessions = (globalForMusic.__musicSessions ??= new Map<
  string,
  RoomMusicSession
>());

function broadcastState(roomId: string) {
  const s = sessions.get(roomId);
  if (!s) return;
  const snapshot = { ...s.state };
  for (const listener of s.stateListeners) {
    try {
      listener(snapshot);
    } catch {
      /* listener may have closed */
    }
  }
}

function broadcastAudio(roomId: string, base64: string) {
  const s = sessions.get(roomId);
  if (!s) return;
  for (const listener of s.audioListeners) {
    try {
      listener(base64);
    } catch {
      /* listener may have closed */
    }
  }
}

export function getMusicState(roomId: string): MusicState {
  return (
    sessions.get(roomId)?.state ?? {
      status: "idle",
      prompts: [],
      config: {},
    }
  );
}

export function subscribeAudio(roomId: string, listener: AudioListener) {
  const s = ensureSession(roomId);
  s.audioListeners.add(listener);
  log(`subscribeAudio: room=${roomId} listeners=${s.audioListeners.size}`);
}

export function unsubscribeAudio(roomId: string, listener: AudioListener) {
  const s = sessions.get(roomId);
  if (s) {
    s.audioListeners.delete(listener);
    log(`unsubscribeAudio: room=${roomId} listeners=${s.audioListeners.size}`);
  }
}

export function subscribeState(roomId: string, listener: StateListener) {
  const s = ensureSession(roomId);
  s.stateListeners.add(listener);
}

export function unsubscribeState(roomId: string, listener: StateListener) {
  const s = sessions.get(roomId);
  if (s) s.stateListeners.delete(listener);
}

function ensureSession(roomId: string): RoomMusicSession {
  let s = sessions.get(roomId);
  if (!s) {
    s = {
      session: null,
      state: { status: "idle", prompts: [], config: {} },
      audioListeners: new Set(),
      stateListeners: new Set(),
    };
    sessions.set(roomId, s);
  }
  return s;
}

export async function startMusic(
  roomId: string,
  prompts: Array<{ text: string; weight: number }>,
  config: MusicConfig,
): Promise<MusicState> {
  const s = ensureSession(roomId);

  if (s.session) {
    log(`startMusic: room=${roomId} session already exists, stopping old one`);
    try {
      await s.session.close();
    } catch (err) {
      logError(`startMusic: error closing old session`, err);
    }
    s.session = null;
  }

  s.state = { status: "connecting", prompts, config };
  broadcastState(roomId);
  log(`startMusic: room=${roomId} connecting`, { prompts, config });

  let chunkCount = 0;

  try {
    const session = await client.live.music.connect({
      model: "models/lyria-realtime-exp",
      callbacks: {
        onopen: () => {
          log(`onopen: room=${roomId} WebSocket opened`);
        },
        onmessage: (message: Record<string, unknown>) => {
          if (chunkCount === 0) {
            log(
              `onmessage: room=${roomId} first message keys=${Object.keys(message).join(",")}`,
              JSON.stringify(message).slice(0, 500),
            );
          }

          const sc = message.serverContent as
            | {
                audioChunks?: Array<{ data: string }>;
                filteredPrompt?: string;
              }
            | undefined;

          if (sc?.filteredPrompt) {
            log(
              `onmessage: room=${roomId} prompt filtered: ${sc.filteredPrompt}`,
            );
          }

          if (sc?.audioChunks) {
            for (const chunk of sc.audioChunks) {
              chunkCount++;
              if (chunkCount <= 3 || chunkCount % 100 === 0) {
                log(
                  `onmessage: room=${roomId} audio chunk #${chunkCount}, size=${chunk.data.length} chars b64, listeners=${s.audioListeners.size}`,
                );
              }
              broadcastAudio(roomId, chunk.data);
            }
          } else if (!sc) {
            log(
              `onmessage: room=${roomId} non-audio message:`,
              JSON.stringify(message).slice(0, 500),
            );
          }
        },
        onerror: (e: unknown) => {
          const evt = e as { message?: string; error?: unknown };
          logError(
            `onerror: room=${roomId}`,
            evt.message ?? evt.error ?? e,
          );
          s.state = {
            ...s.state,
            status: "error",
            error:
              evt.message ??
              (e instanceof Error ? e.message : String(e)),
          };
          broadcastState(roomId);
        },
        onclose: (e: unknown) => {
          const evt = e as { code?: number; reason?: string };
          log(
            `onclose: room=${roomId} code=${evt.code} reason="${evt.reason ?? ""}" chunks=${chunkCount}`,
          );
          if (s.state.status !== "error") {
            s.state = { ...s.state, status: "stopped" };
            broadcastState(roomId);
          }
          s.session = null;
        },
      },
    });

    s.session = session;
    log(`startMusic: room=${roomId} connected, setting prompts and config`);

    await session.setWeightedPrompts({
      weightedPrompts: prompts,
    });
    log(`startMusic: room=${roomId} prompts set`, prompts);

    const musicGenConfig: Record<string, unknown> = {
      temperature: config.temperature ?? 1.0,
      audioFormat: "pcm16",
      sampleRateHz: 48000,
    };
    if (config.bpm != null) musicGenConfig.bpm = config.bpm;
    if (config.density != null) musicGenConfig.density = config.density;
    if (config.brightness != null) musicGenConfig.brightness = config.brightness;
    if (config.scale) musicGenConfig.scale = config.scale;

    await session.setMusicGenerationConfig({
      musicGenerationConfig: musicGenConfig,
    });
    log(`startMusic: room=${roomId} config set`, musicGenConfig);

    await session.play();
    log(`startMusic: room=${roomId} playing`);

    s.state = { status: "playing", prompts, config };
    broadcastState(roomId);
    return s.state;
  } catch (err) {
    logError(`startMusic: room=${roomId} FAILED`, err);
    s.state = {
      status: "error",
      prompts,
      config,
      error: err instanceof Error ? err.message : String(err),
    };
    s.session = null;
    broadcastState(roomId);
    return s.state;
  }
}

export async function pauseMusic(roomId: string): Promise<MusicState> {
  const s = sessions.get(roomId);
  if (!s?.session) {
    log(`pauseMusic: room=${roomId} no active session`);
    return getMusicState(roomId);
  }

  log(`pauseMusic: room=${roomId}`);
  try {
    await s.session.pause();
    s.state = { ...s.state, status: "paused" };
    broadcastState(roomId);
  } catch (err) {
    logError(`pauseMusic: room=${roomId} FAILED`, err);
    s.state = {
      ...s.state,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    broadcastState(roomId);
  }
  return s.state;
}

export async function resumeMusic(roomId: string): Promise<MusicState> {
  const s = sessions.get(roomId);
  if (!s?.session) {
    log(`resumeMusic: room=${roomId} no active session`);
    return getMusicState(roomId);
  }

  log(`resumeMusic: room=${roomId}`);
  try {
    await s.session.play();
    s.state = { ...s.state, status: "playing" };
    broadcastState(roomId);
  } catch (err) {
    logError(`resumeMusic: room=${roomId} FAILED`, err);
    s.state = {
      ...s.state,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    broadcastState(roomId);
  }
  return s.state;
}

export async function stopMusic(roomId: string): Promise<MusicState> {
  const s = sessions.get(roomId);
  if (!s?.session) {
    log(`stopMusic: room=${roomId} no active session`);
    const ms = ensureSession(roomId);
    ms.state = { status: "idle", prompts: [], config: {} };
    broadcastState(roomId);
    return ms.state;
  }

  log(`stopMusic: room=${roomId}`);
  try {
    await s.session.close();
  } catch (err) {
    logError(`stopMusic: room=${roomId} error closing`, err);
  }
  s.session = null;
  s.state = { status: "idle", prompts: [], config: {} };
  broadcastState(roomId);
  return s.state;
}

export async function updatePrompts(
  roomId: string,
  prompts: Array<{ text: string; weight: number }>,
): Promise<MusicState> {
  const s = sessions.get(roomId);
  if (!s?.session) {
    log(`updatePrompts: room=${roomId} no active session`);
    return getMusicState(roomId);
  }

  log(`updatePrompts: room=${roomId}`, prompts);
  try {
    await s.session.setWeightedPrompts({
      weightedPrompts: prompts,
    });
    s.state = { ...s.state, prompts };
    broadcastState(roomId);
  } catch (err) {
    logError(`updatePrompts: room=${roomId} FAILED`, err);
    s.state = {
      ...s.state,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    broadcastState(roomId);
  }
  return s.state;
}

export async function updateConfig(
  roomId: string,
  config: MusicConfig,
  resetContext = false,
): Promise<MusicState> {
  const s = sessions.get(roomId);
  if (!s?.session) {
    log(`updateConfig: room=${roomId} no active session`);
    return getMusicState(roomId);
  }

  log(`updateConfig: room=${roomId} resetContext=${resetContext}`, config);
  try {
    const musicGenConfig: Record<string, unknown> = {
      temperature: config.temperature ?? 1.0,
      audioFormat: "pcm16",
      sampleRateHz: 48000,
    };
    if (config.bpm != null) musicGenConfig.bpm = config.bpm;
    if (config.density != null) musicGenConfig.density = config.density;
    if (config.brightness != null) musicGenConfig.brightness = config.brightness;
    if (config.scale) musicGenConfig.scale = config.scale;

    await s.session.setMusicGenerationConfig({
      musicGenerationConfig: musicGenConfig,
    });

    if (resetContext) {
      log(`updateConfig: room=${roomId} resetting context`);
      await s.session.resetContext();
    }

    s.state = { ...s.state, config };
    broadcastState(roomId);
  } catch (err) {
    logError(`updateConfig: room=${roomId} FAILED`, err);
    s.state = {
      ...s.state,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    broadcastState(roomId);
  }
  return s.state;
}
