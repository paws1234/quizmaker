#!/usr/bin/env node
/**
 * Creates one demo quiz (idempotent).
 *
 *   ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' .env | cut -d= -f2) node scripts/seed.mjs
 *
 * Handy for a first look at the player, and for checking the shared link and
 * embed code without building a quiz by hand first.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

if (!ADMIN_TOKEN) {
  console.error('Set ADMIN_TOKEN first, e.g. ADMIN_TOKEN=$(grep ^ADMIN_TOKEN= .env | cut -d= -f2) node scripts/seed.mjs');
  process.exit(1);
}

async function gql(query, variables) {
  const response = await fetch(`${BASE}/api/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join('\n'));
  return payload.data;
}

const title = 'Marketing Basics Quiz';
const slug = 'marketing-basics';

const demo = {
  title,
  slug,
  description: 'Five questions on the fundamentals of marketing.',
  settings: {
    requireOptIn: true,
    optInText: 'I agree to take part in this quiz and understand my answers are used to score it.',
    showCorrectAnswers: true,
    allowRetake: true,
    primaryColor: '#4f46e5',
  },
  questions: [
    {
      text: 'What does SEO stand for?',
      options: [
        { id: 'a', text: 'Search Engine Optimization' },
        { id: 'b', text: 'Social Engagement Optimization' },
        { id: 'c', text: 'Site Experience Optimization' },
        { id: 'd', text: 'Search Entry Order' },
      ],
      correctOptionId: 'a',
      explanation: 'SEO is Search Engine Optimization: making a site easy for search engines to find and rank.',
    },
    {
      text: 'Which metric measures the cost of one click on an ad?',
      options: [
        { id: 'a', text: 'CPA' },
        { id: 'b', text: 'CPC' },
        { id: 'c', text: 'LTV' },
        { id: 'd', text: 'ROAS' },
      ],
      correctOptionId: 'b',
      explanation: 'CPC, or cost per click, is the amount paid for each click on a paid ad.',
    },
    {
      text: 'What is a call to action (CTA)?',
      options: [
        { id: 'a', text: 'A customer complaint' },
        { id: 'b', text: 'A sales target' },
        { id: 'c', text: 'A prompt that asks the audience to do something' },
        { id: 'd', text: 'A type of funnel' },
      ],
      correctOptionId: 'c',
      explanation: 'A CTA invites the audience to act: sign up, buy, book a call or download the guide.',
    },
    {
      text: 'Which channel is best described as "owned media"?',
      options: [
        { id: 'a', text: 'A guest article on someone else\'s blog' },
        { id: 'b', text: 'A paid search advert' },
        { id: 'c', text: 'Your own email list' },
        { id: 'd', text: 'A press mention' },
      ],
      correctOptionId: 'c',
      explanation: 'Owned media is anything you control: your site, blog and email list, rather than rented or earned space.',
    },
    {
      text: 'A/B testing compares two versions of a page. What decides the winner?',
      options: [
        { id: 'a', text: 'Whichever one the designer prefers' },
        { id: 'b', text: 'Whichever is longer' },
        { id: 'c', text: 'Whichever performs better on the measured goal' },
        { id: 'd', text: 'Whichever loads first' },
      ],
      correctOptionId: 'c',
      explanation: 'Results decide: conversions, sign-ups or whatever goal the test is measured against.',
    },
  ],
};

async function main() {
  const existing = await gql(`query { quizzes { id slug title } }`, {});
  const already = existing.quizzes.find((quiz) => quiz.slug === slug || quiz.title === title);

  if (already) {
    console.log(`Demo quiz already exists: ${BASE}/q/${already.slug ?? already.id}`);
    return;
  }

  const created = await gql(
    `mutation Create($input: CreateQuizInput!) { adminCreateQuiz(input: $input) { id slug } }`,
    { input: demo },
  );

  const quiz = created.adminCreateQuiz;
  console.log(`Created "${title}" with ${demo.questions.length} questions.`);
  console.log(`Player:  ${BASE}/q/${quiz.slug ?? quiz.id}`);
  console.log(`Builder: ${BASE}/builder/${quiz.id}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
