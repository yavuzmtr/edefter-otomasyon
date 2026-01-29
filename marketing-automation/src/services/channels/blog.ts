import { ContentPiece } from '../contentGenerator.js';
import { config } from '../../config/index.js';
export async function publishBlog(content: ContentPiece) {
  console.log('📝 Blog yayınlandı:', content.title);
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { platform: 'Blog', url: `${config.blogEndpoint}?slug=${encodeURIComponent(content.assets[0])}` };
}
