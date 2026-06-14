"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/components/ai/use-ai-chat";

const SUGGESTIONS = [
  "Summarize my upcoming events",
  "Draft an announcement to my followers",
  "How do I issue a refund?",
];

export function CopilotPanel({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const { messages, input, setInput, isStreaming, error, send } = useAiChat({
    endpoint: "/api/ai/copilot",
    body: { organizationId },
  });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function pickSuggestion(value: string) {
    setInput(value);
    textareaRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open AI copilot"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "border border-hairline bg-signal text-ink shadow-2xl transition-transform hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="AI copilot"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-[34rem] w-[min(26rem,calc(100vw-3rem))] flex-col",
        "overflow-hidden rounded-lg border border-hairline bg-ink-raised shadow-2xl",
      )}
    >
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div>
          <p className="eyebrow text-signal">Copilot</p>
          <h2 className="display text-xl text-foreground">Operator assistant.</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close copilot"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about your events, sales, or drafting copy.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className={cn(
                    "rounded-md border border-hairline bg-ink-soft/60 px-3 py-2 text-left text-sm text-foreground",
                    "transition-colors hover:bg-ink-soft",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-sm",
                  m.role === "user"
                    ? "bg-signal text-ink"
                    : "border border-hairline bg-ink-soft/60 text-foreground",
                )}
              >
                {m.content ||
                  (m.role === "assistant" && isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null)}
              </div>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="border-t border-hairline px-5 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-hairline px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Textarea
          ref={textareaRef}
          aria-label="Message copilot"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask your copilot…"
          rows={1}
          className="min-h-[44px] resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={isStreaming || !input.trim()}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
