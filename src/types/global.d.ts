import type { DesktopApi } from "./app";

declare global {
  interface Window {
    speakFirst: DesktopApi;
  }
}

export {};
