const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

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

const cpu = (os.cpus() && os.cpus()[0] && os.cpus()[0].model) || '';
const hostname = os.hostname() || '';
const platform = os.platform() || '';
const arch = os.arch() || '';
const machineGuid = process.platform === 'win32' ? getMachineGuidWindows() : '';
const raw = [cpu, hostname, platform, arch, machineGuid].join('|');
const hardwareId = crypto.createHash('sha256').update(raw).digest('hex');

console.log(hardwareId);

