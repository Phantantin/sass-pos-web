"use client";

import { useEffect } from "react";

export async function registerPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;

  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // Offline enhancement must never prevent checkout or authenticated navigation.
    return undefined;
  }
}

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      void registerPwaServiceWorker();
    }
  }, []);

  return null;
}
