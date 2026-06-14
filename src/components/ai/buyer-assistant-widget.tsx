"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mail, MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAiChat, type ChatMessage } from "@/components/ai/use-ai-chat";

function transcriptOf(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.content}`)
    .join("\n")
    .slice(0, 8000);
}

export function BuyerAssistantWidget({
  organizationId: _organizationId,
  organizationSlug,
}: {
  organizationId: string;
  organizationSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);
  const { messages, input, setInput, isStreaming, error, send } = useAiChat({
    endpoint: "/api/ai/assistant",
    body: { organizationSlug },
  });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showEscalate) setShowEscalate(false);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showEscalate]);

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open event assistant"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "border border-border bg-foreground text-background shadow-2xl",
          "transition-transform hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Event assistant"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-[34rem] w-[min(26rem,calc(100vw-3rem))] flex-col",
        "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl",
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Concierge
          </p>
          <h2 className="text-lg font-semibold leading-tight text-foreground">How can we help?</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {showEscalate ? (
        <EscalateForm
          organizationSlug={organizationSlug}
          transcript={transcriptOf(messages)}
          onBack={() => setShowEscalate(false)}
        />
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask about events, tickets, dates, or prices. I only know about this organizer.
              </p>
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
                        ? "bg-foreground text-background"
                        : "border border-border bg-muted text-foreground",
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
            <p className="border-t border-border px-5 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="border-t border-border px-5 pt-3">
            <button
              type="button"
              onClick={() => setShowEscalate(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              <Mail className="h-3.5 w-3.5" /> Email the team
            </button>
          </div>

          <form
            className="flex items-end gap-2 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Textarea
              aria-label="Message the assistant"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask a question…"
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
        </>
      )}
    </div>
  );
}

function EscalateForm({
  organizationSlug,
  transcript,
  onBack,
}: {
  organizationSlug: string;
  transcript: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !question.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/ai/assistant/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          email: email.trim(),
          question: question.trim(),
          transcript: transcript || undefined,
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Mail className="h-8 w-8 text-muted-foreground" />
        <p className="text-base font-medium text-foreground">Thanks — we&apos;ll be in touch.</p>
        <p className="text-sm text-muted-foreground">
          The team will reply to {email} as soon as they can.
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to chat
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">
        Leave your email and question and the team will get back to you.
      </p>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={cn(
            "h-10 w-full rounded-md border border-border bg-muted/40 px-3.5 text-sm text-foreground",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20",
          )}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Question</span>
        <Textarea
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like to ask?"
          className="flex-1"
        />
      </label>
      {status === "error" ? (
        <p className="text-xs text-destructive">Couldn&apos;t send — please try again.</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" size="sm" disabled={status === "sending" || !email.trim() || !question.trim()}>
          {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </form>
  );
}
