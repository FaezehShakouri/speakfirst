import type { AiSettings } from "../types/app";
import { listAiModels } from "./aiProvider";

export const listOpenRouterModels = (settings: AiSettings) =>
  listAiModels({
    ...settings,
    provider: "openrouter"
  });
