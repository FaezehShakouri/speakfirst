import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  MessageCircle,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Undo2
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
  const imageInputRef = useRef<HTMLInputElement | null>(null);
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
        Image.configure({
          allowBase64: true
        }),
        Table.configure({
          resizable: true
        }),
        TableRow,
        TableHeader,
        TableCell,
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

  const addImage = () => {
    imageInputRef.current?.click();
  };

  const insertImageFile = (file: File | undefined) => {
    if (!file || !editor) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const src = reader.result;
      if (typeof src === "string") {
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      }
    });
    reader.readAsDataURL(file);
  };

  const addNote = () => {
    editor?.chain().focus().insertContent("<blockquote><p>Note: </p></blockquote>").run();
  };

  return (
    <section className="panel notebook-panel">
      <header className="panel-header">
        <div className="notebook-title-wrap">
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
          <ToolbarButton disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} label="Undo">
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} label="Redo">
            <Redo2 size={15} />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton active={editor?.isActive("bold")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} label="Bold">
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("italic")} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} label="Italic">
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("strike")} disabled={!editor} onClick={() => editor?.chain().focus().toggleStrike().run()} label="Strikethrough">
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("heading", { level: 2 })} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading">
            <Heading size={15} />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton active={editor?.isActive("codeBlock")} disabled={!editor} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} label="Code block">
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("blockquote")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()} label="Quote">
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton active={editor?.isActive("bulletList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} label="Bullet list">
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive("orderedList")} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} label="Ordered list">
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton disabled={!editor} onClick={addImage} label="Image">
            <ImageIcon size={15} />
          </ToolbarButton>
          <input
            ref={imageInputRef}
            accept="image/*"
            className="visually-hidden"
            type="file"
            onChange={(event) => {
              insertImageFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <ToolbarButton active={editor?.isActive("table")} disabled={!editor} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} label="Table">
            <Table2 size={15} />
          </ToolbarButton>
          <ToolbarButton disabled={!editor} onClick={() => editor?.chain().focus().setHorizontalRule().run()} label="Divider">
            <Minus size={15} />
          </ToolbarButton>
          <ToolbarButton disabled={!editor} onClick={addNote} label="Note">
            <MessageCircle size={15} />
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
    <button
      className={active ? "active" : ""}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className="notebook-toolbar-separator" aria-hidden="true" />;
}

