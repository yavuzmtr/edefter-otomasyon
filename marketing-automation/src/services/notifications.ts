import axios from 'axios';
import { config } from '../config/index.js';

export async function notifySlack(message: string) {
  if (!config.slackWebhook) {
    console.warn('⚠️ Slack webhook tanımlı değil; bildirim atılmadı.');
    return;
  }
  try {
    await axios.post(config.slackWebhook, {
      text: `📣 Pazarlama Botu: ${message}`
    });
  } catch (error) {
    console.error('Slack bildirimi başarısız:', error?.message || error);
  }
}
