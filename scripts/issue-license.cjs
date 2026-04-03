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

function normalizeLabelText(value) {
  return String(value || '')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212\u00ad]/g, '-')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeLineLabel(line) {
  return normalizeLabelText(String(line || '').replace(/^[\s>*-]+/, '').replace(/:+$/, ''));
}

function getSectionValue(body, labelVariants) {
  for (const label of labelVariants) {
    const re = new RegExp(
      `^###\\s*${escapeRegExp(label)}\\s*$([\\s\\S]*?)(?=^###\\s|\\Z)`,
      'mi'
    );
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
  const lines = String(body || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line) continue;
    for (const label of labelVariants) {
      const normalizedLabel = normalizeLabelText(label);
      const normalizedLine = normalizeLineLabel(line);
      if (normalizedLine.startsWith(`${normalizedLabel}:`)) {
        return String(line.split(':').slice(1).join(':')).trim();
      }
    }
  }
  return '';
}

function getBlockValue(body, labelVariants) {
  const lines = String(body || '').split(/\r?\n/).map((line) => line.trim());
  for (const label of labelVariants) {
    const normalizedLabel = normalizeLabelText(label);
    for (let i = 0; i < lines.length; i += 1) {
      if (normalizeLineLabel(lines[i]) === normalizedLabel) {
        for (let j = i + 1; j < lines.length; j += 1) {
          const value = lines[j];
          if (!value || value === '---') continue;
          return value;
        }
      }
    }
  }
  return '';
}

function normalizeEmail(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const mailtoMatch = text.match(/mailto:([^\s)\]]+)/i);
  if (mailtoMatch) return mailtoMatch[1];
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return emailMatch ? emailMatch[0] : text;
}

function normalizeText(value) {
  return String(value || '').replace(/`/g, '').trim();
}

function getValue(body, variants) {
  return (
    getSectionValue(body, variants) ||
    getInlineValue(body, variants) ||
    getBlockValue(body, variants) ||
    ''
  );
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

  const customer = normalizeText(
    getValue(body, ['Musteri / Firma', 'Musteri/Firma', 'Customer', 'Firma'])
  );
  const email = normalizeEmail(
    getValue(body, ['Musteri E-posta', 'Musteri Email', 'Customer Email', 'Email', 'E-posta'])
  );
  const hardwareId = normalizeText(
    getValue(body, ['Cihaz Kimligi', 'Hardware ID', 'HardwareId'])
  );
  const expiresAtRaw = normalizeText(
    getValue(body, ['Bitis Tarihi', 'Expires At', 'Expiry Date'])
  );
  const keyRaw = normalizeText(getValue(body, ['Lisans Kodu', 'License Key', 'Key']));

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
