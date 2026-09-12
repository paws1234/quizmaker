import type { Metadata } from 'next';
import { cache } from 'react';
import QuizPlayer from '@/components/QuizPlayer';
import { executeServerQuery } from '@/lib/graphql/server';
import { PUBLIC_QUIZ } from '@/lib/queries';
import type { Quiz } from '@/lib/types';

/**
 * Public quiz page. The id segment is either the short id or a custom slug -
 * both resolve through the same public GraphQL query.
 *
 * The quiz is read on the server so a shared link paints the real thing instead
 * of a loading state. `cache` makes the extra read for `generateMetadata` free.
 */

type Loaded = { quiz: Quiz | null } | undefined;

// A quiz can be edited at any time, so the page is always rendered per request.
export const dynamic = 'force-dynamic';

const getQuiz = cache(async (id: string): Promise<Loaded> => {
  try {
    const data = await executeServerQuery<{ quiz: Quiz | null }>(PUBLIC_QUIZ, { id }, { isAdmin: false });
    return { quiz: data?.quiz ?? null };
  } catch (error) {
    // Undefined means "could not read right now": the player then fetches on the
    // client, so the visitor sees a real error rather than a wrong "not found".
    console.error('[quiz] server render could not load the quiz', error);
    return undefined;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const quiz = (await getQuiz(id))?.quiz;
  if (!quiz) return { title: 'Quiz' };

  const description = quiz.description ?? undefined;
  return {
    title: quiz.title,
    description,
    openGraph: { title: quiz.title, description, type: 'website' },
  };
}

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const embed = query.embed === '1' || query.embed === 'true';

  return <QuizPlayer id={id} embed={embed} initialQuiz={(await getQuiz(id))?.quiz} />;
}
