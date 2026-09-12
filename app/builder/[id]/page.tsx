import type { Metadata } from 'next';
import QuizEditor from '@/components/QuizEditor';

export const metadata: Metadata = {
  title: 'Edit quiz · Quiz Maker',
  robots: { index: false },
};

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizEditor id={id} />;
}
