"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const PREFIX = "[useMusicStream]";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BUFFER_AHEAD_SEC = 0.15;

export function useMusicStream(roomId: string, active: boolean) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextTimeRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const chunkCountRef = useRef(0);
  const [volume, setVolumeState] = useState(0.8);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainRef.current) {
      gainRef.current.gain.value = v;
    }
  }, []);

  const ensureAudioCtx = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    }
    console.log(PREFIX, `creating AudioContext sampleRate=${SAMPLE_RATE}`);
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    audioCtxRef.current = ctx;
    gainRef.current = gain;
    nextTimeRef.current = 0;
    return ctx;
  }, [volume]);

  useEffect(() => {
    if (!active || !roomId) {
      if (esRef.current) {
        console.log(PREFIX, `closing SSE (active=${active})`);
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }

    const ctx = ensureAudioCtx();
    const gain = gainRef.current!;
    chunkCountRef.current = 0;

    const url = `/api/rooms/${roomId}/music/stream`;
    console.log(PREFIX, `opening SSE: ${url}`);
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("audio", (e) => {
      const base64 = e.data;
      chunkCountRef.current++;

      if (chunkCountRef.current <= 3 || chunkCountRef.current % 200 === 0) {
        console.log(
          PREFIX,
          `audio chunk #${chunkCountRef.current}, b64 len=${base64.length}, ctxTime=${ctx.currentTime.toFixed(2)}, nextTime=${nextTimeRef.current.toFixed(2)}`,
        );
      }

      const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const int16 = new Int16Array(raw.buffer);
      const frameCount = int16.length / CHANNELS;

      if (frameCount === 0) return;

      const buffer = ctx.createBuffer(CHANNELS, frameCount, SAMPLE_RATE);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      for (let i = 0; i < frameCount; i++) {
        left[i] = int16[i * CHANNELS] / 32768;
        right[i] = int16[i * CHANNELS + 1] / 32768;
      }

      const now = ctx.currentTime;
      if (nextTimeRef.current < now) {
        nextTimeRef.current = now + BUFFER_AHEAD_SEC;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(nextTimeRef.current);
      nextTimeRef.current += buffer.duration;
    });

    es.addEventListener("music-state", (e) => {
      console.log(PREFIX, `music-state event:`, e.data);
    });

    es.onerror = (err) => {
      console.error(PREFIX, `SSE error`, err);
    };

    return () => {
      console.log(
        PREFIX,
        `cleanup: closing SSE, chunks received=${chunkCountRef.current}`,
      );
      es.close();
      esRef.current = null;
    };
  }, [active, roomId, ensureAudioCtx]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        console.log(PREFIX, `closing AudioContext on unmount`);
        audioCtxRef.current.close();
      }
    };
  }, []);

  return { volume, setVolume };
}
