import { useEffect, useLayoutEffect } from "react";

/**
 * useLayoutEffect on the client, useEffect during SSR (avoids the server
 * warning). GSAP setups must use this so their cleanup/revert runs
 * synchronously before React removes DOM nodes on navigation.
 */
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
