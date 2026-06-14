import { z } from "zod";

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const CopilotRequestSchema = z.object({
  organizationId: z.string().uuid(),
  messages: z.array(ChatMessageSchema).min(1).max(40),
});

export const AssistantRequestSchema = z.object({
  organizationSlug: z.string().min(1).max(120),
  messages: z.array(ChatMessageSchema).min(1).max(40),
});

export const EscalateRequestSchema = z.object({
  organizationSlug: z.string().min(1).max(120),
  email: z.string().email(),
  question: z.string().min(1).max(2000),
  transcript: z.string().max(8000).optional(),
});
