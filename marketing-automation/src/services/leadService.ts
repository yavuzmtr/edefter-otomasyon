import fs from 'fs';
import path from 'path';

type Lead = {
  name: string;
  email: string;
  channel: string;
  notes: string;
  createdAt: string;
};

const leadsDir = path.resolve(process.cwd(), 'marketing-automation', 'data');
fs.mkdirSync(leadsDir, { recursive: true });

export function captureLead(lead: Lead) {
  const file = path.join(leadsDir, `${Date.now()}-${lead.channel}.json`);
  fs.writeFileSync(file, JSON.stringify(lead, null, 2));
  console.log('📥 Lead kaydedildi:', lead.email);
}
