export interface ICopyPaste {
	requestBotSuggestion(): void;
	receiveBotSuggestion(suggestion: string): void;
	clearBotSuggestions(): void;
}