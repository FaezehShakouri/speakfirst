import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Download,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote,
  SquareStack,
  Trash2
} from "lucide-react";
import type { AppData, Notebook } from "../types/app";
import { exportAnkiDeck } from "../services/anki";

interface Props {
  data: AppData;
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function NotebookPanel({ data, activeNotebook, onData }: Props) {
  const [exportMessage, setExportMessage] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const activeNotebookRef = useRef(activeNotebook);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeNotebookRef.current = activeNotebook;
  }, [activeNotebook]);

  const scheduleSave = useCallback(
    (content: string) => {
      const notebook = activeNotebookRef.current;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      setSaveState("saving");
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          onData(
            await window.speakFirst.updateNotebook(notebook.id, {
              title: notebook.title,
              content
            })
          );
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      }, 500);
    },
    [onData]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Markdown.configure({
          markedOptions: {
            gfm: true,
            breaks: false
          }
        }),
        Placeholder.configure({
          placeholder: "Collect phrases, grammar notes, questions, and corrections here..."
        })
      ],
      content: activeNotebook.content,
      contentType: "markdown",
      editorProps: {
        attributes: {
          class: "tiptap-editor"
        }
      },
      shouldRerenderOnTransaction: true,
      onUpdate: ({ editor: currentEditor }) => {
        scheduleSave(currentEditor.getMarkdown());
      }
    },
    [scheduleSave]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }
    const currentMarkdown = editor.getMarkdown();
    if (currentMarkdown !== activeNotebook.content) {
      editor.commands.setContent(activeNotebook.content, {
        contentType: "markdown",
        emitUpdate: false
      });
    }
    setSaveState("saved");
  }, [activeNotebook.content, activeNotebook.id, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

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
          <span className="eyebrow">Tiptap notebook</span>
          <h2>{activeNotebook.title}</h2>
          <p className="muted">{saveState === "error" ? "Notebook changes could not be saved." : saveState === "saving" ? "Saving..." : "Saved"}</p>
        </div>
        <div className="panel-actions">
          <button onClick={() => setCardsOpen(true)}>
            <SquareStack size={15} />
            Cards {data.flashcards.length > 0 ? `(${data.flashcards.length})` : ""}
          </button>
        </div>
      </header>

      <div className="notebook-editor-shell">
        <div className="notebook-toolbar" aria-label="Notebook formatting tools">
          <ToolbarButton active={editor?.isActive("heading", { level: 1 })} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} label="Heading 1">
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("heading", { level: 2 })} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading 2">
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("bold")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} label="Bold">
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("italic")} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} label="Italic">
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("bulletList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} label="Bullet list">
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("orderedList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} label="Ordered list">
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("blockquote")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()} label="Quote">
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("codeBlock")} disabled={!editor} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} label="Code block">
            <Code size={15} />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} className="notebook-editor" />
      </div>

      {cardsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card cards-modal" role="dialog" aria-modal="true" aria-label="Flashcards">
            <header>
              <div>
                <span className="eyebrow">Flashcards</span>
                <h2>{data.flashcards.length} cards</h2>
              </div>
              <div className="card-actions">
                <button onClick={exportCards}>
                  <Download size={15} />
                  Export
                </button>
                <button className="ghost-button" onClick={() => setCardsOpen(false)}>
                  Close
                </button>
              </div>
            </header>
            {exportMessage && <p className="muted">{exportMessage}</p>}
            <section className="cards-list in-modal">
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
          </section>
        </div>
      )}
    </section>
  );
}

function ToolbarButton({
  active,
  children,
  disabled,
  label,
  onClick
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} disabled={disabled} onClick={onClick} title={label} type="button">
      {children}
    </button>
  );
}
