export interface CopilotChatInput {
  message: string;
  pageContext?: string;
}

export interface CopilotChatResponse {
  intent: string;
  authorized: boolean;
  message: string;
  actionLink?: string | null;
  actionText?: string | null;
  suggestions: string[];
}

export interface CopilotSuggestionsResponse {
  context: string;
  prompts: string[];
}
