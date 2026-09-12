import type { Metadata } from 'next';
import BuilderHome from '@/components/BuilderHome';

export const metadata: Metadata = {
  title: 'Builder · Quiz Maker',
  robots: { index: false },
};

export default function BuilderPage() {
  return <BuilderHome />;
}
