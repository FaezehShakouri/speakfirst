import { BookOpenText, MessageCircle, Trash2 } from "lucide-react";
import type { AppData, ChatThread, Notebook } from "../types/app";

interface Props {
  data: AppData;
  onData: (data: AppData) => void;
}

export default function ThreadMap({ data, onData }: Props) {
  return (
    <aside className="thread-map">
      <header>
        <span className="eyebrow">Map</span>
        <h2>Threads</h2>
      </header>
      <Tree
        items={data.threads}
        activeId={data.activeThreadId}
        icon="chat"
        onSelect={async (id) => onData(await window.speakFirst.setActiveThread(id))}
        onDelete={async (id) => onData(await window.speakFirst.deleteThread(id))}
      />

      <header>
        <span className="eyebrow">Map</span>
        <h2>Notebooks</h2>
      </header>
      <Tree
        items={data.notebooks}
        activeId={data.activeNotebookId}
        icon="notebook"
        onSelect={async (id) => onData(await window.speakFirst.setActiveNotebook(id))}
        onDelete={async (id) => onData(await window.speakFirst.deleteNotebook(id))}
      />
    </aside>
  );
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
          <span>{item.title}</span>
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
