import { useEffect, useRef, useState } from "react";

type UseRealtimeOptions<T> = {
  url: string;
  intervalMs?: number;
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

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    isMounted.current = true;

    const fetchData = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        const parsed = parser ? await parser(res) : await res.json();
        if (!isMounted.current) return;
        setState({ loading: false, data: parsed as T, error: null });
      } catch (error: any) {
        if (!isMounted.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error("Unknown error"),
        }));
      }
    };

    fetchData();
    timerRef.current = setInterval(fetchData, intervalMs);

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [url, intervalMs, parser]);

  return state;
}

export default useRealtime;
