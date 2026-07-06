"use client";

import { useSyncExternalStore } from "react";

/**
 * Global "which SDK do I want to read?" preference for dual-provider code
 * blocks. Stored in localStorage so every tabbed block on every page flips
 * together, and the choice survives reloads.
 */
export type ProviderPref = "claude" | "openai";

const STORAGE_KEY = "aea-provider-v1";
const listeners = new Set<() => void>();

function read(): ProviderPref {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "openai"
      ? "openai"
      : "claude";
  } catch {
    return "claude";
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // cross-tab sync
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setProviderPref(p: ProviderPref) {
  try {
    window.localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* storage unavailable — the in-memory notify below still works */
  }
  listeners.forEach((l) => l());
}

export function useProviderPref(): ProviderPref {
  return useSyncExternalStore(subscribe, read, () => "claude" as ProviderPref);
}
