export interface CatholicQuestion {
  id: number;
  question: string;
  answer: string;
  distractors: string[];
  reference?: string;
}
