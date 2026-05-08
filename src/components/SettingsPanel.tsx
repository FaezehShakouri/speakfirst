import { useEffect, useState } from "react";
import type { AiModel, AppSettings } from "../types/app";
import { listAiModels } from "../services/aiProvider";

interface Props {
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
}

export default function SettingsPanel({ settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState("");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const refreshModels = async () => {
    setLoadingModels(true);
    setModelError("");
    try {
      setModels(await listAiModels(draft.ai));
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Could not load models.");
    } finally {
      setLoadingModels(false);
    }
  };

  const selectedModel = draft.ai.provider === "openrouter" ? draft.ai.openRouterModel : draft.ai.localModel;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-label="Settings">
        <header>
          <div>
            <span className="eyebrow">Settings</span>
            <h2>AI provider</h2>
          </div>
          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="field-row">
          <label>
            Provider
            <select
              value={draft.ai.provider}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  ai: { ...draft.ai, provider: event.target.value as AppSettings["ai"]["provider"] }
                })
              }
            >
              <option value="openrouter">OpenRouter</option>
              <option value="local">Local AI</option>
            </select>
          </label>
          <label>
            Theme
            <select value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as AppSettings["theme"] })}>
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>

        {draft.ai.provider === "openrouter" ? (
          <label>
            OpenRouter API key
            <input
              type="password"
              value={draft.ai.openRouterApiKey}
              placeholder="sk-or-..."
              onChange={(event) => setDraft({ ...draft, ai: { ...draft.ai, openRouterApiKey: event.target.value } })}
            />
          </label>
        ) : (
          <label>
            Local endpoint
            <input
              value={draft.ai.localBaseUrl}
              placeholder="http://localhost:11434"
              onChange={(event) => setDraft({ ...draft, ai: { ...draft.ai, localBaseUrl: event.target.value } })}
            />
          </label>
        )}

        <div className="model-picker">
          <div className="field-row">
            <label>
              Model
              <input
                list="ai-models"
                value={selectedModel}
                placeholder="Refresh models or type a model id"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    ai:
                      draft.ai.provider === "openrouter"
                        ? { ...draft.ai, openRouterModel: event.target.value }
                        : { ...draft.ai, localModel: event.target.value }
                  })
                }
              />
              <datalist id="ai-models">
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </datalist>
            </label>
            <button className="secondary-button" onClick={refreshModels} disabled={loadingModels}>
              {loadingModels ? "Loading..." : "Refresh models"}
            </button>
          </div>
          {modelError && <p className="form-error">{modelError}</p>}
          <p className="muted">
            OpenRouter uses your API key to fetch the live model list. Local AI defaults to Ollama and also supports
            OpenAI-compatible local servers.
          </p>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.alwaysOnTop}
            onChange={(event) => setDraft({ ...draft, alwaysOnTop: event.target.checked })}
          />
          Keep app always on top
        </label>

        <footer>
          <button className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" onClick={() => onSave(draft)}>
            Save settings
          </button>
        </footer>
      </section>
    </div>
  );
}
