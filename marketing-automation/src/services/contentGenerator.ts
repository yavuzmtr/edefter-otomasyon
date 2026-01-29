import dayjs from 'dayjs';
import { config } from '../config/index.js';

type ContentPriority = 'high' | 'normal' | 'refresh';

type ContentPiece = {
  title: string;
  description: string;
  cta: string;
  assets: string[];
  hashtags: string[];
  publishedAt: string;
  topic: string;
  channelNotes: string;
  priority: ContentPriority;
};

const ctaPool = [
  '15 gün ücretsiz demo',
  'Tam sürümü keşfedin',
  'Yeni özellikleri inceleyin',
  'Sistemi hemen test edin'
];

const topics = [
  'E-Defter klasör otomasyonu',
  'Yedekleme + e-posta entegrasyonu',
  'GIB uyumu',
  'Otomatik raporlama',
  'Denetim ready klasörler'
];

const hashtags = ['#efatura', '#otomasyon', '#edefter', '#kobi', '#muhasebe'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createContentPiece(priority: ContentPriority = 'normal'): ContentPiece {
  const topic = pickRandom(topics);
  const title = `${topic} ile zamandan tasarruf edin`;
  const description = `E-Defter Otomasyon Sistemi ${topic} alanında ${priority === 'refresh' ? 'güncellik' : 'güç'} vaat ediyor. Yeni içerik ${dayjs().format('DD MMMM YYYY')} tarihinde hazır.`;
  return {
    title,
    description,
    cta: pickRandom(ctaPool),
    assets: [`slug-${topic.replace(/\s+/g, '-').toLowerCase()}-${priority}`],
    hashtags,
    publishedAt: dayjs().format(),
    topic,
    channelNotes: `priority:${priority}`,
    priority
  };
}

export function createCampaign(day: number): ContentPiece[] {
  const basePriority: ContentPriority = day % 3 === 0 ? 'refresh' : 'normal';
  return Array.from({ length: 3 }, (_, index) => createContentPiece(basePriority));
}

export type { ContentPiece };
