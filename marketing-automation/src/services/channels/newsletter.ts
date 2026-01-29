import { ContentPiece } from '../contentGenerator.js';
import { config } from '../../config/index.js';
export async function sendNewsletter(content: ContentPiece) {
  console.log('📧 Newsletter gönderildi:', content.title);
  await new Promise((resolve) => setTimeout(resolve, 450));
  return { platform: 'Newsletter', url: `${config.newsletterEndpoint}?campaign=${content.assets[0]}` };
}
