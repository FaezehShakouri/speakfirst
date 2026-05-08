import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, Eye, FilePlus2, NotebookTabs, SquareStack, Trash2 } from "lucide-react";
import type { AppData, Notebook } from "../types/app";
import { createFlashcard, exportAnkiDeck } from "../services/anki";

interface Props {
  data: AppData;
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function NotebookPanel({ data, activeNotebook, onData }: Props) {
  const [selection, setSelection] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(activeNotebook.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const childNotes = useMemo(
    () => data.notebooks.filter((notebook) => notebook.parentId === activeNotebook.id),
    [activeNotebook.id, data.notebooks]
  );

  useEffect(() => {
    setTitleDraft(activeNotebook.title);
    setTitleEditing(false);
  }, [activeNotebook.id, activeNotebook.title]);

  useEffect(() => {
    if (titleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [titleEditing]);

  const updateNotebook = async (patch: Pick<Notebook, "title" | "content">) => {
    onData(await window.speakFirst.updateNotebook(activeNotebook.id, patch));
  };

  const saveTitle = async () => {
    const nextTitle = titleDraft.trim() || "Untitled notebook";
    setTitleEditing(false);
    if (nextTitle !== activeNotebook.title) {
      await updateNotebook({ title: nextTitle, content: activeNotebook.content });
    }
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setTitleDraft(activeNotebook.title);
      setTitleEditing(false);
    }
  };

  const captureSelection = (target: HTMLTextAreaElement) => {
    const selected = target.value.slice(target.selectionStart, target.selectionEnd).trim();
    if (selected) {
      setSelection(selected);
    }
  };

  const createChildNotebook = async () => {
    const quote = selection || "Nested note";
    onData(
      await window.speakFirst.createNotebook({
        parentId: activeNotebook.id,
        title: `Note: ${quote.slice(0, 38)}`,
        selectedQuote: selection,
        content: selection ? `> ${selection.replace(/\n/g, "\n> ")}\n\n` : ""
      })
    );
    setSelection("");
  };

  const makeCard = async () => {
    const front = selection || activeNotebook.title;
    onData(
      await createFlashcard({
        front,
        back: selection ? "Explain, translate, or complete this note." : activeNotebook.content.slice(0, 500),
        sourceType: "notebook",
        sourceId: activeNotebook.id
      })
    );
    setSelection("");
  };

  const exportCards = async () => {
    const result = await exportAnkiDeck();
    setExportMessage(result.filePath ? `Exported ${result.cardCount} cards to ${result.filePath}` : "Export cancelled.");
  };

  const deleteCard = async (id: string) => {
    onData(await window.speakFirst.deleteFlashcard(id));
  };

  return (
    <section className="panel notebook-panel">
      <header className="panel-header">
        <div>
          <span className="eyebrow">Notebook</span>
          {titleEditing ? (
            <input
              ref={titleInputRef}
              className="title-input"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={handleTitleKeyDown}
            />
          ) : (
            <button className="title-button" onClick={() => setTitleEditing(true)} title="Rename notebook">
              {activeNotebook.title}
            </button>
          )}
        </div>
        <div className="panel-actions">
          <button onClick={createChildNotebook}>
            <FilePlus2 size={15} />
            Child note
          </button>
          <button onClick={makeCard}>
            <SquareStack size={15} />
            Card
          </button>
        </div>
      </header>

      {activeNotebook.selectedQuote && (
        <blockquote className="context-quote">
          <NotebookTabs size={16} />
          {activeNotebook.selectedQuote}
        </blockquote>
      )}

      <div className="notebook-grid">
        <textarea
          className="markdown-editor"
          value={activeNotebook.content}
          onSelect={(event) => captureSelection(event.currentTarget)}
          onChange={(event) => updateNotebook({ title: activeNotebook.title, content: event.target.value })}
          placeholder="Write markdown notes here..."
        />
        <article className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNotebook.content}</ReactMarkdown>
        </article>
      </div>

      <section className="cards-box">
        <div>
          <strong>{data.flashcards.length} flashcards</strong>
          <span>Export as a TSV file that Anki can import.</span>
        </div>
        <div className="card-actions">
          <button onClick={() => setCardsOpen((value) => !value)}>
            <Eye size={15} />
            {cardsOpen ? "Hide cards" : "See cards"}
          </button>
          <button onClick={exportCards}>
            <Download size={15} />
            Export
          </button>
        </div>
      </section>
      {exportMessage && <p className="muted">{exportMessage}</p>}

      {cardsOpen && (
        <section className="cards-list">
          {data.flashcards.length === 0 ? (
            <p className="muted">No cards yet. Select chat or notebook text and use the Card button.</p>
          ) : (
            data.flashcards.map((card) => (
              <article key={card.id} className="card-preview">
                <div>
                  <span className="eyebrow">Front</span>
                  <p>{card.front}</p>
                </div>
                <div>
                  <span className="eyebrow">Back</span>
                  <p>{card.back}</p>
                </div>
                <button className="danger-button" onClick={() => deleteCard(card.id)} title="Delete card">
                  <Trash2 size={14} />
                </button>
              </article>
            ))
          )}
        </section>
      )}

      {childNotes.length > 0 && (
        <section className="child-notes">
          <span className="eyebrow">Nested notes</span>
          {childNotes.map((note) => (
            <button key={note.id} onClick={async () => onData(await window.speakFirst.setActiveNotebook(note.id))}>
              {note.title}
            </button>
          ))}
        </section>
      )}
    </section>
  );
}
