// =============================================================================
// types/chat.ts
// טיפוסי הנתונים הבסיסיים לשיחה (צ'אט) בכל הפרויקט.
//
// כל הודעה מורכבת ממערך parts של טקסט.
// =============================================================================

export type Role = 'user' | 'model';

/** חלק טקסטואלי אחד בהודעה */
export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  imageUrl?: string;
}

export interface ChatMessage {
  id?: string;
  role: Role;
  parts: MessagePart[];
  studyScore?: number;
}

export interface GeminiResponse {
  text: string;
  modelUsed: string;
  failedModels: string[];
  studyScore?: number;
}
