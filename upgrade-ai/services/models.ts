// =============================================================================
// services/models.ts
// רשימת המודלים הזמינים באפליקציה וכלים נלווים.
//
// MODELS — הרשימה הקנונית. כל מודל שמוסיפים כאן מופיע אוטומטית
//          ב-/api/models וב-select בממשק.
//
// capabilities:
//   'text'      — שיחה טקסטואלית רגילה
//   'tts'       — טקסט לדיבור
//   'live-audio'— שיחה קולית דו-כיוונית (bidiGenerateContent)
//
// DEV NOTE: כדי להוסיף מודל חדש — הוסיפו רשומה ל-MODELS.
//           אין צורך לשנות שום קובץ אחר.
// =============================================================================
import type { ModelInfo } from '@/types/models';

export const MODELS: ModelInfo[] = [
  { id: 'gemini-3.8-flash', displayName: '⚡ מהיר וחדיש', description: 'המודל הכי עדכני, מתאים לשיחה יומיומית ולתמונות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.5-flash-lite', displayName: '🪶 מהיר במיוחד', description: 'הכי חסכוני ומהיר, טוב למשימות פשוטות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.1-pro-preview', displayName: '🧠 חכם ומעמיק', description: 'חשיבה מעמיקה, טוב לניתוחים מורכבים', capabilities: ['text', 'vision'], status: 'preview' },
  { id: 'gemini-3.5-flash', displayName: '🧠⚡ חכם ומהיר', description: 'כמעט באותה רמה של החכם המעמיק, אבל מהיר יותר', capabilities: ['text', 'vision'], status: 'stable' },
];

export const MODEL_ALIASES: Record<string, string> = {};

export function resolveModel(name: string): string {
  return MODEL_ALIASES[name] || name;
}

export function getPublicModelList() {
  return MODELS.map(({ id, displayName, description, capabilities, status }) => ({
    id, displayName, description, capabilities, status,
  }));
}