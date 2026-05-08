import { FormEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CornerDownRight, Image, Loader2, MessageSquarePlus, NotebookPen, Send, SquareStack } from "lucide-react";
import type { AppData, ChatMessage, ChatThread, Notebook } from "../types/app";
import { sendChatMessage } from "../services/aiProvider";
import { createFlashcard } from "../services/anki";

interface Props {
  data: AppData;
  activeThread: ChatThread;
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function ChatPanel({ data, activeThread, activeNotebook, onData }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const messages = data.messages.filter((message) => message.threadId === activeThread.id);
  const usedAttachmentIds = new Set(data.messages.flatMap((message) => message.attachmentIds));
  const pendingAttachments = data.attachments.filter((attachment) => !usedAttachmentIds.has(attachment.id));

  const breadcrumb = useMemo(() => {
    const path: ChatThread[] = [];
    let cursor: string | null = activeThread.id;
    while (cursor) {
      const thread = data.threads.find((item) => item.id === cursor);
      if (!thread) {
        break;
      }
      path.unshift(thread);
      cursor = thread.parentId;
    }
    return path;
  }, [activeThread.id, data.threads]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() && pendingAttachments.length === 0) {
      return;
    }
    setBusy(true);
    try {
      const next = await sendChatMessage({
        threadId: activeThread.id,
        content: input.trim() || "Please explain this screenshot.",
        attachmentIds: pendingAttachments.map((attachment) => attachment.id),
        activeNotebookId: activeNotebook.id
      });
      onData(next);
      setInput("");
    } finally {
      setBusy(false);
    }
  };

  const handleSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text) {
      setSelectedText(text);
    }
  };

  const askAboutSelection = async (message?: ChatMessage) => {
    const quote = selectedText || message?.content.slice(0, 240) || "";
    const title = quote ? `About: ${quote.slice(0, 42)}` : "Follow-up thread";
    onData(
      await window.speakFirst.createThread({
        parentId: activeThread.id,
        title,
        selectedQuote: quote,
        sourceMessageId: message?.id
      })
    );
    setSelectedText("");
  };

  const addSelectionToNotebook = async () => {
    const quote = selectedText.trim();
    if (!quote) {
      return;
    }
    onData(
      await window.speakFirst.updateNotebook(activeNotebook.id, {
        title: activeNotebook.title,
        content: `${activeNotebook.content}\n\n> ${quote.replace(/\n/g, "\n> ")}`
      })
    );
    setSelectedText("");
  };

  const makeFlashcard = async () => {
    const quote = selectedText.trim();
    if (!quote) {
      return;
    }
    onData(
      await createFlashcard({
        front: quote,
        back: "Add your answer here.",
        sourceType: "chat",
        sourceId: activeThread.id
      })
    );
    setSelectedText("");
  };

  return (
    <section className="panel chat-panel">
      <header className="panel-header">
        <div>
          <span className="eyebrow">AI chat</span>
          <h2>{activeThread.title}</h2>
          <div className="breadcrumb">
            {breadcrumb.map((thread, index) => (
              <span key={thread.id}>
                {index > 0 && " / "}
                {thread.title}
              </span>
            ))}
          </div>
        </div>
      </header>

      {activeThread.selectedQuote && (
        <blockquote className="context-quote">
          <CornerDownRight size={16} />
          {activeThread.selectedQuote}
        </blockquote>
      )}

      <div className="message-list" onMouseUp={handleSelection}>
        {messages.length === 0 && (
          <div className="empty-state">
            <MessageSquarePlus size={28} />
            <strong>Ask anything about the language you are learning.</strong>
            <span>The active notebook is included as context for your tutor.</span>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-meta">{message.role === "assistant" ? "Tutor" : "You"}</div>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            {message.attachmentIds.map((attachmentId) => {
              const attachment = data.attachments.find((item) => item.id === attachmentId);
              return attachment ? <img className="message-image" key={attachment.id} src={attachment.dataUrl} alt={attachment.name} /> : null;
            })}
            {message.role === "assistant" && (
              <div className="message-actions">
                <button onClick={() => askAboutSelection(message)}>
                  <MessageSquarePlus size={14} />
                  Ask about selection
                </button>
                <button onClick={addSelectionToNotebook}>
                  <NotebookPen size={14} />
                  Add to notebook
                </button>
                <button onClick={makeFlashcard}>
                  <SquareStack size={14} />
                  Make card
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      {pendingAttachments.length > 0 && (
        <div className="pending-attachments">
          {pendingAttachments.map((attachment) => (
            <span key={attachment.id}>
              <Image size={14} />
              {attachment.name}
            </span>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask your tutor. Try: explain this sentence, make examples, correct my note..."
        />
        <button className="primary-button" disabled={busy || (!input.trim() && pendingAttachments.length === 0)}>
          {busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          Send
        </button>
      </form>
    </section>
  );
}
