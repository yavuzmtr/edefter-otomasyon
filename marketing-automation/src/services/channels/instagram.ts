import { ContentPiece } from '../contentGenerator.js';
export async function postInstagram(content: ContentPiece) {
  console.log('📸 Instagram:', content.title);
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { platform: 'Instagram', url: `https://instagram.com/p/${content.assets[0]}` };
}
