import { createCampaign } from '../src/services/contentGenerator.js';
import { runCampaign } from '../src/bot.js';

(async () => {
  const campaign = createCampaign(new Date().getDate());
  await runCampaign('test', campaign);
  console.log('✅ Otomasyon testi tamamlandı');
})();
