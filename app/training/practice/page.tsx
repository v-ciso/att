import type { Metadata } from 'next';
import { PracticeRoom } from '@/components/training/practice-room';

export const metadata: Metadata = { title: { absolute: 'Rep Practice | Sorami Training' } };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ drill?: string; mode?: string }> }) {
  const params = await searchParams;
  const drill = params.drill === 'pitch' ? 'pitch' : 'promo';
  const study = params.mode === 'study';
  return <PracticeRoom key={`${drill}-${study}`} drill={drill} study={study} />;
}
