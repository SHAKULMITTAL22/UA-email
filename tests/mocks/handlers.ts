import { http, HttpResponse } from "msw";

/**
 * Phase-1 placeholder handlers. Provider-agent and ai-agent will extend
 * these with realistic Gmail / Graph / IMAP / LLM mock responses.
 */
export const handlers = [
  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", () => {
    return HttpResponse.json({ messages: [], nextPageToken: undefined });
  }),
  http.get("https://graph.microsoft.com/v1.0/me/messages", () => {
    return HttpResponse.json({ value: [] });
  }),
  http.post("/api/ai/triage", async () => {
    return HttpResponse.json({ results: [] });
  }),
];
