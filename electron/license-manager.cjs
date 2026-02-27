const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const FALLBACK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKX+vA93XKnXnX3x0n7pLF8A8f53SEf9
4L8WJ6gVV5JjS27z2T6E8g20h1V8aQ7h0+cf48KjX2Qsv6A1HlyVQmMCAwEAAQ==
-----END PUBLIC KEY-----`;

function getPublicKeyPem() {
  try {
    const keyPath = path.join(__dirname, 'license-public.pem');
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
  } catch {
    // Ignore and fallback
  }
  return FALLBACK_PUBLIC_KEY_PEM;
}

function getMachineGuidWindows() {
  try {
    const cmd = 'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid';
    const output = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
    const line = output.split(/\r?\n/).find((l) => l.includes('MachineGuid'));
    if (!line) return '';
    const parts = line.trim().split(/\s+/);
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

function getHardwareFingerprint() {
  const cpu = (os.cpus() && os.cpus()[0] && os.cpus()[0].model) || '';
  const hostname = os.hostname() || '';
  const platform = os.platform() || '';
  const arch = os.arch() || '';
  const machineGuid = process.platform === 'win32' ? getMachineGuidWindows() : '';
  const raw = [cpu, hostname, platform, arch, machineGuid].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.edefter.json');
}

function getLegacyLicensePath() {
  return path.join(app.getPath('appData'), 'edefter-automation', 'license.edefter.json');
}

function getLicenseCandidatePaths() {
  return [getLicensePath(), getLegacyLicensePath()];
}

function buildPayloadString(licenseData) {
  const payload = {
    key: licenseData.key,
    customer: licenseData.customer,
    hardwareId: licenseData.hardwareId,
    issuedAt: licenseData.issuedAt,
    expiresAt: licenseData.expiresAt || null
  };
  return JSON.stringify(payload);
}

function verifySignature(licenseData) {
  try {
    const payloadString = buildPayloadString(licenseData);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payloadString);
    verifier.end();
    return verifier.verify(getPublicKeyPem(), licenseData.signature, 'base64');
  } catch {
    return false;
  }
}

function loadInstalledLicense() {
  const candidates = getLicenseCandidatePaths();
  const existingPath = candidates.find((p) => fs.existsSync(p));
  const licensePath = existingPath || candidates[0];

  if (!existingPath) {
    return { found: false, licensePath, candidates };
  }

  try {
    const raw = fs.readFileSync(licensePath, 'utf8');
    const data = JSON.parse(raw);
    return { found: true, data, licensePath };
  } catch (error) {
    return {
      found: true,
      invalid: true,
      reason: `Lisans dosyasi okunamadi: ${error.message}`,
      licensePath,
      candidates
    };
  }
}

function validateInstalledLicense() {
  const hardwareId = getHardwareFingerprint();
  const loaded = loadInstalledLicense();

  if (!loaded.found) {
    return {
      valid: false,
      reason: 'Lisans dosyasi bulunamadi',
      hardwareId,
      licensePath: loaded.licensePath
    };
  }

  if (loaded.invalid) {
    return {
      valid: false,
      reason: loaded.reason,
      hardwareId,
      licensePath: loaded.licensePath
    };
  }

  const license = loaded.data || {};
  const required = ['key', 'customer', 'hardwareId', 'issuedAt', 'signature'];
  const missing = required.filter((k) => !license[k]);
  if (missing.length) {
    return {
      valid: false,
      reason: `Lisans alani eksik: ${missing.join(', ')}`,
      hardwareId,
      licensePath: loaded.licensePath
    };
  }

  if (!verifySignature(license)) {
    return {
      valid: false,
      reason: 'Lisans imzasi gecersiz',
      hardwareId,
      licensePath: loaded.licensePath
    };
  }

  if (license.hardwareId !== hardwareId) {
    return {
      valid: false,
      reason: 'Bu lisans farkli bir cihaza ait',
      hardwareId,
      licensePath: loaded.licensePath
    };
  }

  if (license.expiresAt) {
    const expires = new Date(license.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
      return {
        valid: false,
        reason: 'Lisans suresi dolmus',
        hardwareId,
        licensePath: loaded.licensePath
      };
    }
  }

  return {
    valid: true,
    hardwareId,
    licensePath: loaded.licensePath,
    license
  };
}

module.exports = {
  getHardwareFingerprint,
  getLicensePath,
  validateInstalledLicense
};
