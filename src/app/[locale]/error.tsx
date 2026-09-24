"use client";

import { RouteErrorState } from "@/components/route-state";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState error={error} reset={reset} />;
}
