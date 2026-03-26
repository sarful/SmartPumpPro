import { useEffect, useRef, useState } from "react";

type UseRealtimeOptions<T> = {
  url: string;
  intervalMs?: number;
  hiddenIntervalMs?: number;
  errorIntervalMs?: number;
  maxErrorIntervalMs?: number;
  parser?: (res: Response) => Promise<T>;
  enabled?: boolean;
};

type UseRealtimeState<T> = {
  loading: boolean;
  data: T | null;
  error: Error | null;
};

export function useRealtime<T = unknown>({
  url,
  intervalMs = 5000,
  hiddenIntervalMs = 15000,
  errorIntervalMs = 10000,
  maxErrorIntervalMs = 30000,
  parser,
  enabled = true,
}: UseRealtimeOptions<T>): UseRealtimeState<T> {
  const [state, setState] = useState<UseRealtimeState<T>>({
    loading: true,
    data: null,
    error: null,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const failureCountRef = useRef(0);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      clearTimer();
      return;
    }

    isMounted.current = true;

    const getBaseInterval = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return hiddenIntervalMs;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return hiddenIntervalMs;
      }
      return intervalMs;
    };

    const getDelay = (hadError: boolean) => {
      if (!hadError) return getBaseInterval();
      const factor = Math.min(failureCountRef.current - 1, 3);
      return Math.min(errorIntervalMs * 2 ** factor, maxErrorIntervalMs);
    };

    const schedule = (delay: number) => {
      clearTimer();
      if (!isMounted.current) return;
      timerRef.current = setTimeout(fetchData, delay);
    };

    const fetchData = async () => {
      let hadError = false;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const parsed = parser ? await parser(res) : await res.json();
        if (!isMounted.current) return;
        failureCountRef.current = 0;
        setState({ loading: false, data: parsed as T, error: null });
      } catch (error) {
        hadError = true;
        if (!isMounted.current) return;
        failureCountRef.current += 1;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error("Unknown error"),
        }));
      } finally {
        if (isMounted.current) {
          schedule(getDelay(hadError));
        }
      }
    };

    fetchData();

    const handleVisibilityOrOnline = () => {
      if (!isMounted.current) return;
      failureCountRef.current = 0;
      schedule(0);
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleVisibilityOrOnline);
    }

    return () => {
      isMounted.current = false;
      clearTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleVisibilityOrOnline);
      }
    };
  }, [url, intervalMs, hiddenIntervalMs, errorIntervalMs, maxErrorIntervalMs, parser, enabled]);

  return state;
}

export default useRealtime;
