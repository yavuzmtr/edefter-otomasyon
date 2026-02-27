const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = 8787;
const HOST = '127.0.0.1';

const ROOT_DIR = path.resolve(__dirname, '..');
const KEY_DIR = path.join(ROOT_DIR, '.license-keys');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'license-private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'license-public.pem');
const APP_PUBLIC_KEY_PATH = path.join(ROOT_DIR, 'electron', 'license-public.pem');

const DATA_DIR = path.join(ROOT_DIR, 'data', 'license-studio');
const LICENSE_DIR = path.join(DATA_DIR, 'licenses');
const RECORDS_PATH = path.join(DATA_DIR, 'records.json');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureDataFiles() {
  ensureDir(DATA_DIR);
  ensureDir(LICENSE_DIR);
  if (!fs.existsSync(RECORDS_PATH)) {
    fs.writeFileSync(RECORDS_PATH, JSON.stringify({ records: [] }, null, 2), 'utf8');
  }
}

function loadRecords() {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(RECORDS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  ensureDataFiles();
  fs.writeFileSync(RECORDS_PATH, JSON.stringify({ records }, null, 2), 'utf8');
}

function createLicenseKeys() {
  ensureDir(KEY_DIR);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');
  fs.writeFileSync(APP_PUBLIC_KEY_PATH, publicKey, 'utf8');

  return {
    privateKeyPath: PRIVATE_KEY_PATH,
    publicKeyPath: PUBLIC_KEY_PATH,
    appPublicKeyPath: APP_PUBLIC_KEY_PATH
  };
}

function hasPrivateKey() {
  return fs.existsSync(PRIVATE_KEY_PATH);
}

function normalizeLicenseKey(input) {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .trim();
  return cleaned || `LCN-${Date.now()}`;
}

function signLicensePayload(payload, privateKeyPem) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(payload));
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

function createLicenseFile({ key, customer, hardwareId, expiresAt }) {
  if (!hasPrivateKey()) {
    throw new Error('Private key bulunamadi. Once "Anahtar Olustur" butonuna basin.');
  }
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const payload = {
    key: normalizeLicenseKey(key),
    customer: String(customer || '').trim(),
    hardwareId: String(hardwareId || '').trim(),
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
  };

  if (!payload.customer) throw new Error('Musteri/Firma alani zorunlu.');
  if (!payload.hardwareId) throw new Error('Cihaz Kimligi alani zorunlu.');

  const signature = signLicensePayload(payload, privateKeyPem);
  const license = { ...payload, signature };

  ensureDataFiles();
  const fileName = `license-${payload.key}.json`;
  const filePath = path.join(LICENSE_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(license, null, 2), 'utf8');

  const records = loadRecords();
  const record = {
    id: crypto.randomUUID(),
    key: payload.key,
    customer: payload.customer,
    hardwareId: payload.hardwareId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    status: 'active',
    fileName,
    filePath
  };
  records.unshift(record);
  saveRecords(records);

  return record;
}

function revokeLicense(key) {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.key === key);
  if (idx === -1) throw new Error('Lisans kaydi bulunamadi.');
  records[idx].status = 'revoked';
  records[idx].revokedAt = new Date().toISOString();
  saveRecords(records);
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Istek cok buyuk.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Gecersiz JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function getUiHtml() {
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Lisans Yoneticisi</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 20px; background:#f5f7fb; color:#1d2b3a; }
    h1 { margin:0 0 16px; }
    .row { display:flex; gap:12px; flex-wrap:wrap; }
    .card { background:white; border:1px solid #dbe3ef; border-radius:10px; padding:14px; margin-bottom:12px; }
    .card h2 { margin:0 0 10px; font-size:18px; }
    label { display:block; font-size:13px; margin-bottom:4px; color:#4a5a70; }
    input { width:100%; max-width:460px; padding:8px; border:1px solid #cbd7e7; border-radius:8px; }
    button { padding:8px 12px; border:none; border-radius:8px; cursor:pointer; }
    .primary { background:#2d72f3; color:#fff; }
    .warn { background:#d93a3a; color:#fff; }
    .muted { background:#e7edf7; color:#1d2b3a; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border-bottom:1px solid #e9eef6; padding:8px; text-align:left; }
    .ok { color:#0a8f44; font-weight:600; }
    .bad { color:#c62929; font-weight:600; }
    .mono { font-family: Consolas, monospace; }
    .small { font-size:12px; color:#5a6b82; }
  </style>
</head>
<body>
  <h1>E-Defter Lisans Yoneticisi</h1>

  <div class="card">
    <h2>Hazirlik</h2>
    <div class="row">
      <button id="btnInitKeys" class="muted">Anahtar Olustur / Yenile</button>
      <span id="keyStatus" class="small mono"></span>
    </div>
  </div>

  <div class="card">
    <h2>Yeni Lisans Uret</h2>
    <label>Lisans Kodu (bos birakirsan otomatik)</label>
    <input id="key" placeholder="LCN-0001" />
    <label>Musteri / Firma</label>
    <input id="customer" placeholder="ABC Muhasebe" />
    <label>Cihaz Kimligi</label>
    <input id="hardwareId" class="mono" placeholder="64 karakter hash" />
    <label>Bitis Tarihi (opsiyonel, YYYY-MM-DD)</label>
    <input id="expiresAt" placeholder="2027-12-31" />
    <div style="margin-top:10px;">
      <button id="btnGenerate" class="primary">Lisans Uret</button>
      <span id="genStatus" class="small mono"></span>
    </div>
  </div>

  <div class="card">
    <h2>Kayitlar</h2>
    <table>
      <thead><tr><th>Lisans</th><th>Firma</th><th>Durum</th><th>Cihaz</th><th>Dosya</th><th>Islem</th></tr></thead>
      <tbody id="records"></tbody>
    </table>
  </div>

  <script>
    async function api(url, method='GET', body=null) {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
      });
      return res.json();
    }

    function shortHw(v='') { return v.length > 16 ? v.slice(0, 16) + '...' : v; }

    async function refreshRecords() {
      const data = await api('/api/records');
      const tbody = document.getElementById('records');
      tbody.innerHTML = '';
      (data.records || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td class="mono">' + r.key + '</td>'
          + '<td>' + r.customer + '</td>'
          + '<td class="' + (r.status === 'active' ? 'ok' : 'bad') + '">' + r.status + '</td>'
          + '<td class="mono" title="' + r.hardwareId + '">' + shortHw(r.hardwareId) + '</td>'
          + '<td class="mono">' + r.fileName + '</td>'
          + '<td>' + (r.status === 'active'
            ? '<button data-key="' + r.key + '" class="warn revoke">Iptal</button>'
            : '-') + '</td>';
        tbody.appendChild(tr);
      });
      document.querySelectorAll('.revoke').forEach(btn => {
        btn.onclick = async () => {
          const key = btn.getAttribute('data-key');
          if (!confirm(key + ' lisansini iptal etmek istiyor musun?')) return;
          const res = await api('/api/revoke', 'POST', { key });
          if (!res.success) alert(res.error || 'Iptal hatasi');
          await refreshRecords();
        };
      });
    }

    async function refreshKeyStatus() {
      const st = await api('/api/status');
      document.getElementById('keyStatus').textContent = st.hasPrivateKey
        ? 'Private key hazir'
        : 'Private key yok';
    }

    document.getElementById('btnInitKeys').onclick = async () => {
      const res = await api('/api/init-keys', 'POST');
      if (!res.success) { alert(res.error || 'Anahtar olusturma hatasi'); return; }
      alert('Anahtarlar hazirlandi.');
      await refreshKeyStatus();
    };

    document.getElementById('btnGenerate').onclick = async () => {
      const payload = {
        key: document.getElementById('key').value,
        customer: document.getElementById('customer').value,
        hardwareId: document.getElementById('hardwareId').value,
        expiresAt: document.getElementById('expiresAt').value
      };
      const res = await api('/api/generate', 'POST', payload);
      const out = document.getElementById('genStatus');
      if (!res.success) {
        out.textContent = res.error || 'Lisans olusturma hatasi';
        out.style.color = '#c62929';
        return;
      }
      out.textContent = 'Olusturuldu: ' + res.record.filePath;
      out.style.color = '#0a8f44';
      await refreshRecords();
    };

    refreshKeyStatus();
    refreshRecords();
  </script>
</body>
</html>`;
}

async function requestHandler(req, res) {
  try {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getUiHtml());
      return;
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      json(res, 200, {
        success: true,
        hasPrivateKey: hasPrivateKey(),
        dataDir: DATA_DIR,
        licenseDir: LICENSE_DIR
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/init-keys') {
      const result = createLicenseKeys();
      json(res, 200, { success: true, result });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/records') {
      json(res, 200, { success: true, records: loadRecords() });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      const body = await parseBody(req);
      const record = createLicenseFile(body);
      json(res, 200, { success: true, record });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/revoke') {
      const body = await parseBody(req);
      revokeLicense(body.key);
      json(res, 200, { success: true });
      return;
    }

    json(res, 404, { success: false, error: 'Bulunamadi' });
  } catch (error) {
    json(res, 500, { success: false, error: error.message });
  }
}

function openBrowser(url) {
  const platform = os.platform();
  if (platform === 'win32') {
    require('child_process').exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    require('child_process').exec(`open "${url}"`);
  } else {
    require('child_process').exec(`xdg-open "${url}"`);
  }
}

ensureDataFiles();
const server = http.createServer(requestHandler);
server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Lisans Yoneticisi hazir: ${url}`);
  openBrowser(url);
});

