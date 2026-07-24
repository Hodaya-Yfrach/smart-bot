export type Role = 'user' | 'model';

export interface ChatMessage {
  role: Role;
  parts: { text: string }[];
}
export interface GeminiResponse {
  text: string;
  modelUsed: string;
  failedModels: string[];
}