import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, AiSettings, CreateNotebookInput, CreateThreadInput, DesktopApi, SendChatInput } from "../src/types/app";

const api: DesktopApi = {
  loadData: () => ipcRenderer.invoke("load-data"),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("save-settings", settings),
  listModels: (settings: AiSettings) => ipcRenderer.invoke("list-models", settings),
  sendChat: (input: SendChatInput) => ipcRenderer.invoke("send-chat", input),
  createThread: (input: CreateThreadInput) => ipcRenderer.invoke("create-thread", input),
  setActiveThread: (id: string) => ipcRenderer.invoke("set-active-thread", id),
  deleteThread: (id: string) => ipcRenderer.invoke("delete-thread", id),
  createNotebook: (input: CreateNotebookInput) => ipcRenderer.invoke("create-notebook", input),
  updateNotebook: (id, patch) => ipcRenderer.invoke("update-notebook", id, patch),
  setActiveNotebook: (id: string) => ipcRenderer.invoke("set-active-notebook", id),
  deleteNotebook: (id: string) => ipcRenderer.invoke("delete-notebook", id),
  createFlashcard: (input) => ipcRenderer.invoke("create-flashcard", input),
  deleteFlashcard: (id: string) => ipcRenderer.invoke("delete-flashcard", id),
  exportAnkiDeck: () => ipcRenderer.invoke("export-anki-deck"),
  addAttachment: (input) => ipcRenderer.invoke("add-attachment", input),
  captureRegion: () => ipcRenderer.invoke("capture-region"),
  onCaptureFromShortcut: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, result: Awaited<ReturnType<DesktopApi["captureRegion"]>>) => callback(result);
    ipcRenderer.on("capture-from-shortcut", listener);
    return () => ipcRenderer.removeListener("capture-from-shortcut", listener);
  },
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke("set-always-on-top", value),
  startSrcbookNotebook: () => ipcRenderer.invoke("start-srcbook-notebook"),
  openSrcbookNotebook: () => ipcRenderer.invoke("open-srcbook-notebook")
};

contextBridge.exposeInMainWorld("speakFirst", api);

contextBridge.exposeInMainWorld("captureApi", {
  complete: (result: { dataUrl: string; width: number; height: number }) => ipcRenderer.send("capture-complete", result),
  cancel: () => ipcRenderer.send("capture-cancel")
});

contextBridge.exposeInMainWorld("bubbleApi", {
  restore: () => ipcRenderer.send("restore-main-window"),
  moveTo: (position: { x: number; y: number }) => ipcRenderer.send("move-bubble-window", position)
});
