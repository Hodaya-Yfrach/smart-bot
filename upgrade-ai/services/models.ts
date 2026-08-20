import type { ModelInfo } from '@/types/models';

export const MODELS: ModelInfo[] = [
  { id: 'gemini-3.7-flash', displayName: 'Flash — מהיר ומאוזן', description: 'שיחה כללית, תמיכה בתמונות בקלט', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-pro', displayName: 'Pro — חשיבה עמוקה', description: 'ניתוח מורכב, תשובות מדויקות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-2.5-flash-lite', displayName: 'Flash Lite — הכי זול', description: 'משימות פשוטות ומהירות', capabilities: ['text', 'vision'], status: 'stable' },
  { id: 'gemini-3.1-flash-image', displayName: 'יצירת תמונות', description: 'הפקת תמונות מטקסט', capabilities: ['image-gen'], status: 'stable' },
  { id: 'gemini-3.1-flash-tts-preview', displayName: 'קול — טקסט לדיבור', description: 'הקראת תשובות בקול', capabilities: ['tts'], status: 'preview' },
  { id: 'gemini-3.1-flash-live-preview', displayName: 'שיחה קולית חיה', description: 'דיבור דו-כיווני בזמן אמת', capabilities: ['live-audio'], status: 'preview' },
];

export const MODEL_ALIASES: Record<string, string> = {
  'gemini-3.5-flash': 'gemini-2.5-flash',
  'gemini-3.1-flash-lite': 'gemini-2.5-flash-lite',
  'gemini-3-flash-preview': 'gemini-3.6-flash',
};

export function resolveModel(name: string): string {
  return MODEL_ALIASES[name] || name;
}

export function getPublicModelList() {
  return MODELS.map(({ id, displayName, description, capabilities, status }) => ({
    id, displayName, description, capabilities, status,
  }));
}