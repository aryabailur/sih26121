"use client";

import { useSyncExternalStore } from "react";

/** Spoken callouts (Web Speech API) — hands-free alerts for the rig floor. Off by default; a per-viewer preference. */
const KEY = "nwis-voice";
const listeners = new Set<() => void>();
let memo: boolean | null = null;

export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function read(): boolean {
  if (memo !== null) return memo;
  try {
    memo = window.localStorage.getItem(KEY) === "1";
  } catch {
    memo = false;
  }
  return memo;
}

export function setVoice(on: boolean) {
  memo = on;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode — lasts for this page only */
  }
  if (!on && voiceSupported()) window.speechSynthesis.cancel();
  listeners.forEach((l) => l());
}

export function useVoice(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

/** Depths read naturally: "3,150" → "3150 metres". */
const spoken = (text: string) => text.replace(/(\d),(\d{3})/g, "$1$2").replace(/\bm\b/g, "metres").replace(/\bsg\b/g, "S G");

export function speak(text: string, opts: { interrupt?: boolean; rate?: number } = {}) {
  if (!voiceSupported()) return;
  const synth = window.speechSynthesis;
  if (opts.interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(spoken(text));
  u.rate = opts.rate ?? 1.02;
  u.pitch = 1;
  const voice = synth.getVoices().find((v) => /en[-_](IN|GB|US)/i.test(v.lang));
  if (voice) u.voice = voice;
  synth.speak(u);
}

export function stopSpeaking() {
  if (voiceSupported()) window.speechSynthesis.cancel();
}
