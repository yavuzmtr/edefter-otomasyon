import fs from 'fs';
import path from 'path';
import { ContentPiece } from './contentGenerator.js';

type MetricRecord = {
  contentId: string;
  channel: string;
  clicks: number;
  impressions: number;
  publishedAt: string;
};

const logDir = path.resolve(process.cwd(), 'marketing-automation', 'logs');
fs.mkdirSync(logDir, { recursive: true });

function logMetric(record: MetricRecord): void {
  const logPath = path.join(logDir, 'analytics.log');
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${JSON.stringify(record)}\n`);
}

export function evaluatePerformance(content: ContentPiece, channel: string): boolean {
  const clicks = Math.max(10, Math.floor(Math.random() * 150));
  const impressions = clicks * (Math.floor(Math.random() * 80) + 60);
  logMetric({ contentId: content.title, channel, clicks, impressions, publishedAt: content.publishedAt });
  const ctr = clicks / impressions;
  return ctr > 0.03;
}
