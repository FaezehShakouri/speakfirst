export type AiProviderKind = "openrouter" | "local";

export type ThemePreference = "system" | "light" | "dark";

export interface AiSettings {
  provider: AiProviderKind;
  openRouterApiKey: string;
  openRouterModel: string;
  localBaseUrl: string;
  localModel: string;
}

export interface AppSettings {
  ai: AiSettings;
  theme: ThemePreference;
  alwaysOnTop: boolean;
}

export interface AiModel {
  id: string;
  name: string;
  provider: AiProviderKind;
  description?: string;
  supportsVision?: boolean;
}

export interface Attachment {
  id: string;
  kind: "image";
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  parentId: string | null;
  title: string;
  selectedQuote?: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachmentIds: string[];
  createdAt: string;
}

export interface Notebook {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  selectedQuote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  sourceType: "chat" | "notebook" | "manual";
  sourceId?: string;
  createdAt: string;
}

export interface AppData {
  settings: AppSettings;
  threads: ChatThread[];
  messages: ChatMessage[];
  notebooks: Notebook[];
  flashcards: Flashcard[];
  attachments: Attachment[];
  activeThreadId: string;
  activeNotebookId: string;
}

export interface SendChatInput {
  threadId: string;
  content: string;
  attachmentIds: string[];
  activeNotebookId?: string;
}

export interface CreateThreadInput {
  parentId: string | null;
  title: string;
  selectedQuote?: string;
  sourceMessageId?: string;
}

export interface CreateNotebookInput {
  parentId: string | null;
  title: string;
  content?: string;
  selectedQuote?: string;
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
}

export interface DesktopApi {
  loadData(): Promise<AppData>;
  saveSettings(settings: AppSettings): Promise<AppData>;
  listModels(settings: AiSettings): Promise<AiModel[]>;
  sendChat(input: SendChatInput): Promise<AppData>;
  createThread(input: CreateThreadInput): Promise<AppData>;
  setActiveThread(id: string): Promise<AppData>;
  deleteThread(id: string): Promise<AppData>;
  createNotebook(input: CreateNotebookInput): Promise<AppData>;
  updateNotebook(id: string, patch: Pick<Notebook, "title" | "content">): Promise<AppData>;
  setActiveNotebook(id: string): Promise<AppData>;
  deleteNotebook(id: string): Promise<AppData>;
  createFlashcard(input: Omit<Flashcard, "id" | "createdAt">): Promise<AppData>;
  deleteFlashcard(id: string): Promise<AppData>;
  exportAnkiDeck(): Promise<{ filePath: string; cardCount: number }>;
  addAttachment(input: Omit<Attachment, "id" | "createdAt">): Promise<AppData>;
  captureRegion(): Promise<CaptureResult | null>;
  onCaptureFromShortcut(callback: (result: CaptureResult | null) => void): () => void;
  setAlwaysOnTop(value: boolean): Promise<AppData>;
}
