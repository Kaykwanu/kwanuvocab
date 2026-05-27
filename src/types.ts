export interface RootPart {
  part: string;
  think: string;
  clue: string;
}

export interface QuizOption {
  letter: "A" | "B" | "C" | "D";
  text: string;
  correct?: boolean;
}

export interface SoundBridge {
  hook: string;
  explain: string;
}

export interface GREWord {
  id: string;
  word: string;
  pos?: string;
  soundBridge?: SoundBridge;
  roots: RootPart[];
  summary: string;
  exampleSentence?: string;
  synonyms?: string;
  options: QuizOption[];
  isCustom?: boolean;
  sheetIndex?: number;
}

export interface QuizSession {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scores: Record<string, boolean>;
  chosenIndices: Record<string, number>;
}

export type AppMode = "study" | "quiz";
export type WordCategory = "all" | "bookmarked";
