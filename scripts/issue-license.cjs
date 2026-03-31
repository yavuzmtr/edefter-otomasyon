const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let nodemailer;
try {
  nodemailer = require('nodemailer');
  if (nodemailer.default) nodemailer = nodemailer.default;
} catch (err) {
  nodemailer = null;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = val;
    if (val !== true) i += 1;
  }
  return args;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSectionValue(body, labelVariants) {
  for (const label of labelVariants) {
    const re = new RegExp(`^###\\s*${escapeRegExp(label)}\\s*$([\\s\\S]*?)(?=^###\\s|\\Z)`, 'mi');
    const match = body.match(re);
    if (match) {
      const lines = match[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l !== '---');
      if (lines.length) return lines[0];
    }
  }
  return '';
}

function getInlineValue(body, labelVariants) {
  for (const label of labelVariants) {
    const re = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*(.+)$`, 'mi');
    const match = body.match(re);
    if (match) return String(match[1]).trim();
  }
  return '';
}

function getValue(body, variants) {
  return getSectionValue(body, variants) || getInlineValue(body, variants) || '';
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getPrivateKeyPem(args) {
  if (args.privateKey && fs.existsSync(args.privateKey)) {
    return fs.readFileSync(args.privateKey, 'utf8');
  }
  if (process.env.LICENSE_PRIVATE_KEY_PATH && fs.existsSync(process.env.LICENSE_PRIVATE_KEY_PATH)) {
    return fs.readFileSync(process.env.LICENSE_PRIVATE_KEY_PATH, 'utf8');
  }
  if (process.env.LICENSE_PRIVATE_KEY_PEM) {
    return process.env.LICENSE_PRIVATE_KEY_PEM;
  }
  throw new Error('Private key bulunamadi. LICENSE_PRIVATE_KEY_PEM veya LICENSE_PRIVATE_KEY_PATH gerekli.');
}

function signPayload(payload, privateKeyPem) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(payload));
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

async function sendMail({ to, subject, text, attachmentPath, attachmentName }) {
  const SMTP_HOST = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
  const SMTP_PORT = Number(process.env.BREVO_SMTP_PORT || 587);
  const SMTP_USER = process.env.BREVO_SMTP_USER || '';
  const SMTP_KEY = process.env.BREVO_SMTP_KEY || '';
  const SMTP_FROM = process.env.BREVO_FROM || SMTP_USER;

  if (!nodemailer) throw new Error('nodemailer bulunamadi. npm ci ile kurun.');
  if (!SMTP_USER || !SMTP_KEY || !SMTP_FROM) {
    throw new Error('SMTP ayarlari eksik. BREVO_SMTP_USER / BREVO_SMTP_KEY / BREVO_FROM gerekli.');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_KEY }
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    attachments: [
      {
        filename: attachmentName,
        path: attachmentPath
      }
    ]
  });
}

function writeSummary(text) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${text}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const eventPath = args.event || process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error('GitHub event dosyasi bulunamadi. --event verin.');
  }
  const outDir = args.outDir ? path.resolve(args.outDir) : path.resolve(process.cwd(), 'artifacts');
  const resultPath = args.result ? path.resolve(args.result) : '';

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const issue = event.issue || {};
  const body = String(issue.body || '');

  const customer = getValue(body, ['Musteri / Firma', 'Musteri/Firma', 'Customer', 'Firma']);
  const email = getValue(body, ['Musteri E-posta', 'Musteri Email', 'Customer Email', 'Email']);
  const hardwareId = getValue(body, ['Cihaz Kimligi', 'Hardware ID', 'HardwareId']);
  const expiresAtRaw = getValue(body, ['Bitis Tarihi', 'Expires At', 'Expiry Date']);
  const keyRaw = getValue(body, ['Lisans Kodu', 'License Key', 'Key']);

  if (!customer) throw new Error('Musteri/Firma alani bulunamadi.');
  if (!email) throw new Error('Musteri e-posta alani bulunamadi.');
  if (!hardwareId) throw new Error('Cihaz kimligi alani bulunamadi.');

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAtRaw && Number.isNaN(expiresAt.getTime())) {
    throw new Error('Bitis tarihi gecersiz. YYYY-MM-DD formatinda olmali.');
  }

  const key = keyRaw && keyRaw.trim() ? keyRaw.trim() : `LCN-${Date.now()}`;
  const privateKeyPem = getPrivateKeyPem(args);
  const payload = {
    key,
    customer: customer.trim(),
    hardwareId: hardwareId.trim(),
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null
  };
  const signature = signPayload(payload, privateKeyPem);
  const licenseFile = { ...payload, signature };

  ensureDir(outDir);
  const fileName = `license-${key}.json`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(licenseFile, null, 2), 'utf8');

  const subject = `E-Defter Lisans Dosyaniz (${key})`;
  const text = [
    `Merhaba ${payload.customer},`,
    '',
    'Lisans dosyaniz ektedir.',
    '',
    'Lisans dosyasini programin belirledigi dizine kopyalayin.',
    'Genelde dizin: %APPDATA%\\edefter-automation',
    '',
    'Sorun yasarsaniz bu e-postayi yanitlayabilirsiniz.',
    '',
    'E-Defter Otomasyon'
  ].join('\n');

  await sendMail({
    to: email.trim(),
    subject,
    text,
    attachmentPath: filePath,
    attachmentName: fileName
  });

  const result = {
    key,
    customer: payload.customer,
    email: email.trim(),
    filePath,
    issueNumber: issue.number || null,
    issueTitle: issue.title || ''
  };

  if (resultPath) {
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
  }

  writeSummary(`✅ Lisans uretildi ve mail gonderildi: ${result.email} (${result.key})`);
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  writeSummary(`❌ Lisans uretimi basarisiz: ${err.message}`);
  console.error(err);
  process.exit(1);
});
