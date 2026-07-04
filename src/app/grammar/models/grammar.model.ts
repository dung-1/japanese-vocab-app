export interface GrammarExample {
  japanese: string;
  reading: string;
  english: string;
}

export interface GrammarConnection {
  formula: string;
  note: string;
}

export interface GrammarMnemonic {
  concept: string;
  kanji_link: string;
  story: string;
}

export interface GrammarItem {
  id: string;
  domain: 'grammar';
  pattern: string;
  meaning: string;
  connection: GrammarConnection;
  core_nuance: string;
  mnemonic: GrammarMnemonic;
  examples: GrammarExample[];
  ai_ollama_prompt_hint: string;
}

export interface GrammarQuizQuestion {
  id: string;
  type: 'meaning-to-pattern' | 'pattern-to-meaning' | 'fill-blank' | 'formula-check' | 'example-match';
  question: string;
  correctAnswer: string;
  options: string[];
  grammarItem: GrammarItem;
}

export interface GrammarQuizResult {
  question: GrammarQuizQuestion;
  userAnswer: string;
  isCorrect: boolean;
}
