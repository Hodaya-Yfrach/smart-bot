// =============================================================================
// types/chat.ts
// טיפוסי הנתונים הבסיסיים לשיחה (צ'אט) בכל הפרויקט.
//
// כיצד עובד מבנה ה-parts:
//   - כל הודעה מורכבת ממערך parts — לרוב יש part אחד בלבד (טקסט),
//     אבל יכולים להיות גם חלקים עם תמונה (inlineData) לצד הטקסט.
//   - inlineData מכיל את התמונה כ-base64 ואת ה-mimeType שלה (image/jpeg וכו').
//   - imageUrl משמש להצגה ב-UI: URL זמני (blob:) בזמן ההקלדה,
//     או data-URL ב-base64 כאשר ההודעה נשמרת/נשלחת.
//
// DEV NOTE:
//   אם רוצים לשמור תמונות בסופאבייס Storage בעתיד, יש להוסיף imageUrl מסוג
//   string לטבלת messages ולהפוך את inlineData לא-חובה בשרת.
// =============================================================================

export type Role = 'user' | 'model';

/** חלק אחד בהודעה — טקסט, תמונת קלט, או תמונה שנוצרה על ידי המודל */
export interface MessagePart {
  /** טקסט רגיל */
  text?: string;
  /** תמונת קלט (שהמשתמש העלה) — נשלחת ל-Gemini Vision */
  inlineData?: {
    mimeType: string;   // לדוגמה: "image/jpeg", "image/png", "image/webp"
    data: string;       // base64 ללא prefix
  };
  /** URL לתצוגה ב-UI בלבד — blob: URL לפני שליחה, data-URL אחריה */
  imageUrl?: string;
  /** תמונה שנוצרה על ידי מודל Image-Generation (base64 PNG) */
  generatedImage?: string;
}

export interface ChatMessage {
  id?: string;
  role: Role;
  parts: MessagePart[];
}

export interface GeminiResponse {
  text: string;
  modelUsed: string;
  failedModels: string[];
  /** base64 של תמונה שנוצרה — מוחזר רק כשמשתמשים במודל image-gen */
  generatedImage?: string;
}
