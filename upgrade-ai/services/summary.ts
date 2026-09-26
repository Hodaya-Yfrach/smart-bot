// =============================================================================
// services/summary.ts
// פונקציות לקוח לשני נתיבי הסיכום:
//   getChatSummary()       — סיכום מלא (שלבים, מושגים, תמצית) → /api/summary
//   getQuickPromptSummary() — כותרת קצרה עד 7 מילים → /api/quick-summary
//
// DEV NOTE: שתי הפונקציות שולחות את ה-userApiKey בגוף הבקשה (POST),
//           לא ב-URL — המפתח לעולם לא חשוף בכתובת.
// =============================================================================
import { ChatSummary } from '@/types/chatSummary';

export class SummaryApiError extends Error {}

// תקציר מלא של השיחה (שלבים, תקציר כללי, מושגים חדשים) - נשלח לנתיב השרת שלנו בלבד.
// לא שולח יותר selectedModel - השרת תמיד משתמש במודל הקל ביותר לתכונה הזו.
export async function getChatSummary(
  messages: any[],
  userApiKey: string = ''
): Promise<ChatSummary> {
  try {
    const response = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, userApiKey }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new SummaryApiError(data.error || 'שגיאה ביצירת הסיכום.');
    }

    return data.summary as ChatSummary;
  } catch (error) {
    if (error instanceof SummaryApiError) throw error;
    throw new SummaryApiError('נראה שיש בעיית חיבור. אנא נסו שוב.');
  }
}

// תקציר מהיר (עד 7 מילים) לפרומפט בודד, מוצג בסרגל הצד.
// הבקשה יוצאת רק לנתיב השרת שלנו (POST, ה-API key בגוף הבקשה) - לעולם לא ישירות לגוגל מהדפדפן.
export async function getQuickPromptSummary(
  promptText: string,
  userApiKey: string = ''
): Promise<string> {
  try {
    const response = await fetch('/api/quick-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText, userApiKey }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new SummaryApiError(data.error || 'שגיאה ביצירת תקציר קצר.');
    }

    return data.summary as string;
  } catch (error) {
    if (error instanceof SummaryApiError) throw error;
    throw new SummaryApiError('נראה שיש בעיית חיבור.');
  }
}