import { GraphQLError } from 'graphql';
import { newOptionId, newQuestionId, isSafeId } from '../ids';
import { DEFAULT_SETTINGS } from '../models/quiz';
import type {
  AdminQuestion,
  QuestionInput,
  QuizSettings,
  QuizSettingsInput,
  SubmitQuizInput,
} from '../types';

/**
 * Input validation and normalisation.
 *
 * Everything the API accepts from a client passes through here, so the rest of
 * the server can assume sane data. Wrong input is answered with BAD_USER_INPUT
 * rather than a 500.
 */

export const LIMITS = {
  title: 200,
  description: 2000,
  questionText: 500,
  optionText: 300,
  explanation: 1000,
  questionsPerQuiz: 200,
  optionsPerQuestion: 10,
  answersPerSubmission: 500,
  slug: 64,
} as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function fail(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

function text(value: string | null | undefined, field: string, max: number, { required = false } = {}) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    if (required) fail(`${field} is required.`);
    return null;
  }
  if (trimmed.length > max) fail(`${field} must be ${max} characters or fewer.`);
  return trimmed;
}

export function normaliseTitle(value: string): string {
  return text(value, 'Title', LIMITS.title, { required: true })!;
}

export function normaliseDescription(value: string | null | undefined): string | null {
  return text(value, 'Description', LIMITS.description);
}

export function normaliseSlug(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw.length > LIMITS.slug) fail(`Slug must be ${LIMITS.slug} characters or fewer.`);
  if (!SLUG_PATTERN.test(raw)) {
    fail('Slug may only contain lowercase letters, numbers and single hyphens (e.g. marketing-basics).');
  }
  return raw;
}

export function normaliseSettings(input: QuizSettingsInput | null | undefined, base: QuizSettings): QuizSettings {
  const merged: QuizSettings = { ...base };

  if (!input) return merged;

  if (typeof input.requireOptIn === 'boolean') merged.requireOptIn = input.requireOptIn;
  if (typeof input.showCorrectAnswers === 'boolean') merged.showCorrectAnswers = input.showCorrectAnswers;
  if (typeof input.allowRetake === 'boolean') merged.allowRetake = input.allowRetake;
  if (input.optInText !== undefined) merged.optInText = text(input.optInText, 'Consent text', LIMITS.description);

  if (input.primaryColor !== undefined) {
    const colour = (input.primaryColor ?? '').trim();
    if (!colour) {
      merged.primaryColor = DEFAULT_SETTINGS.primaryColor;
    } else if (!HEX_COLOR.test(colour)) {
      fail('Primary colour must be a hex value such as #4f46e5.');
    } else {
      merged.primaryColor = colour;
    }
  }

  if (input.logoUrl !== undefined) {
    merged.logoUrl = normaliseUrl(input.logoUrl, 'Logo URL');
  }

  if (input.expiresAt !== undefined) {
    merged.expiresAt = normaliseDate(input.expiresAt);
  }

  if (merged.requireOptIn && !merged.optInText) {
    fail('Consent text is required when the opt-in step is enabled.');
  }

  return merged;
}

function normaliseUrl(value: string | null | undefined, field: string): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`${field} must be a full URL, including https://.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(`${field} must be an http(s) URL.`);
  }
  return parsed.toString();
}

function normaliseDate(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) fail('Expiry must be a valid date.');
  return date.toISOString();
}

/**
 * Turns submitted questions into storable ones: ids are generated when missing
 * or malformed, order is taken from the array position, and the answer key is
 * checked against the options that actually exist.
 */
export function normaliseQuestions(input: QuestionInput[] | null | undefined): AdminQuestion[] {
  const list = input ?? [];
  if (list.length > LIMITS.questionsPerQuiz) {
    fail(`A quiz can hold at most ${LIMITS.questionsPerQuiz} questions.`);
  }

  const usedQuestionIds = new Set<string>();

  return list.map((question, index) => {
    const label = `Question ${index + 1}`;
    const questionText = text(question.text, `${label} text`, LIMITS.questionText, { required: true })!;

    const optionInputs = question.options ?? [];
    if (optionInputs.length < 2) fail(`${label} needs at least two options.`);
    if (optionInputs.length > LIMITS.optionsPerQuestion) {
      fail(`${label} can have at most ${LIMITS.optionsPerQuestion} options.`);
    }

    // Option ids only have to be unique inside their own question, so ids like
    // a/b/c/d are fine (and are what the API examples use).
    const usedOptionIds = new Set<string>();

    const options = optionInputs.map((option, optionIndex) => {
      const optionText = text(option.text, `${label}, option ${optionIndex + 1}`, LIMITS.optionText, {
        required: true,
      })!;
      let id = isSafeId(option.id) ? option.id : newOptionId();
      while (usedOptionIds.has(id)) id = newOptionId();
      usedOptionIds.add(id);
      return { id, text: optionText };
    });

    const requestedCorrect = question.correctOptionId ?? null;
    if (!requestedCorrect || !options.some((option) => option.id === requestedCorrect)) {
      fail(`${label} needs one of its options marked as the correct answer.`);
    }

    let id = isSafeId(question.id) ? question.id : newQuestionId();
    while (usedQuestionIds.has(id)) id = newQuestionId();
    usedQuestionIds.add(id);

    return {
      id,
      text: questionText,
      options,
      correctOptionId: requestedCorrect,
      explanation: text(question.explanation, `${label} explanation`, LIMITS.explanation),
      order: index,
    };
  });
}

/** Answers arrive from the player and are only trusted as `questionId -> optionId`. */
export function normaliseAnswers(input: SubmitQuizInput['answers']): Map<string, string | null> {
  const list = input ?? [];
  if (list.length > LIMITS.answersPerSubmission) fail('Too many answers in one submission.');

  const answers = new Map<string, string | null>();
  for (const answer of list) {
    if (!isSafeId(answer.questionId)) continue;
    answers.set(answer.questionId, isSafeId(answer.optionId) ? answer.optionId : null);
  }
  return answers;
}
