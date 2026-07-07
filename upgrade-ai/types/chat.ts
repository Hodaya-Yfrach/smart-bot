// types/chat.ts
export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}