"use client";

import { useCallback, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function useAiChat({
  endpoint,
  body,
}: {
  endpoint: string;
  body: Record<string, unknown>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamingRef = useRef(false);

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streamingRef.current) return;

    streamingRef.current = true;
    setError(null);
    setInput("");
    setIsStreaming(true);

    const outgoing: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    // Push the user turn + an empty assistant turn we stream into.
    setMessages([...outgoing, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, messages: outgoing }),
      });

      if (res.status === 503) {
        setError("Assistant is unavailable right now.");
        return;
      }
      if (res.status === 429) {
        setError("Too many messages — try again shortly.");
        return;
      }
      if (!res.ok || !res.body) {
        setError("Something went wrong. Please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      streamingRef.current = false;
      setIsStreaming(false);
    }
  }, [body, endpoint, input, messages]);

  return { messages, input, setInput, isStreaming, error, send, reset };
}
