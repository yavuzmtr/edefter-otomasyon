const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.resolve(process.cwd(), '.license-keys');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

const publicPath = path.join(outDir, 'license-public.pem');
const privatePath = path.join(outDir, 'license-private.pem');
const appPublicPath = path.resolve(process.cwd(), 'electron', 'license-public.pem');

fs.writeFileSync(publicPath, publicKey, 'utf8');
fs.writeFileSync(privatePath, privateKey, 'utf8');
fs.writeFileSync(appPublicPath, publicKey, 'utf8');

console.log('Anahtarlar olusturuldu:');
console.log(`Public : ${publicPath}`);
console.log(`Private: ${privatePath}`);
console.log(`App key: ${appPublicPath}`);
console.log('Private key dosyasini kimseyle paylasmayin.');
