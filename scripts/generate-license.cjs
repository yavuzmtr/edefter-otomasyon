const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function usageAndExit() {
  console.log('Usage:');
  console.log('node scripts/generate-license.cjs --key LCN-XXXX --customer "Firma" --hardware <id> [--expires 2027-12-31] [--out ./license.json] [--privateKey ./keys/license-private.pem]');
  process.exit(1);
}

const args = parseArgs(process.argv);
if (!args.key || !args.customer || !args.hardware) {
  usageAndExit();
}

const privateKeyPath = args.privateKey || process.env.LICENSE_PRIVATE_KEY_PATH;
if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
  console.error('Private key bulunamadi. --privateKey verin veya LICENSE_PRIVATE_KEY_PATH set edin.');
  process.exit(1);
}

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const payload = {
  key: String(args.key),
  customer: String(args.customer),
  hardwareId: String(args.hardware),
  issuedAt: new Date().toISOString(),
  expiresAt: args.expires ? new Date(String(args.expires)).toISOString() : null
};

const payloadString = JSON.stringify(payload);
const signer = crypto.createSign('RSA-SHA256');
signer.update(payloadString);
signer.end();
const signature = signer.sign(privateKeyPem, 'base64');

const licenseFile = {
  ...payload,
  signature
};

const outPath = args.out
  ? path.resolve(String(args.out))
  : path.resolve(process.cwd(), `license-${payload.key}.json`);

fs.writeFileSync(outPath, JSON.stringify(licenseFile, null, 2), 'utf8');
console.log(`License dosyasi olusturuldu: ${outPath}`);

