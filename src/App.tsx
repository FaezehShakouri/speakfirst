import { useEffect, useMemo, useState } from "react";
import { Brain, Camera, Moon, PanelLeft, Pin, Settings, Sun } from "lucide-react";
import ChatPanel from "./components/ChatPanel";
import NotebookPanel from "./components/NotebookPanel";
import ThreadMap from "./components/ThreadMap";
import SettingsPanel from "./components/SettingsPanel";
import type { AppData, AppSettings, Attachment } from "./types/app";
import { loadData, saveSettings } from "./services/storage";

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const [busy, setBusy] = useState(false);

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

      <section className={mapOpen ? "workspace with-map" : "workspace"}>
        {mapOpen && <ThreadMap data={data} onData={setData} />}
        <ChatPanel data={data} activeThread={activeThread} activeNotebook={activeNotebook} onData={setData} />
        <NotebookPanel data={data} activeNotebook={activeNotebook} onData={setData} />
      </section>

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
