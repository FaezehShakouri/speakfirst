import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, screen, type Event } from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { AppData, AppSettings, SendChatInput } from "../src/types/app";
import { completeChat, listModels } from "./ai";
import {
  Store,
  createAttachment,
  createFlashcard,
  createMessage,
  createNotebook,
  createThread,
  touchNotebook,
  touchThread
} from "./store";

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let captureWindow: BrowserWindow | null = null;
let bubbleWindow: BrowserWindow | null = null;
let pendingCaptureResolve: ((value: { dataUrl: string; width: number; height: number } | null) => void) | null = null;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

async function createMainWindow() {
  const data = await store.load();
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    alwaysOnTop: data.settings.alwaysOnTop,
    title: "SpeakFirst",
    backgroundColor: "#10131a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("minimize" as never, (event: Event) => {
    event.preventDefault();
    mainWindow?.hide();
    showBubbleWindow();
  });

  mainWindow.on("show", () => {
    bubbleWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    bubbleWindow?.close();
    bubbleWindow = null;
  });
}

app.whenReady().then(async () => {
  await createMainWindow();
  registerShortcuts();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      showBubbleWindow();
    } else {
      restoreMainWindow();
    }
  });

  globalShortcut.register("CommandOrControl+Shift+S", async () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      const result = await captureRegion();
      mainWindow.webContents.send("capture-from-shortcut", result);
    }
  });

ipcMain.on("restore-main-window", () => {
  restoreMainWindow();
});

ipcMain.on("move-bubble-window", (_event, position: { x: number; y: number }) => {
  bubbleWindow?.setPosition(Math.round(position.x), Math.round(position.y), false);
});
}

function restoreMainWindow() {
  if (!mainWindow) {
    return;
  }
  bubbleWindow?.hide();
  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function showBubbleWindow() {
  if (!bubbleWindow) {
    bubbleWindow = createBubbleWindow();
  }
  const display = screen.getPrimaryDisplay();
  const size = 68;
  const margin = 24;
  bubbleWindow.setBounds({
    x: display.workArea.x + display.workArea.width - size - margin,
    y: display.workArea.y + display.workArea.height - size - margin,
    width: size,
    height: size
  });
  bubbleWindow.showInactive();
}

function createBubbleWindow() {
  const window = new BrowserWindow({
    width: 68,
    height: 68,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.setAlwaysOnTop(true, "floating");
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.loadURL(buildBubbleHtml());
  window.on("closed", () => {
    bubbleWindow = null;
  });
  return window;
}

ipcMain.handle("load-data", () => store.load());

ipcMain.handle("save-settings", async (_event, settings: AppSettings) => {
  const data = await store.update((draft) => {
    draft.settings = settings;
  });
  mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  return data;
});

ipcMain.handle("list-models", (_event, settings: AppSettings["ai"]) => listModels(settings));

ipcMain.handle("send-chat", async (_event, input: SendChatInput) => {
  const userMessage = createMessage(input.threadId, "user", input.content, input.attachmentIds);
  let data = await store.update((draft) => {
    draft.messages.push(userMessage);
    draft.threads = draft.threads.map((thread) => (thread.id === input.threadId ? touchThread(thread) : thread));
    draft.activeThreadId = input.threadId;
  });

  const thread = data.threads.find((item) => item.id === input.threadId) ?? data.threads[0];
  const ancestors = getThreadAncestors(data, thread.parentId);
  const activeNotebook = data.notebooks.find((notebook) => notebook.id === input.activeNotebookId);
  const threadMessages = data.messages.filter((message) => message.threadId === input.threadId);
  const response = await completeChat({
    settings: data.settings.ai,
    thread,
    ancestors,
    activeNotebook,
    messages: threadMessages,
    attachments: data.attachments,
    userContent: input.content
  });

  data = await store.update((draft) => {
    draft.messages.push(createMessage(input.threadId, "assistant", response));
    draft.threads = draft.threads.map((item) => (item.id === input.threadId ? touchThread(item) : item));
  });
  return data;
});

ipcMain.handle("create-thread", async (_event, input) =>
  store.update((draft) => {
    const thread = createThread(input);
    draft.threads.push(thread);
    draft.activeThreadId = thread.id;
  })
);

ipcMain.handle("set-active-thread", async (_event, id: string) =>
  store.update((draft) => {
    draft.activeThreadId = id;
  })
);

ipcMain.handle("delete-thread", async (_event, id: string) =>
  store.update((draft) => {
    if (draft.threads.length <= 1) {
      return;
    }
    const deleteIds = collectDescendantIds(draft.threads, id);
    draft.threads = draft.threads.filter((thread) => !deleteIds.has(thread.id));
    draft.messages = draft.messages.filter((message) => !deleteIds.has(message.threadId));
    if (!draft.threads.some((thread) => thread.id === draft.activeThreadId)) {
      draft.activeThreadId = draft.threads[0]?.id ?? "root-thread";
    }
  })
);

ipcMain.handle("create-notebook", async (_event, input) =>
  store.update((draft) => {
    const notebook = createNotebook(input);
    draft.notebooks.push(notebook);
    draft.activeNotebookId = notebook.id;
  })
);

ipcMain.handle("update-notebook", async (_event, id: string, patch) =>
  store.update((draft) => {
    draft.notebooks = draft.notebooks.map((notebook) =>
      notebook.id === id ? touchNotebook({ ...notebook, ...patch }) : notebook
    );
  })
);

ipcMain.handle("set-active-notebook", async (_event, id: string) =>
  store.update((draft) => {
    draft.activeNotebookId = id;
  })
);

ipcMain.handle("delete-notebook", async (_event, id: string) =>
  store.update((draft) => {
    if (draft.notebooks.length <= 1) {
      return;
    }
    const deleteIds = collectDescendantIds(draft.notebooks, id);
    draft.notebooks = draft.notebooks.filter((notebook) => !deleteIds.has(notebook.id));
    draft.flashcards = draft.flashcards.filter((card) => !card.sourceId || !deleteIds.has(card.sourceId));
    if (!draft.notebooks.some((notebook) => notebook.id === draft.activeNotebookId)) {
      draft.activeNotebookId = draft.notebooks[0]?.id ?? "root-notebook";
    }
  })
);

ipcMain.handle("create-flashcard", async (_event, input) =>
  store.update((draft) => {
    draft.flashcards.push(createFlashcard(input));
  })
);

ipcMain.handle("delete-flashcard", async (_event, id: string) =>
  store.update((draft) => {
    draft.flashcards = draft.flashcards.filter((card) => card.id !== id);
  })
);

ipcMain.handle("add-attachment", async (_event, input) =>
  store.update((draft) => {
    draft.attachments.push(createAttachment(input));
  })
);

ipcMain.handle("set-always-on-top", async (_event, value: boolean) => {
  mainWindow?.setAlwaysOnTop(value);
  return store.update((draft) => {
    draft.settings.alwaysOnTop = value;
  });
});

ipcMain.handle("capture-region", () => captureRegion());

ipcMain.handle("export-anki-deck", async () => {
  const data = await store.load();
  const cardCount = data.flashcards.length;
  const lines = data.flashcards.map((card) => `${escapeTsv(card.front)}\t${escapeTsv(card.back)}\tSpeakFirst`);
  const saveOptions = {
    title: "Export Anki Import File",
    defaultPath: "speakfirst-anki-cards.tsv",
    filters: [{ name: "Tab-separated values", extensions: ["tsv", "txt"] }]
  };
  const { filePath, canceled } = mainWindow
    ? await dialog.showSaveDialog(mainWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);
  if (canceled || !filePath) {
    return { filePath: "", cardCount: 0 };
  }
  await fs.writeFile(filePath, lines.join("\n"), "utf8");
  return { filePath, cardCount };
});

ipcMain.on("capture-complete", (_event, result) => {
  pendingCaptureResolve?.(result);
  pendingCaptureResolve = null;
  captureWindow?.close();
  captureWindow = null;
});

ipcMain.on("capture-cancel", () => {
  pendingCaptureResolve?.(null);
  pendingCaptureResolve = null;
  captureWindow?.close();
  captureWindow = null;
});

async function captureRegion(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (captureWindow || pendingCaptureResolve) {
    return null;
  }

  const display = screen.getPrimaryDisplay();
  const source = (
    await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: display.size
    })
  )[0];
  const screenshot = source.thumbnail.toDataURL();

  return new Promise((resolve) => {
    pendingCaptureResolve = resolve;
    captureWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      fullscreenable: false,
      transparent: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    captureWindow.setAlwaysOnTop(true, "screen-saver");
    captureWindow.loadURL(buildCaptureHtml(screenshot));
    captureWindow.on("closed", () => {
      pendingCaptureResolve?.(null);
      pendingCaptureResolve = null;
      captureWindow = null;
    });
  });
}

function buildCaptureHtml(screenshot: string) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; cursor: crosshair; font-family: system-ui, sans-serif; }
      body { background: #000; }
      #shot { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: cover; user-select: none; }
      #shade { position: fixed; inset: 0; background: rgba(0, 0, 0, .28); }
      #box { position: fixed; border: 2px solid #7dd3fc; background: rgba(125, 211, 252, .16); display: none; }
      #hint { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); color: white; background: rgba(0,0,0,.72); padding: 10px 14px; border-radius: 999px; font-size: 14px; }
    </style>
  </head>
  <body>
    <img id="shot" src="${screenshot}" />
    <div id="shade"></div>
    <div id="box"></div>
    <div id="hint">Drag to capture an area. Press Esc to cancel.</div>
    <script>
      const img = document.getElementById("shot");
      const box = document.getElementById("box");
      let start = null;
      let current = null;
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") window.captureApi.cancel();
      });
      document.addEventListener("mousedown", (event) => {
        start = { x: event.clientX, y: event.clientY };
        current = start;
        box.style.display = "block";
      });
      document.addEventListener("mousemove", (event) => {
        if (!start) return;
        current = { x: event.clientX, y: event.clientY };
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(start.x - current.x);
        const height = Math.abs(start.y - current.y);
        Object.assign(box.style, { left: left + "px", top: top + "px", width: width + "px", height: height + "px" });
      });
      document.addEventListener("mouseup", () => {
        if (!start || !current) return window.captureApi.cancel();
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(start.x - current.x);
        const height = Math.abs(start.y - current.y);
        if (width < 12 || height < 12) return window.captureApi.cancel();
        const canvas = document.createElement("canvas");
        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;
        canvas.width = Math.round(width * scaleX);
        canvas.height = Math.round(height * scaleY);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, left * scaleX, top * scaleY, width * scaleX, height * scaleY, 0, 0, canvas.width, canvas.height);
        window.captureApi.complete({ dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height });
      });
    </script>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function buildBubbleHtml() {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      button {
        width: 62px;
        height: 62px;
        margin: 3px;
        border: 1px solid rgba(255, 255, 255, .34);
        border-radius: 999px;
        color: #06111f;
        background: radial-gradient(circle at 30% 20%, #e0f2fe, #7dd3fc 46%, #2563eb);
        box-shadow: 0 16px 40px rgba(15, 23, 42, .38);
        cursor: pointer;
        display: grid;
        place-items: center;
        user-select: none;
      }
      button:hover {
        transform: translateY(-1px) scale(1.02);
      }
      strong {
        font-size: 18px;
        letter-spacing: -.08em;
      }
    </style>
  </head>
  <body>
    <button aria-label="Open SpeakFirst" title="Open SpeakFirst">
      <strong>SF</strong>
    </button>
    <script>
      const button = document.querySelector("button");
      let start = null;
      let dragging = false;

      button.addEventListener("mousedown", (event) => {
        start = {
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
          windowX: window.screenX,
          windowY: window.screenY
        };
        dragging = false;
      });

      window.addEventListener("mousemove", (event) => {
        if (!start) return;
        const deltaX = event.screenX - start.screenX;
        const deltaY = event.screenY - start.screenY;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
          dragging = true;
        }
        if (dragging) {
          window.bubbleApi.moveTo({
            x: start.windowX + deltaX,
            y: start.windowY + deltaY
          });
        }
      });

      window.addEventListener("mouseup", () => {
        if (!start) return;
        if (!dragging) {
          window.bubbleApi.restore();
        }
        start = null;
        dragging = false;
      });
    </script>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function getThreadAncestors(data: AppData, parentId: string | null): AppData["threads"] {
  const ancestors = [];
  let cursor = parentId;
  while (cursor) {
    const thread = data.threads.find((item) => item.id === cursor);
    if (!thread) {
      break;
    }
    ancestors.unshift(thread);
    cursor = thread.parentId;
  }
  return ancestors;
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

function escapeTsv(value: string): string {
  return value.replace(/\r?\n/g, "<br>").replace(/\t/g, " ").trim();
}
