import { GraphQLError } from 'graphql';
import { connectDB } from '../db';
import { newQuizId } from '../ids';
import { DEFAULT_SETTINGS, QuizModel, toPlayerQuestions, sortedQuestions, type QuizRecord } from '../models/quiz';
import type {
  AdminQuestion,
  AdminQuiz,
  CreateQuizInput,
  MissedQuestion,
  Quiz,
  QuizSettings,
  QuizStats,
  QuizSummary,
  SubmitQuizInput,
  UpdateQuizInput,
} from '../types';
import { requireAdmin, type GraphQLContext } from './context';
import {
  normaliseAnswers,
  normaliseDescription,
  normaliseQuestions,
  normaliseSettings,
  normaliseSlug,
  normaliseTitle,
} from './normalise';
import { DateTimeScalar } from './scalars';

/* --------------------------------------------------------------- utilities */

function badInput(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function notFound(): never {
  throw new GraphQLError('Quiz not found.', { extensions: { code: 'NOT_FOUND' } });
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function settingsOf(doc: QuizRecord): QuizSettings {
  const stored = (doc.settings ?? {}) as Partial<QuizSettings>;
  return {
    requireOptIn: stored.requireOptIn ?? DEFAULT_SETTINGS.requireOptIn,
    optInText: stored.optInText ?? null,
    showCorrectAnswers: stored.showCorrectAnswers ?? DEFAULT_SETTINGS.showCorrectAnswers,
    allowRetake: stored.allowRetake ?? DEFAULT_SETTINGS.allowRetake,
    primaryColor: stored.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
    logoUrl: stored.logoUrl ?? null,
    expiresAt: iso(stored.expiresAt),
  };
}

function statsOf(doc: QuizRecord): QuizStats {
  const raw = doc.stats ?? { starts: 0, completions: 0, totalScore: 0, questionStats: {} };
  const perQuestion = (raw.questionStats ?? {}) as Record<string, { misses?: number; correct?: number }>;
  const texts = new Map((doc.questions ?? []).map((question) => [question.id, question.text]));

  const mostMissed: MissedQuestion[] = Object.entries(perQuestion)
    .map(([questionId, value]) => ({
      questionId,
      text: texts.get(questionId) ?? 'Removed question',
      misses: value?.misses ?? 0,
      correct: value?.correct ?? 0,
    }))
    .filter((entry) => entry.misses > 0)
    // Most missed first; ties broken by how often it was answered correctly.
    .sort((a, b) => b.misses - a.misses || a.correct - b.correct)
    .slice(0, 5);

  const completions = raw.completions ?? 0;
  return {
    starts: raw.starts ?? 0,
    completions,
    averageScore: completions > 0 ? (raw.totalScore ?? 0) / completions : 0,
    mostMissed,
  };
}

function shapeBase(doc: QuizRecord) {
  return {
    id: doc.id,
    slug: doc.slug ?? null,
    title: doc.title,
    description: doc.description ?? null,
    createdAt: iso(doc.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(doc.updatedAt) ?? new Date(0).toISOString(),
    settings: settingsOf(doc),
    stats: statsOf(doc),
  };
}

function shapeQuiz(doc: QuizRecord): Quiz {
  return { ...shapeBase(doc), questions: toPlayerQuestions(doc.questions ?? []) };
}

function shapeAdminQuiz(doc: QuizRecord): AdminQuiz {
  return { ...shapeBase(doc), questions: sortedQuestions(doc.questions ?? []) };
}

function summaryOf(doc: QuizRecord): QuizSummary {
  const base = shapeBase(doc);
  return {
    id: base.id,
    slug: base.slug,
    title: base.title,
    description: base.description,
    updatedAt: base.updatedAt,
    stats: base.stats,
    questionCount: (doc.questions ?? []).length,
  };
}

function isExpired(settings: QuizSettings): boolean {
  if (!settings.expiresAt) return false;
  return new Date(settings.expiresAt).getTime() < Date.now();
}

/** Public quizzes are addressable by short id or by custom slug. */
function referenceFilter(reference: string) {
  const trimmed = reference.trim();
  return { $or: [{ id: trimmed }, { slug: trimmed.toLowerCase() }] };
}

async function findQuiz(reference: string): Promise<QuizRecord | null> {
  await connectDB();
  if (!reference || reference.length > 80) return null;
  const doc = await QuizModel.findOne(referenceFilter(reference)).lean();
  return (doc as unknown as QuizRecord | null) ?? null;
}

async function uniqueQuizId(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = newQuizId();
    if (!(await QuizModel.exists({ id }))) return id;
  }
  throw new GraphQLError('Could not allocate a quiz id, please try again.', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}

async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  const clash = await QuizModel.exists(exceptId ? { slug, id: { $ne: exceptId } } : { slug });
  if (clash) badInput(`The slug "${slug}" is already used by another quiz.`);
}

/* --------------------------------------------------------------- resolvers */

type ResolverArgs<T> = { [K in keyof T]: T[K] };

export const resolvers = {
  DateTime: DateTimeScalar,

  Query: {
    quiz: async (_parent: unknown, args: ResolverArgs<{ id: string }>): Promise<Quiz | null> => {
      const doc = await findQuiz(args.id);
      return doc ? shapeQuiz(doc) : null;
    },

    quizzes: async (_parent: unknown, _args: unknown, context: GraphQLContext): Promise<QuizSummary[]> => {
      requireAdmin(context);
      await connectDB();
      const docs = (await QuizModel.find().sort({ updatedAt: -1 }).limit(200).lean()) as unknown as QuizRecord[];
      return docs.map(summaryOf);
    },

    adminQuiz: async (
      _parent: unknown,
      args: ResolverArgs<{ id: string }>,
      context: GraphQLContext,
    ): Promise<AdminQuiz | null> => {
      requireAdmin(context);
      const doc = await findQuiz(args.id);
      return doc ? shapeAdminQuiz(doc) : null;
    },
  },

  Mutation: {
    startQuiz: async (_parent: unknown, args: ResolverArgs<{ id: string }>) => {
      const doc = await findQuiz(args.id);
      if (!doc) notFound();
      if (isExpired(settingsOf(doc))) {
        throw new GraphQLError('This quiz has expired.', { extensions: { code: 'EXPIRED' } });
      }

      await QuizModel.updateOne({ id: doc.id }, { $inc: { 'stats.starts': 1 } });
      return { id: doc.id, started: true, totalQuestions: (doc.questions ?? []).length };
    },

    submitQuiz: async (_parent: unknown, args: ResolverArgs<{ input: SubmitQuizInput }>) => {
      const doc = await findQuiz(args.input?.id ?? '');
      if (!doc) notFound();

      const settings = settingsOf(doc);
      if (isExpired(settings)) {
        throw new GraphQLError('This quiz has expired.', { extensions: { code: 'EXPIRED' } });
      }

      const questions: AdminQuestion[] = sortedQuestions(doc.questions ?? []);
      if (questions.length === 0) {
        throw new GraphQLError('This quiz has no questions yet.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const answers = normaliseAnswers(args.input?.answers ?? []);
      const results = questions.map((question) => {
        const chosen = answers.get(question.id) ?? null;
        const wasCorrect = chosen !== null && chosen === question.correctOptionId;
        return {
          questionId: question.id,
          chosenOptionId: chosen,
          // The answer key is only revealed when the quiz allows it.
          correctOptionId: settings.showCorrectAnswers ? question.correctOptionId : null,
          correct: wasCorrect,
          explanation: settings.showCorrectAnswers ? (question.explanation ?? null) : null,
        };
      });

      const score = results.filter((result) => result.correct).length;
      const total = questions.length;

      await recordSubmission(doc.id, results);

      return {
        id: doc.id,
        score,
        total,
        percent: total > 0 ? Math.round((score / total) * 1000) / 10 : 0,
        results,
      };
    },

    adminCreateQuiz: async (
      _parent: unknown,
      args: ResolverArgs<{ input: CreateQuizInput }>,
      context: GraphQLContext,
    ): Promise<AdminQuiz> => {
      requireAdmin(context);
      const input = args.input;
      if (!input) badInput('Missing input.');

      await connectDB();
      const slug = normaliseSlug(input.slug);
      if (slug) await assertSlugFree(slug);

      const id = await uniqueQuizId();
      await QuizModel.create({
        id,
        slug,
        version: 1,
        title: normaliseTitle(input.title),
        description: normaliseDescription(input.description),
        settings: normaliseSettings(input.settings, DEFAULT_SETTINGS),
        questions: normaliseQuestions(input.questions),
        stats: { starts: 0, completions: 0, totalScore: 0, questionStats: {} },
      });

      const created = await findQuiz(id);
      if (!created) notFound();
      return shapeAdminQuiz(created);
    },

    adminUpdateQuiz: async (
      _parent: unknown,
      args: ResolverArgs<{ id: string; input: UpdateQuizInput }>,
      context: GraphQLContext,
    ): Promise<AdminQuiz> => {
      requireAdmin(context);
      const input = args.input;
      if (!input) badInput('Missing input.');

      const doc = await findQuiz(args.id);
      if (!doc) notFound();

      const update: Record<string, unknown> = {};

      if (input.title !== undefined && input.title !== null) {
        update.title = normaliseTitle(input.title);
      }
      if (input.description !== undefined) {
        update.description = normaliseDescription(input.description);
      }
      if (input.slug !== undefined) {
        const slug = normaliseSlug(input.slug);
        if (slug) await assertSlugFree(slug, doc.id);
        update.slug = slug;
      }
      if (input.settings != null) {
        update.settings = normaliseSettings(input.settings, settingsOf(doc));
      }
      if (input.questions != null) {
        update.questions = normaliseQuestions(input.questions);
      }

      if (Object.keys(update).length > 0) {
        await QuizModel.updateOne({ id: doc.id }, { $set: update });
      }

      const updated = await findQuiz(doc.id);
      if (!updated) notFound();
      return shapeAdminQuiz(updated);
    },

    adminDeleteQuiz: async (
      _parent: unknown,
      args: ResolverArgs<{ id: string }>,
      context: GraphQLContext,
    ): Promise<boolean> => {
      requireAdmin(context);
      await connectDB();
      const result = await QuizModel.deleteOne(referenceFilter(args.id));
      return (result.deletedCount ?? 0) > 0;
    },
  },
};

/**
 * Analytics are best-effort: a statistics failure must never cost a player
 * their score, so the caller logs instead of throwing.
 */
async function recordSubmission(
  quizId: string,
  results: Array<{ questionId: string; correct: boolean }>,
): Promise<void> {
  const increments: Record<string, number> = {
    'stats.completions': 1,
    'stats.totalScore': results.filter((result) => result.correct).length,
  };

  for (const result of results) {
    const outcome = result.correct ? 'correct' : 'misses';
    increments[`stats.questionStats.${result.questionId}.${outcome}`] = 1;
  }

  try {
    await QuizModel.updateOne({ id: quizId }, { $inc: increments });
  } catch (error) {
    console.error('[quiz] failed to record submission', error);
  }
}
