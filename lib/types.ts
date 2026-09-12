/**
 * Shapes shared by the GraphQL API, the Mongoose models and the UI.
 * The API is the contract: everything here mirrors the schema in
 * `lib/graphql/typeDefs.ts`, so a different frontend can be written against
 * the same types without touching the server.
 */

export type Option = {
  id: string;
  text: string;
};

/** Question as the player sees it: no answer key. */
export type Question = {
  id: string;
  text: string;
  options: Option[];
  order: number;
};

/** Question as the builder sees it. */
export type AdminQuestion = Question & {
  correctOptionId: string;
  explanation: string | null;
};

export type QuizSettings = {
  requireOptIn: boolean;
  optInText: string | null;
  showCorrectAnswers: boolean;
  allowRetake: boolean;
  primaryColor: string | null;
  logoUrl: string | null;
  expiresAt: string | null;
};

export type MissedQuestion = {
  questionId: string;
  text: string;
  misses: number;
  correct: number;
};

export type QuizStats = {
  starts: number;
  completions: number;
  averageScore: number;
  mostMissed: MissedQuestion[];
};

export type Quiz = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  settings: QuizSettings;
  questions: Question[];
  stats: QuizStats;
};

export type AdminQuiz = Omit<Quiz, 'questions'> & {
  questions: AdminQuestion[];
};

export type QuizSummary = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  updatedAt: string;
  questionCount: number;
  stats: QuizStats;
};

export type StartResult = {
  id: string;
  started: boolean;
  totalQuestions: number;
};

export type AnswerResult = {
  questionId: string;
  chosenOptionId: string | null;
  correctOptionId: string | null;
  correct: boolean;
  explanation: string | null;
};

export type QuizResult = {
  id: string;
  score: number;
  total: number;
  percent: number;
  results: AnswerResult[];
};

/* ------------------------------------------------------------------ inputs */

export type OptionInput = {
  id?: string | null;
  text: string;
};

export type QuestionInput = {
  id?: string | null;
  text: string;
  options: OptionInput[];
  correctOptionId?: string | null;
  explanation?: string | null;
};

export type QuizSettingsInput = {
  requireOptIn?: boolean | null;
  optInText?: string | null;
  showCorrectAnswers?: boolean | null;
  allowRetake?: boolean | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  expiresAt?: string | null;
};

export type CreateQuizInput = {
  title: string;
  description?: string | null;
  slug?: string | null;
  settings?: QuizSettingsInput | null;
  questions?: QuestionInput[] | null;
};

export type UpdateQuizInput = {
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  settings?: QuizSettingsInput | null;
  questions?: QuestionInput[] | null;
};

export type SubmitQuizInput = {
  id: string;
  answers: Array<{ questionId: string; optionId?: string | null }>;
};
