import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import type {
  AppData,
  AppSettings,
  Attachment,
  ChatMessage,
  ChatThread,
  CreateNotebookInput,
  CreateThreadInput,
  Flashcard,
  Notebook
} from "../src/types/app";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

const defaultSettings: AppSettings = {
  ai: {
    provider: "openrouter",
    openRouterApiKey: "",
    openRouterModel: "",
    localBaseUrl: "http://localhost:11434",
    localModel: ""
  },
  theme: "system",
  alwaysOnTop: true
};

export class Store {
  private readonly filePath: string;
  private dbPromise: Promise<Database> | null = null;

  constructor() {
    this.filePath = path.join(app.getPath("userData"), "speakfirst.sqlite");
  }

  async load(): Promise<AppData> {
    const db = await this.getDb();
    const result = db.exec("SELECT value FROM app_state WHERE key = 'data'");
    const raw = result[0]?.values[0]?.[0];
    if (typeof raw === "string") {
      return this.ensureDefaults(JSON.parse(raw) as Partial<AppData>);
    }
    const data = this.ensureDefaults({});
    await this.save(data);
    return data;
  }

  async save(data: AppData): Promise<AppData> {
    const db = await this.getDb();
    db.run("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)", ["data", JSON.stringify(data)]);
    await this.persist(db);
    return data;
  }

  async update(mutator: (data: AppData) => AppData | void): Promise<AppData> {
    const data = await this.load();
    const next = mutator(data) ?? data;
    return this.save(next);
  }

  private async getDb(): Promise<Database> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDb();
    }
    return this.dbPromise;
  }

  private async openDb(): Promise<Database> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(path.dirname(require.resolve("sql.js")), file)
    });

    let db: Database;
    try {
      const bytes = await fs.readFile(this.filePath);
      db = new SQL.Database(bytes);
    } catch {
      db = new SQL.Database();
    }
    db.run("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    return db;
  }

  private async persist(db: Database) {
    await fs.writeFile(this.filePath, Buffer.from(db.export()));
  }

  private ensureDefaults(partial: Partial<AppData>): AppData {
    const createdAt = now();
    const rootThread: ChatThread = {
      id: "root-thread",
      parentId: null,
      title: "Daily tutor",
      createdAt,
      updatedAt: createdAt
    };
    const rootNotebook: Notebook = {
      id: "root-notebook",
      parentId: null,
      title: "Main notebook",
      content: "# Main notebook\n\nCollect phrases, grammar notes, and questions here.",
      createdAt,
      updatedAt: createdAt
    };

    const threads = partial.threads?.length ? partial.threads : [rootThread];
    const notebooks = partial.notebooks?.length ? partial.notebooks : [rootNotebook];

    return {
      settings: {
        ...defaultSettings,
        ...partial.settings,
        ai: {
          ...defaultSettings.ai,
          ...partial.settings?.ai
        }
      },
      threads,
      messages: partial.messages ?? [],
      notebooks,
      flashcards: partial.flashcards ?? [],
      attachments: partial.attachments ?? [],
      activeThreadId: partial.activeThreadId ?? threads[0].id,
      activeNotebookId: partial.activeNotebookId ?? notebooks[0].id
    };
  }
}

export const createThread = (input: CreateThreadInput): ChatThread => {
  const createdAt = now();
  return {
    id: id(),
    parentId: input.parentId,
    title: input.title || "Follow-up",
    selectedQuote: input.selectedQuote,
    sourceMessageId: input.sourceMessageId,
    createdAt,
    updatedAt: createdAt
  };
};

export const createNotebook = (input: CreateNotebookInput): Notebook => {
  const createdAt = now();
  return {
    id: id(),
    parentId: input.parentId,
    title: input.title || "Nested note",
    content: input.content ?? "",
    selectedQuote: input.selectedQuote,
    createdAt,
    updatedAt: createdAt
  };
};

export const createMessage = (
  threadId: string,
  role: ChatMessage["role"],
  content: string,
  attachmentIds: string[] = []
): ChatMessage => ({
  id: id(),
  threadId,
  role,
  content,
  attachmentIds,
  createdAt: now()
});

export const createAttachment = (input: Omit<Attachment, "id" | "createdAt">): Attachment => ({
  ...input,
  id: id(),
  createdAt: now()
});

export const createFlashcard = (input: Omit<Flashcard, "id" | "createdAt">): Flashcard => ({
  ...input,
  id: id(),
  createdAt: now()
});

export const touchThread = (thread: ChatThread): ChatThread => ({
  ...thread,
  updatedAt: now()
});

export const touchNotebook = (notebook: Notebook): Notebook => ({
  ...notebook,
  updatedAt: now()
});
