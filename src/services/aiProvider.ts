import type { AiModel, AiSettings, SendChatInput } from "../types/app";

export const listAiModels = (settings: AiSettings): Promise<AiModel[]> => window.speakFirst.listModels(settings);

export const sendChatMessage = (input: SendChatInput) => window.speakFirst.sendChat(input);
