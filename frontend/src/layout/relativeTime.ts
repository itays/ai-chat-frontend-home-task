import { formatDistanceStrict } from "date-fns";
import { useEffect, useState } from "react";

/** "just now" under a minute, otherwise e.g. "5 minutes ago". */
export const formatAge = (iso: string, now: number) =>
  now - Date.parse(iso) < 60_000
    ? "just now"
    : formatDistanceStrict(iso, now, {
        addSuffix: true,
        roundingMethod: "floor",
      });

/** The current time, refreshed often enough for minute-level relative times. */
export const useNow = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};
