import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Brain, Camera, Download, Moon, PanelLeft, Pin, Settings, SquareStack, Sun, Trash2 } from "lucide-react";
import ChatPanel from "./components/ChatPanel";
import NotebookPanel from "./components/NotebookPanel";
import ThreadMap from "./components/ThreadMap";
import SettingsPanel from "./components/SettingsPanel";
import type { AppData, AppSettings, Attachment } from "./types/app";
import { exportAnkiDeck } from "./services/anki";
import { loadData, saveSettings } from "./services/storage";

const RESIZE_HANDLE_WIDTH = 12;
const MIN_MAP_WIDTH = 180;
const MIN_PANEL_WIDTH = 320;

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [mapOpen, setMapOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mapWidth, setMapWidth] = useState(240);
  const [chatWidth, setChatWidth] = useState(520);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadData().then(setData);
  }, []);

  useEffect(() => {
    return window.speakFirst.onCaptureFromShortcut((capture) => {
      if (!capture) {
        return;
      }
      const attachmentInput: Omit<Attachment, "id" | "createdAt"> = {
        kind: "image",
        name: "screen-capture.png",
        dataUrl: capture.dataUrl
      };
      window.speakFirst.addAttachment(attachmentInput).then(setData);
    });
  }, []);

  useEffect(() => {
    if (!data) {
      return;
    }
    const root = document.documentElement;
    root.dataset.theme = data.settings.theme;
  }, [data?.settings.theme]);

  const activeThread = useMemo(
    () => data?.threads.find((thread) => thread.id === data.activeThreadId) ?? data?.threads[0],
    [data]
  );
  const activeNotebook = useMemo(
    () => data?.notebooks.find((notebook) => notebook.id === data.activeNotebookId) ?? data?.notebooks[0],
    [data]
  );

  if (!data || !activeThread || !activeNotebook) {
    return (
      <main className="loading">
        <Brain size={34} />
        <span>Loading SpeakFirst...</span>
      </main>
    );
  }

  const updateSettings = async (settings: AppSettings) => {
    setBusy(true);
    try {
      setData(await saveSettings(settings));
    } finally {
      setBusy(false);
    }
  };

  const toggleAlwaysOnTop = async () => {
    setBusy(true);
    try {
      setData(await window.speakFirst.setAlwaysOnTop(!data.settings.alwaysOnTop));
    } finally {
      setBusy(false);
    }
  };

  const toggleTheme = () => {
    const nextTheme = data.settings.theme === "dark" ? "light" : data.settings.theme === "light" ? "system" : "dark";
    void updateSettings({ ...data.settings, theme: nextTheme });
  };

  const captureToChat = async () => {
    setBusy(true);
    try {
      const capture = await window.speakFirst.captureRegion();
      if (!capture) {
        return;
      }
      const attachmentInput: Omit<Attachment, "id" | "createdAt"> = {
        kind: "image",
        name: "screen-capture.png",
        dataUrl: capture.dataUrl
      };
      setData(await window.speakFirst.addAttachment(attachmentInput));
    } finally {
      setBusy(false);
    }
  };

  const exportCards = async () => {
    const result = await exportAnkiDeck();
    setExportMessage(result.filePath ? `Exported ${result.cardCount} cards to ${result.filePath}` : "Export cancelled.");
  };

  const deleteCard = async (id: string) => {
    setData(await window.speakFirst.deleteFlashcard(id));
  };

  const startResize = (target: "map" | "chat") => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.body.classList.add("resizing-panes");

    const resize = (moveEvent: PointerEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      if (target === "map") {
        const maxMapWidth = rect.width - MIN_PANEL_WIDTH * 2 - RESIZE_HANDLE_WIDTH * 2;
        const nextMapWidth = clamp(moveEvent.clientX - rect.left, MIN_MAP_WIDTH, maxMapWidth);
        setMapWidth(nextMapWidth);
        setChatWidth((width) => clamp(width, MIN_PANEL_WIDTH, rect.width - nextMapWidth - MIN_PANEL_WIDTH - RESIZE_HANDLE_WIDTH * 2));
        return;
      }

      const chatStart = mapOpen ? mapWidth + RESIZE_HANDLE_WIDTH : 0;
      const maxChatWidth = rect.width - chatStart - MIN_PANEL_WIDTH - RESIZE_HANDLE_WIDTH;
      setChatWidth(clamp(moveEvent.clientX - rect.left - chatStart, MIN_PANEL_WIDTH, maxChatWidth));
    };

    const stopResize = () => {
      document.body.classList.remove("resizing-panes");
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    };

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
  };

  const workspaceStyle: CSSProperties = {
    gridTemplateColumns: mapOpen
      ? `${mapWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_PANEL_WIDTH}px, ${chatWidth}px) ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_PANEL_WIDTH}px, 1fr)`
      : `minmax(${MIN_PANEL_WIDTH}px, ${chatWidth}px) ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_PANEL_WIDTH}px, 1fr)`
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Brain size={24} />
          <div>
            <strong>SpeakFirst</strong>
            <span>Daily language companion</span>
          </div>
        </div>

        <div className="toolbar">
          <button className="icon-button" onClick={() => setMapOpen((value) => !value)} title="Toggle thread map">
            <PanelLeft size={18} />
          </button>
          <button className="icon-button" onClick={captureToChat} disabled={busy} title="Capture screen area">
            <Camera size={18} />
          </button>
          <button className="icon-button" onClick={() => setCardsOpen(true)} title="Open flashcards">
            <SquareStack size={18} />
            <span>Cards {data.flashcards.length > 0 ? `(${data.flashcards.length})` : ""}</span>
          </button>
          <button className={data.settings.alwaysOnTop ? "icon-button active" : "icon-button"} onClick={toggleAlwaysOnTop}>
            <Pin size={18} />
            <span>{data.settings.alwaysOnTop ? "Pinned" : "Pin"}</span>
          </button>
          <button className="icon-button" onClick={toggleTheme} title="Cycle theme">
            {data.settings.theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{data.settings.theme}</span>
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      <section ref={workspaceRef} className={mapOpen ? "workspace with-map" : "workspace"} style={workspaceStyle}>
        {mapOpen && (
          <>
            <ThreadMap data={data} onData={setData} />
            <div className="resize-handle" role="separator" aria-label="Resize thread map" onPointerDown={startResize("map")} />
          </>
        )}
        <ChatPanel data={data} activeThread={activeThread} activeNotebook={activeNotebook} onData={setData} />
        <div className="resize-handle" role="separator" aria-label="Resize AI chat and notebook" onPointerDown={startResize("chat")} />
        <NotebookPanel activeNotebook={activeNotebook} onData={setData} />
      </section>

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

      {settingsOpen && (
        <SettingsPanel
          settings={data.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (settings) => {
            await updateSettings(settings);
            setSettingsOpen(false);
          }}
        />
      )}
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
