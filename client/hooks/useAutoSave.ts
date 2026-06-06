import { useRef, useCallback } from "react";

/**
 * Debounced auto-save hook.
 *
 * @param saveFn  The async function that persists the data.
 * @param delay   Debounce delay in milliseconds (default 500).
 * @returns       An object with `scheduleSave` (debounced trigger) and `flush` (immediate write).
 */
export function useAutoSave<T>(
  saveFn: (data: T) => Promise<void>,
  delay: number = 500
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef<T | null>(null);

  const scheduleSave = useCallback(
    (data: T) => {
      dataRef.current = data;
      if (timerRef.current) clearTimeout(timerRef.current);

      return new Promise<void>((resolve) => {
        timerRef.current = setTimeout(async () => {
          if (dataRef.current) {
            await saveFn(dataRef.current);
          }
          resolve();
        }, delay);
      });
    },
    [saveFn, delay]
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (dataRef.current) {
      await saveFn(dataRef.current);
    }
  }, [saveFn]);

  return { scheduleSave, flush };
}