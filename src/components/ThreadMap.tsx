import { BookOpenText, MessageCircle, Plus, Trash2 } from "lucide-react";
import type { AppData, ChatThread, Notebook } from "../types/app";

interface Props {
  data: AppData;
  onData: (data: AppData) => void;
}

export default function ThreadMap({ data, onData }: Props) {
  const createThread = async () => {
    onData(
      await window.speakFirst.createThread({
        parentId: null,
        title: "New chat"
      })
    );
  };

  const createNotebook = async () => {
    onData(
      await window.speakFirst.createNotebook({
        parentId: null,
        title: "New notebook",
        content: ""
      })
    );
  };

  const deleteThread = async (id: string) => {
    if (data.threads.length <= 1) {
      return;
    }
    const deleteIds = collectDescendantIds(data.threads, id);
    const threads = data.threads.filter((thread) => !deleteIds.has(thread.id));
    onData({
      ...data,
      threads,
      messages: data.messages.filter((message) => !deleteIds.has(message.threadId)),
      activeThreadId: threads.some((thread) => thread.id === data.activeThreadId) ? data.activeThreadId : threads[0]?.id ?? data.activeThreadId
    });
    onData(await window.speakFirst.deleteThread(id));
  };

  const deleteNotebook = async (id: string) => {
    if (data.notebooks.length <= 1) {
      return;
    }
    const deleteIds = collectDescendantIds(data.notebooks, id);
    const notebooks = data.notebooks.filter((notebook) => !deleteIds.has(notebook.id));
    onData({
      ...data,
      notebooks,
      flashcards: data.flashcards.filter((card) => !card.sourceId || !deleteIds.has(card.sourceId)),
      activeNotebookId: notebooks.some((notebook) => notebook.id === data.activeNotebookId)
        ? data.activeNotebookId
        : notebooks[0]?.id ?? data.activeNotebookId
    });
    onData(await window.speakFirst.deleteNotebook(id));
  };

  return (
    <aside className="thread-map">
      <header>
        <div>
          <span className="eyebrow">Map</span>
          <h2>Threads</h2>
        </div>
        <button className="map-add-button" onClick={createThread} title="New AI chat" type="button">
          <Plus size={14} />
        </button>
      </header>
      <Tree
        items={data.threads}
        activeId={data.activeThreadId}
        icon="chat"
        onSelect={async (id) => onData(await window.speakFirst.setActiveThread(id))}
        onDelete={deleteThread}
      />

      <header>
        <div>
          <span className="eyebrow">Map</span>
          <h2>Notebooks</h2>
        </div>
        <button className="map-add-button" onClick={createNotebook} title="New notebook" type="button">
          <Plus size={14} />
        </button>
      </header>
      <Tree
        items={data.notebooks}
        activeId={data.activeNotebookId}
        icon="notebook"
        onSelect={async (id) => onData(await window.speakFirst.setActiveNotebook(id))}
        onDelete={deleteNotebook}
      />
    </aside>
  );
}

function collectDescendantIds(items: Array<{ id: string; parentId: string | null }>, rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
    }
  }
  return ids;
}

function Tree<T extends ChatThread | Notebook>({
  items,
  activeId,
  onSelect,
  onDelete,
  icon
}: {
  items: T[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  icon: "chat" | "notebook";
}) {
  const roots = items.filter((item) => item.parentId === null);
  return (
    <div className="tree">
      {roots.map((root) => (
        <TreeNode
          key={root.id}
          item={root}
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          depth={0}
          icon={icon}
        />
      ))}
    </div>
  );
}

function TreeNode<T extends ChatThread | Notebook>({
  item,
  items,
  activeId,
  onSelect,
  onDelete,
  depth,
  icon
}: {
  item: T;
  items: T[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  depth: number;
  icon: "chat" | "notebook";
}) {
  const children = items.filter((candidate) => candidate.parentId === item.id);
  const canDelete = items.length > 1;
  const deleteItem = () => {
    if (!canDelete) {
      return;
    }
    const kind = icon === "chat" ? "chat thread" : "notebook";
    const childText = children.length ? " and its nested children" : "";
    if (window.confirm(`Delete this ${kind}${childText}?`)) {
      onDelete(item.id);
    }
  };
  return (
    <div>
      <div className={item.id === activeId ? "tree-row active" : "tree-row"} style={{ paddingLeft: 10 + depth * 16 }}>
        <button className="tree-node" onClick={() => onSelect(item.id)}>
          {icon === "chat" ? <MessageCircle size={14} /> : <BookOpenText size={14} />}
          <span title={item.title}>{icon === "chat" ? shortTitle(item.title) : item.title}</span>
        </button>
        <button className="tree-delete" onClick={deleteItem} disabled={!canDelete} title={`Delete ${item.title}`}>
          <Trash2 size={13} />
        </button>
      </div>
      {children.map((child) => (
        <TreeNode
          key={child.id}
          item={child}
          items={items}
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          depth={depth + 1}
          icon={icon}
        />
      ))}
    </div>
  );
}

function shortTitle(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 18 ? `${cleaned.slice(0, 17)}…` : cleaned;
}
