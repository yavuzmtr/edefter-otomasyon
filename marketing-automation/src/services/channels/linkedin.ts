import { ContentPiece } from '../contentGenerator.js';
export async function postLinkedIn(content: ContentPiece) {
  console.log('💼 LinkedIn:', content.title);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { platform: 'LinkedIn', url: `https://www.linkedin.com/feed/update/${content.assets[0]}` };
}
