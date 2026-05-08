import type { AiSettings } from "../types/app";
import { listAiModels } from "./aiProvider";

export const listLocalModels = (settings: AiSettings) =>
  listAiModels({
    ...settings,
    provider: "local"
  });
