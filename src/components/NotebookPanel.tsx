import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Quote
} from "lucide-react";
import type { AppData, Notebook } from "../types/app";

interface Props {
  activeNotebook: Notebook;
  onData: (data: AppData) => void;
}

export default function NotebookPanel({ activeNotebook, onData }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(activeNotebook.title);
  const cancelTitleSaveRef = useRef(false);
  const activeNotebookRef = useRef(activeNotebook);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeNotebookRef.current = activeNotebook;
    setTitleDraft(activeNotebook.title);
  }, [activeNotebook]);

  const scheduleSave = useCallback(
    (content: string) => {
      const notebook = activeNotebookRef.current;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(async () => {
        try {
          onData(
            await window.speakFirst.updateNotebook(notebook.id, {
              title: notebook.title,
              content
            })
          );
        } catch {
          // Keep editing responsive; the next change will retry persistence.
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
  }, [activeNotebook.content, activeNotebook.id, editor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const saveTitle = async () => {
    if (cancelTitleSaveRef.current) {
      cancelTitleSaveRef.current = false;
      return;
    }
    const title = titleDraft.trim() || "Untitled notebook";
    setTitleDraft(title);
    setEditingTitle(false);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    onData(
      await window.speakFirst.updateNotebook(activeNotebook.id, {
        title,
        content: editor?.getMarkdown() ?? activeNotebook.content
      })
    );
  };

  return (
    <section className="panel notebook-panel">
      <header className="panel-header">
        <div>
          {editingTitle ? (
            <input
              autoFocus
              className="notebook-title-input"
              value={titleDraft}
              onBlur={() => void saveTitle()}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  cancelTitleSaveRef.current = true;
                  setTitleDraft(activeNotebook.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <button className="notebook-title-button" onClick={() => setEditingTitle(true)} title="Rename notebook" type="button">
              <h2>{activeNotebook.title}</h2>
            </button>
          )}
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
