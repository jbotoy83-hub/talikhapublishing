"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useOutsideClick(ref: RefObject<HTMLElement | null>, callback: () => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    function handle(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) callbackRef.current();
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [ref]);
}
