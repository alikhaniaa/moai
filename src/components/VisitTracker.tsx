"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Reports each page the visitor lands on to /api/track.
 *
 * Mounted once in the site layout, so it also fires on client-side navigation,
 * which is most of the browsing on this site. `keepalive` lets the request
 * survive the buyer immediately clicking through to somewhere else.
 */
export default function VisitTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
