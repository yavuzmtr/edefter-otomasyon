import { ContentPiece } from './services/contentGenerator.js';
import { postInstagram } from './services/channels/instagram.js';
import { postLinkedIn } from './services/channels/linkedin.js';
import { publishBlog } from './services/channels/blog.js';
import { sendNewsletter } from './services/channels/newsletter.js';
import { notifyChatbot } from './services/channels/chatbot.js';
import { evaluatePerformance } from './services/analytics.js';
import { captureLead } from './services/leadService.js';
import fs from 'fs';
import path from 'path';

const logDir = path.resolve(process.cwd(), 'marketing-automation', 'logs');
fs.mkdirSync(logDir, { recursive: true });

async function publish(content: ContentPiece) {
  const channels = [postInstagram, postLinkedIn, publishBlog, sendNewsletter, notifyChatbot];
  for (const channel of channels) {
    const result = await channel(content);
    const healthy = evaluatePerformance(content, result.platform);
    fs.appendFileSync(path.join(logDir, 'publish.log'), `${new Date().toISOString()} ${result.platform} ${healthy}\n`);
    if (!healthy && content.priority !== 'refresh') {
      const refreshed = { ...content, title: `${content.title} (revize)` };
      await notifyChatbot(refreshed);
    }
  }
}

export async function runCampaign(label: string, pieces: ContentPiece[]) {
  console.log(`🎯 [${label}] kampanyası: ${pieces.length} içerik`);
  for (const piece of pieces) {
    await publish(piece);
    captureLead({
      name: 'Otomatik Bot',
      email: 'demo@edefter.com',
      channel: 'campaign',
      notes: `published:${piece.channelNotes}`,
      createdAt: new Date().toISOString()
    });
  }
}
