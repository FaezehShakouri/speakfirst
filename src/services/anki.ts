import type { Flashcard } from "../types/app";

export const createFlashcard = (input: Omit<Flashcard, "id" | "createdAt">) => window.speakFirst.createFlashcard(input);

export const exportAnkiDeck = () => window.speakFirst.exportAnkiDeck();
