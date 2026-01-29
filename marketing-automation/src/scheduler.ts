import Cron from 'cron';
import { createCampaign, ContentPiece } from './services/contentGenerator.js';
import { runCampaign } from './bot.js';

const morningJob = new Cron.CronJob('0 30 8 * * *', () => {
  console.log('☀️ Sabah kampanyası başlıyor');
  const campaign = createCampaign(new Date().getDate());
  runCampaign('morning', campaign);
});

const eveningJob = new Cron.CronJob('0 0 18 * * *', () => {
  console.log('🌙 Akşam retargeting kampanyası');
  const campaign = createCampaign(new Date().getDate() + 1);
  runCampaign('evening', campaign);
});

export function startScheduler() {
  morningJob.start();
  eveningJob.start();
  console.log('⏱️ Scheduler çalışıyor (08:30 + 18:00)');
}
