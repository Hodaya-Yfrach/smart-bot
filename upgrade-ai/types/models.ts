
export type ModelCapability = 'text' | 'vision' | 'image-gen' | 'tts' | 'live-audio';

export interface ModelInfo {
  id: string;
  displayName: string;
  description: string;
  capabilities: ModelCapability[];
  status: 'stable' | 'preview';
}
