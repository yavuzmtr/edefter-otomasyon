import { ContentPiece } from '../contentGenerator.js';
import { config } from '../../config/index.js';
export async function notifyChatbot(content: ContentPiece) {
  console.log('💬 Chatbot bildirimi:', content.title);
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { platform: 'Chatbot', url: `${config.chatbotEndpoint}?msg=${encodeURIComponent(content.title)}` };
}
