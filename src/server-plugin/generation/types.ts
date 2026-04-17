export type BridgeRole = 'user' | 'assistant';

export type BridgePromptMessage = {
  role: BridgeRole;
  content: string;
};

export type BridgePrompt = {
  system: string[];
  messages: BridgePromptMessage[];
};

export type PromptProfile = {
  enabled: boolean;
  promptName: string;
  displayName: string;
  persona: string;
};
