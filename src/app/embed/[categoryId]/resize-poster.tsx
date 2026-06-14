"use client";

import { useEffect } from "react";

export function ResizePoster() {
  useEffect(() => {
    if (window.parent === window) return;

    const post = () => {
      window.parent.postMessage(
        { type: "miso:resize", height: document.body.scrollHeight },
        "*",
      );
    };

    post();
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return null;
}
