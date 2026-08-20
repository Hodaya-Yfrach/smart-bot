// =============================================================================
// services/gemini.ts
// שכבת השירות בצד הלקוח לתקשורת עם ה-API שלנו (/api/chat, /api/models).
//
// חשוב: הקוד הזה רץ בדפדפן — הוא לעולם לא שולח את מפתח ה-API ישירות לגוגל.
// כל הבקשות עוברות דרך ה-Route Handlers שלנו ב-app/api/, שם המפתח מאובטח.
//
// מה כאן:
//   - GeminiResponse  — טיפוס התשובה המלאה מ-/api/chat
//   - ChatApiError    — מחלקת שגיאה מועשרת שמכילה גם את רשימת המודלים שנכשלו
//   - getAvailableModels() — מביא את רשימת המודלים הזמינים מ-/api/models
//   - askGemini()     — שולח הודעה ומחזיר תשובה
//
// =============================================================================

import { supabase } from './supabase';
import type { ModelInfo } from '@/types/models';
import type { ChatMessage, GeminiResponse } from '@/types/chat';

// ─── מחלקת שגיאה מותאמת ───────────────────────────────────────────────────────
// מרחיבה את Error הרגיל בשדה failedModels — מאפשר לממשק להאפיל מודלים עמוסים
// ולא לנסות אותם שוב באותה הסשן.
export class ChatApiError extends Error {
  failedModels: string[];

  constructor(message: string, failedModels: string[] = []) {
    super(message);
    this.name = 'ChatApiError';
    this.failedModels = failedModels;
  }
}

// ─── טעינת רשימת מודלים ───────────────────────────────────────────────────────
// DEV NOTE: הפונקציה נקראת מ-page.tsx בטעינה ראשונית (useEffect עם []).
// אין צורך לקרוא לה שוב — המצב נשמר ב-state של הקומפוננטה.
export async function getAvailableModels(): Promise<ModelInfo[]> {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('לא ניתן לטעון את רשימת המודלים כרגע.');
  }
  const data = await response.json();
  return data.models;
}

// ─── שליחת הודעה לגמיני ───────────────────────────────────────────────────────
/**
 * שולחת הודעת משתמש חדשה לשרת שלנו (/api/chat) ומחזירה את תשובת המודל.
 *
 * @param userText        - טקסט ההודעה החדשה של המשתמש
 * @param history         - היסטוריית השיחה (ללא ההודעה החדשה)
 * @param systemInstruction - הוראות מערכת (כללים גלובליים + כללי שיחה)
 * @param selectedModel   - מזהה המודל הנבחר (לדוגמה "gemini-3.7-flash")
 * @param fallbackModels  - מודלים לגיבוי אם הנבחר נכשל
 * @param userApiKey      - מפתח אישי (BYOK); ריק = שימוש במפתח האתר
 * @param isGuest         - האם מצב אורח (מוגבל לשאלה אחת)
 */
export async function askGemini(
  userText: string,
  history: ChatMessage[],
  systemInstruction: string,
  selectedModel: string,
  fallbackModels: string[] = [],
  userApiKey: string = '',
  isGuest = false,
  imageBase64?: string,
  imageMimeType = 'image/jpeg',
  studyMode = false,
  studyQuestionMode: 'ai' | 'user' = 'ai',
): Promise<GeminiResponse> {

  // בונים את ההיסטוריה המלאה כולל ההודעה החדשה
  const latestParts = imageBase64
    ? [{ inlineData: { mimeType: imageMimeType, data: imageBase64 } }, { text: userText }]
    : [{ text: userText }];
  const messages = [
    ...history,
    { role: 'user' as const, parts: latestParts },
  ];

  try {
    // מצרפים את ה-JWT של המשתמש המחובר (אם קיים) כ-Authorization header
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        systemInstruction,
        selectedModel,
        fallbackModels,
        userApiKey,
        isGuest,
        studyMode,
        studyQuestionMode,
      }),
    });

    const data = await response.json();

    // תשובת שגיאה מהשרת (400, 429, 503 וכו')
    if (!response.ok || data.error) {
      throw new ChatApiError(
        data.error || 'אירעה שגיאה בלתי צפויה בתקשורת מול השרת.',
        data.failedModels || [],
      );
    }

    return {
      text: data.text,
      modelUsed: data.modelUsed,
      failedModels: data.failedModels || [],
      studyScore: typeof data.studyScore === 'number' ? data.studyScore : undefined,
    };

  } catch (error: any) {
    // שגיאת ChatApiError שלנו — מועברת הלאה כמו שהיא
    if (error instanceof ChatApiError) throw error;

    // שגיאת רשת (ניתוק אינטרנט, timeout וכו')
    throw new ChatApiError(
      'נראה שיש בעיית חיבור לאינטרנט או שהשרת לא זמין כרגע. אנא בדקו את החיבור ונסו שוב.',
      [],
    );
  }
}
