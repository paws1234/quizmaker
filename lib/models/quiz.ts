import { Schema, model, models, type Model } from 'mongoose';
import type { AdminQuestion, Question, QuizSettings } from '../types';

/**
 * Persistence for quizzes.
 *
 * The document matches the data model in plan.md: one document per quiz with
 * questions embedded, because a quiz is always read and written as a whole.
 */

export const DEFAULT_SETTINGS: QuizSettings = {
  requireOptIn: false,
  optInText: null,
  showCorrectAnswers: true,
  allowRetake: true,
  primaryColor: '#4f46e5',
  logoUrl: null,
  expiresAt: null,
};

const OptionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const QuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    options: { type: [OptionSchema], default: [] },
    correctOptionId: { type: String, required: true },
    explanation: { type: String, default: null },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const SettingsSchema = new Schema(
  {
    requireOptIn: { type: Boolean, default: DEFAULT_SETTINGS.requireOptIn },
    optInText: { type: String, default: DEFAULT_SETTINGS.optInText },
    showCorrectAnswers: { type: Boolean, default: DEFAULT_SETTINGS.showCorrectAnswers },
    allowRetake: { type: Boolean, default: DEFAULT_SETTINGS.allowRetake },
    primaryColor: { type: String, default: DEFAULT_SETTINGS.primaryColor },
    logoUrl: { type: String, default: DEFAULT_SETTINGS.logoUrl },
    expiresAt: { type: Date, default: DEFAULT_SETTINGS.expiresAt },
  },
  { _id: false },
);

const StatsSchema = new Schema(
  {
    starts: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    // { [questionId]: { misses, correct } } - keyed by question so a single
    // $inc records a result without rewriting the quiz document.
    questionStats: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const QuizSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    slug: { type: String, default: null, index: true, sparse: true },
    version: { type: Number, default: 1 },
    title: { type: String, required: true },
    description: { type: String, default: null },
    settings: { type: SettingsSchema, default: () => ({}) },
    questions: { type: [QuestionSchema], default: [] },
    stats: { type: StatsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    collection: 'quizzes',
  },
);

/** A quiz as stored in MongoDB (dates are real Dates here, ISO strings over GraphQL). */
export type QuizRecord = {
  id: string;
  slug: string | null;
  version: number;
  title: string;
  description: string | null;
  settings: QuizSettings;
  questions: AdminQuestion[];
  stats: {
    starts: number;
    completions: number;
    totalScore: number;
    questionStats: Record<string, { misses?: number; correct?: number }>;
  };
  createdAt: Date;
  updatedAt: Date;
};

/** Reused across hot reloads so the model is only registered once. */
export const QuizModel: Model<QuizRecord> =
  (models.Quiz as Model<QuizRecord> | undefined) ??
  (model('Quiz', QuizSchema) as unknown as Model<QuizRecord>);

/** Questions are serialised in stored order; `order` is the source of truth. */
export function sortedQuestions(questions: AdminQuestion[]): AdminQuestion[] {
  return [...questions].sort((a, b) => a.order - b.order);
}

export function toPlayerQuestions(questions: AdminQuestion[]): Question[] {
  return sortedQuestions(questions).map((question) => ({
    id: question.id,
    text: question.text,
    order: question.order,
    options: question.options.map((option) => ({ id: option.id, text: option.text })),
  }));
}
