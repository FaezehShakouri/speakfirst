import type { AppData, AppSettings } from "../types/app";

export const loadData = (): Promise<AppData> => window.speakFirst.loadData();

export const saveSettings = (settings: AppSettings): Promise<AppData> => window.speakFirst.saveSettings(settings);
