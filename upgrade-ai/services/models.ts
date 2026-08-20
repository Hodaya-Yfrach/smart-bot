// =============================================================================
// services/models.ts
// רשימת המודלים הזמינים באפליקציה וכלים נלווים.
//
// MODELS — הרשימה הקנונית. כל מודל שמוסיפים כאן מופיע אוטומטית
//          ב-/api/models וב-select בממשק.
//
// capabilities:
//   'text'      — שיחה טקסטואלית רגילה
//   'vision'    — תמיכה בתמונת קלט (Gemini Vision)
//   'image-gen' — יצירת תמונה מטקסט (responseModalities: Image)
//   'tts'       — טקסט לדיבור
//   'live-audio'— שיחה קולית דו-כיוונית (bidiGenerateContent)
//
// DEV NOTE: כדי להוסיף מודל חדש — הוסיפו רשומה ל-MODELS.
//           אין צורך לשנות שום קובץ אחר.
// =============================================================================
import type { ModelInfo } from '@/types/models';

export const MODELS: ModelInfo[] = [
  { id: 'gemini-3.7-flash', displayName: 'Flash 3.7 — הכי חדש ומאוזן', description: 'שיחה כללית, תמיכה בתמונות בקלט', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.5-flash', displayName: 'Flash 3.5 — מהיר וחכם', description: 'שיחה כללית, תמיכה בתמונות בקלט', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-pro', displayName: 'Pro — חשיבה עמוקה', description: 'ניתוח מורכב, תשובות מדויקות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash', displayName: 'Flash 2.5 — מהיר ומוכח', description: 'שיחה כללית עם תמיכת חשיבה', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash-lite', displayName: 'Flash Lite — הכי קל וזול', description: 'משימות פשוטות ומהירות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash-image', displayName: 'יצירת תמונות', description: 'הפקת תמונות מטקסט (Imagen)', capabilities: ['image-gen'], status: 'stable' },
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