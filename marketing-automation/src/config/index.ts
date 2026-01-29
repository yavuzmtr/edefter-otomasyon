import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  slackWebhook: process.env.SLACK_WEBHOOK || '',
  blogEndpoint: process.env.BLOG_ENDPOINT || 'https://example.com/wp-json/wp/v2/posts',
  instagramEndpoint: process.env.INSTAGRAM_ENDPOINT || 'https://graph.facebook.com/v13.0/17841400000000000/media',
  linkedInEndpoint: process.env.LINKEDIN_ENDPOINT || 'https://api.linkedin.com/v2/shares',
  newsletterEndpoint: process.env.NEWSLETTER_ENDPOINT || 'https://api.mailprovider.local/v1/campaigns',
  chatbotEndpoint: process.env.CHATBOT_ENDPOINT || 'https://api.tawk.to/push',
  defaultTimezone: 'Europe/Istanbul'
};
