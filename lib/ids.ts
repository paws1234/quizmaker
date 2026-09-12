import { customAlphabet } from 'nanoid';

/**
 * Public identifiers.
 *
 * Quiz ids are lowercase alphanumeric so links stay tidy and case-insensitive
 * (`/q/x7k9m2`). Question and option ids are generated server-side and are
 * restricted to `[A-Za-z0-9_-]`, which also makes them safe to use as MongoDB
 * field paths in the analytics counters.
 */

const publicId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 7);

export const newQuizId = (): string => publicId();

export const newQuestionId = (): string => `q${customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9)()}`;

export const newOptionId = (): string => `o${customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9)()}`;

/** Ids accepted from clients must match the generated format. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}
