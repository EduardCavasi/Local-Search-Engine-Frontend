import { useMemo, useState } from "react";
import { askRagResponse } from "../api";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

function AiChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasMessages = messages.length > 0;
  const nextMessageId = useMemo(
    () => messages.reduce((maxId, message) => Math.max(maxId, message.id), 0) + 1,
    [messages],
  );

  const submitPrompt = async () => {
    const value = prompt.trim();
    if (!value || isLoading) return;

    const userMessage: ChatMessage = {
      id: nextMessageId,
      role: "user",
      content: value,
    };

    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await askRagResponse(value);
      setMessages((current) => [
        ...current,
        {
          id: userMessage.id + 1,
          role: "assistant",
          content: response || "I couldn't generate a response.",
        },
      ]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not get AI response from backend.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-900/95 px-4 py-3 text-sm font-medium text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-300 hover:text-white"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-indigo-500 text-sm font-bold text-slate-950">
          AI
        </span>
        <span>Ask AI</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close AI chat"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default"
          />

          <div className="absolute bottom-24 right-6 flex h-[min(42rem,calc(100vh-8rem))] w-[min(28rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-cyan-950/30">
            <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_55%)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                    AI Assistant
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-50">RAG Chat</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Ask questions about your indexed files and get an LLM answer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="app-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {!hasMessages ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                  Try something like "Summarize the main ideas from the indexed documents" or
                  "What files talk about ranking algorithms?"
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-400/20"
                      : "bg-slate-950 text-slate-200 ring-1 ring-slate-800"
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              ))}

              {isLoading ? (
                <div className="max-w-[88%] rounded-2xl bg-slate-950 px-4 py-3 text-sm text-slate-200 ring-1 ring-slate-800">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Assistant
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot [animation-delay:180ms]" />
                      <span className="ai-thinking-dot [animation-delay:360ms]" />
                    </div>
                    <span className="text-slate-400">Thinking...</span>
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-800 bg-slate-950/80 p-4">
              <label htmlFor="ai-prompt" className="sr-only">
                AI prompt
              </label>
              <textarea
                id="ai-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask anything about the indexed data..."
                rows={4}
                className="app-scrollbar w-full resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Responses come from your local backend.</p>
                <button
                  type="button"
                  onClick={() => void submitPrompt()}
                  disabled={isLoading || !prompt.trim()}
                  className="rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Waiting..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default AiChatPopup;
