"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    root.classList.add("reveal-ready");

    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    for (const node of nodes) {
      if (node.getBoundingClientRect().top < window.innerHeight) {
        node.classList.add("is-revealed");
      } else {
        observer.observe(node);
      }
    }

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, [pathname]);

  return null;
}
