// types/chatSummary.ts
// טיפוסים חדשים לתכונת "תקציר שיחה". קובץ נפרד כדי לא לגעת ב-types/chat.ts הקיים.

export interface ChatTurnSummary {
  topic: string;       // עד שורה אחת - במה עסקה תשובת העוזר בסבב הזה
  nextPrompt: string;  // עד שורה אחת - השאלה/הפרומפט הבא של המשתמש (אם קיים)
}

export interface NewTermSummary {
  term: string;        // שם המושג
  explanation: string; // הסבר קצר, עד 2 שורות
}

export interface ChatSummary {
  turns: ChatTurnSummary[];
  oneLineSummary: string;    // תמצית מלאה של השיחה בשורה אחת - ברירת המחדל המוצגת
  overallSummary: string[]; // עד 3 מחרוזות (3 שורות) - הגרסה המורחבת
  newTerms: NewTermSummary[];
}