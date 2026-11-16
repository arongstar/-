// 발표 슬라이드 공통 도우미
import { getCollection, getEntry } from 'astro:content';
import QRCode from 'qrcode';
import { url } from './url';

export async function deckPaths() {
  const decks = await getCollection('decks');
  const out = [];
  for (const deck of decks) {
    const lesson = await getEntry(deck.data.lesson);
    if (!lesson || lesson.data.draft) continue;
    out.push({ params: { id: lesson.id }, props: { deck: deck.data, lesson } });
  }
  return out;
}

// 교안 id → 슬라이드가 있는지
export async function lessonsWithDeck(): Promise<Set<string>> {
  const decks = await getCollection('decks');
  return new Set(decks.map((d) => d.data.lesson.id));
}

export async function lessonQr(site: URL | undefined, lessonId: string) {
  const path = url(`/lessons/${lessonId}/`);
  const onlineUrl = site ? new URL(path, site).href : path;
  const qrSvg = await QRCode.toString(onlineUrl, { type: 'svg', margin: 0, color: { dark: '#1c2540', light: '#ffffff' } });
  return { onlineUrl, qrSvg };
}
