export type ChatMode = 'discussion' | 'global_edit' | 'research';

export interface ModeDetectionResult {
  mode: ChatMode;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

export function detectChatMode(message: string): ModeDetectionResult {
  return { mode: 'discussion', confidence: 'high', matchedPatterns: [] };
}
