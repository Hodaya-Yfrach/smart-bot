
// =============================================================================
// types/models.ts
// טיפוסי המודלים — משותפים לשרת ולדפדפן.
// ModelCapability מגדיר את היכולות האפשריות; ModelInfo את מבנה כל מודל.
// =============================================================================

export type ModelCapability = 'text' | 'vision' | 'tts' | 'live-audio';

export interface ModelInfo {
  id: string;
  displayName: string;
  description: string;
  capabilities: ModelCapability[];
  status: 'stable' | 'preview';
}
