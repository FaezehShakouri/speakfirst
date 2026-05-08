import type { AiModel, AiSettings, Attachment, ChatMessage, ChatThread, Notebook } from "../src/types/app";

interface ChatContext {
  settings: AiSettings;
  thread: ChatThread;
  ancestors: ChatThread[];
  messages: ChatMessage[];
  activeNotebook?: Notebook;
  attachments: Attachment[];
  userContent: string;
}

const jsonHeaders = { "content-type": "application/json" };

export async function listModels(settings: AiSettings): Promise<AiModel[]> {
  if (settings.provider === "openrouter") {
    if (!settings.openRouterApiKey.trim()) {
      return [];
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        authorization: `Bearer ${settings.openRouterApiKey.trim()}`
      }
    });
    if (!response.ok) {
      throw new Error(`OpenRouter model lookup failed: ${response.status}`);
    }
    const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
    return (payload.data ?? []).map((model) => ({
      id: String(model.id ?? ""),
      name: String(model.name ?? model.id ?? "Unnamed model"),
      provider: "openrouter",
      description: typeof model.description === "string" ? model.description : undefined,
      supportsVision: JSON.stringify(model).toLowerCase().includes("image")
    }));
  }

  const baseUrl = normalizeBaseUrl(settings.localBaseUrl);
  const ollama = await tryFetch<{ models?: Array<{ name?: string; model?: string }> }>(`${baseUrl}/api/tags`);
  if (ollama?.models?.length) {
    return ollama.models.map((model) => ({
      id: model.name ?? model.model ?? "",
      name: model.name ?? model.model ?? "Local model",
      provider: "local"
    }));
  }

  const openAiCompatible = await tryFetch<{ data?: Array<{ id?: string }> }>(`${baseUrl}/v1/models`);
  return (openAiCompatible?.data ?? []).map((model) => ({
    id: model.id ?? "",
    name: model.id ?? "Local model",
    provider: "local"
  }));
}

export async function completeChat(context: ChatContext): Promise<string> {
  if (context.settings.provider === "openrouter") {
    return completeOpenRouter(context);
  }
  return completeLocal(context);
}

async function completeOpenRouter(context: ChatContext): Promise<string> {
  const model = context.settings.openRouterModel;
  const apiKey = context.settings.openRouterApiKey.trim();
  if (!apiKey || !model) {
    return "OpenRouter is selected, but an API key and model are required in Settings.";
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://speakfirst.local",
      "X-Title": "SpeakFirst"
    },
    body: JSON.stringify({
      model,
      messages: buildOpenAiMessages(context)
    })
  });

  if (!response.ok) {
    return `OpenRouter request failed with status ${response.status}: ${await response.text()}`;
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? "The model returned an empty response.";
}

async function completeLocal(context: ChatContext): Promise<string> {
  const baseUrl = normalizeBaseUrl(context.settings.localBaseUrl);
  const model = context.settings.localModel;
  if (!model) {
    return "Local AI is selected, but no local model is selected in Settings.";
  }

  const openAiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      model,
      messages: buildOpenAiMessages(context)
    })
  }).catch(() => null);

  if (openAiResponse?.ok) {
    const payload = (await openAiResponse.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? "The local model returned an empty response.";
  }

  const ollamaResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      model,
      stream: false,
      messages: buildOllamaMessages(context)
    })
  }).catch(() => null);

  if (!ollamaResponse?.ok) {
    return "Could not reach a local AI server. Check that Ollama or a compatible local endpoint is running.";
  }

  const payload = (await ollamaResponse.json()) as { message?: { content?: string } };
  return payload.message?.content ?? "The local model returned an empty response.";
}

function buildOpenAiMessages(context: ChatContext) {
  const system = buildSystemPrompt(context);
  const history = context.messages.slice(-16).map((message) => ({
    role: message.role,
    content: message.content
  }));
  const attachments = context.attachments.filter((attachment) => context.messages.at(-1)?.attachmentIds.includes(attachment.id));

  const userContent =
    attachments.length > 0
      ? [
          { type: "text", text: context.userContent },
          ...attachments.map((attachment) => ({
            type: "image_url",
            image_url: { url: attachment.dataUrl }
          }))
        ]
      : context.userContent;

  return [{ role: "system", content: system }, ...history.slice(0, -1), { role: "user", content: userContent }];
}

function buildOllamaMessages(context: ChatContext) {
  return buildOpenAiMessages(context).map((message) => ({
    role: message.role,
    content: Array.isArray(message.content)
      ? message.content.find((part): part is { type: "text"; text: string } => part.type === "text")?.text ?? context.userContent
      : message.content
  }));
}

function buildSystemPrompt(context: ChatContext): string {
  const threadPath = [...context.ancestors, context.thread].map((thread) => thread.title).join(" > ");
  const notebook = context.activeNotebook
    ? `\nActive notebook: ${context.activeNotebook.title}\n${context.activeNotebook.content}`
    : "";
  const quote = context.thread.selectedQuote ? `\nThe current thread was opened from this selection:\n"${context.thread.selectedQuote}"` : "";

  return [
    "You are SpeakFirst, a practical language-learning tutor.",
    "Give clear explanations, examples, corrections, and study prompts.",
    "When useful, identify vocabulary, grammar, pronunciation, and flashcard candidates.",
    `Current thread path: ${threadPath}`,
    quote,
    notebook
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function tryFetch<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(url: string): string {
  return (url || "http://localhost:11434").replace(/\/+$/, "");
}
