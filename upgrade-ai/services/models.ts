import type { ModelInfo } from '@/types/models';

export const MODELS: ModelInfo[] = [
  { id: 'gemini-3.7-flash', displayName: 'Flash 3.7 — הכי חדש ומאוזן', description: 'שיחה כללית, תמיכה בתמונות בקלט', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.5-flash', displayName: 'Flash 3.5 — מהיר וחכם', description: 'שיחה כללית, תמיכה בתמונות בקלט', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-pro', displayName: 'Pro — חשיבה עמוקה', description: 'ניתוח מורכב, תשובות מדויקות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash', displayName: 'Flash 2.5 — מהיר ומוכח', description: 'שיחה כללית עם תמיכת חשיבה', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash-lite', displayName: 'Flash Lite — הכי קל וזול', description: 'משימות פשוטות ומהירות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.1-flash-image', displayName: 'יצירת תמונות', description: 'הפקת תמונות מטקסט', capabilities: ['image-gen'], status: 'stable' },
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