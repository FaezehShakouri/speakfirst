import { useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CornerDownRight, Image, Loader2, MessageSquarePlus, NotebookPen, Send, SquareStack } from "lucide-react";
import type { AppData, ChatMessage, ChatThread, Notebook } from "../types/app";
import { sendChatMessage } from "../services/aiProvider";
import { createFlashcard } from "../services/anki";

interface SelectionAction {
  text: string;
  x: number;
  y: number;
  messageId?: string;
}

interface Props {
  data: AppData;
  activeThread: ChatThread;
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function ChatPanel({ data, activeThread, activeNotebook, onData }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectionAction, setSelectionAction] = useState<SelectionAction | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const messages = data.messages.filter((message) => message.threadId === activeThread.id);
  const usedAttachmentIds = new Set(data.messages.flatMap((message) => message.attachmentIds));
  const pendingAttachments = data.attachments.filter((attachment) => !usedAttachmentIds.has(attachment.id));
  const selectedText = selectionAction?.text ?? "";

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

  const handleSelection = (event: MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || !text || selection.rangeCount === 0 || !panelRef.current) {
      setSelectionAction(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const anchorElement = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement;
    const messageElement = anchorElement && event.currentTarget.contains(anchorElement) ? anchorElement.closest("[data-message-id]") : null;
    setSelectionAction({
      text,
      x: rect.right - panelRect.left + 8,
      y: rect.top - panelRect.top - 6,
      messageId: messageElement instanceof HTMLElement ? messageElement.dataset.messageId : undefined
    });
  };

  const askAboutSelection = async () => {
    const quote = selectionAction?.text ?? "";
    if (!quote) {
      return;
    }
    const title = quote ? shortTitle(quote) : "Follow-up";
    onData(
      await window.speakFirst.createThread({
        parentId: activeThread.id,
        title,
        selectedQuote: quote,
        sourceMessageId: selectionAction?.messageId
      })
    );
    setSelectionAction(null);
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
    setSelectionAction(null);
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
    setSelectionAction(null);
  };

  const openThread = async (id: string) => {
    onData(await window.speakFirst.setActiveThread(id));
  };

  return (
    <section ref={panelRef} className="panel chat-panel">
      <header className="panel-header">
        <div>
          <span className="eyebrow">AI chat</span>
          <h2 title={activeThread.title}>{shortTitle(activeThread.title)}</h2>
          <div className="breadcrumb">
            {breadcrumb.map((thread, index) => (
              <span key={thread.id} title={thread.title}>
                {index > 0 && " / "}
                {shortTitle(thread.title)}
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
          <article key={message.id} className={`message ${message.role}`} data-message-id={message.id}>
            <div className="message-meta">{message.role === "assistant" ? "Tutor" : "You"}</div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const threadId = href?.startsWith("#thread:") ? href.replace("#thread:", "") : "";
                  if (threadId) {
                    return (
                      <button
                        className="thread-inline-link"
                        onClick={() => void openThread(threadId)}
                        title="Open thread for this selection"
                        type="button"
                      >
                        {children}
                      </button>
                    );
                  }
                  if (!href) {
                    return <>{children}</>;
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  );
                }
              }}
            >
              {linkThreadSelections(message.content, data.threads.filter((thread) => thread.sourceMessageId === message.id))}
            </ReactMarkdown>
            {message.attachmentIds.map((attachmentId) => {
              const attachment = data.attachments.find((item) => item.id === attachmentId);
              return attachment ? <img className="message-image" key={attachment.id} src={attachment.dataUrl} alt={attachment.name} /> : null;
            })}
            {message.role === "assistant" && (
              <div className="message-actions">
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

      {selectionAction && (
        <button
          className="selection-reply-button"
          style={{ left: selectionAction.x, top: selectionAction.y }}
          onClick={() => void askAboutSelection()}
          onMouseDown={(event) => event.preventDefault()}
          title="Reply to selection"
          type="button"
        >
          <MessageSquarePlus size={14} />
          Reply
        </button>
      )}

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
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
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

function linkThreadSelections(content: string, threads: ChatThread[]): string {
  const ranges = threads
    .map((thread) => {
      const quote = thread.selectedQuote?.trim();
      const start = quote ? content.indexOf(quote) : -1;
      return quote && start >= 0 ? { start, end: start + quote.length, threadId: thread.id } : null;
    })
    .filter((range): range is { start: number; end: number; threadId: string } => Boolean(range))
    .sort((a, b) => a.start - b.start);

  const nonOverlapping = [];
  let lastEnd = -1;
  for (const range of ranges) {
    if (range.start >= lastEnd) {
      nonOverlapping.push(range);
      lastEnd = range.end;
    }
  }

  if (nonOverlapping.length === 0) {
    return content;
  }

  let output = "";
  let cursor = 0;
  for (const range of nonOverlapping) {
    output += content.slice(cursor, range.start);
    const quote = content.slice(range.start, range.end).replace(/\s+/g, " ");
    output += `[${escapeMarkdownLinkText(quote)}](#thread:${range.threadId})`;
    cursor = range.end;
  }
  output += content.slice(cursor);
  return output;
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function shortTitle(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 18 ? `${cleaned.slice(0, 17)}…` : cleaned;
}
