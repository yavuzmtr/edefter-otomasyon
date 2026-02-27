const http = require('http');

const PORT = Number(process.env.WA_GATEWAY_PORT || 3939);
const HOST = process.env.WA_GATEWAY_HOST || '0.0.0.0';
const ALLOWED_ORIGIN = process.env.WA_ALLOWED_ORIGIN || '*';
const API_KEY = process.env.WA_GATEWAY_KEY || '';

const GRAPH_VERSION = process.env.WA_GRAPH_VERSION || 'v22.0';
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || '';
const DEFAULT_COUNTRY_CODE = process.env.WA_DEFAULT_COUNTRY_CODE || '90';

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function normalizePhone(raw) {
  let phone = String(raw || '').replace(/\D/g, '');
  if (!phone) return '';
  if (phone.startsWith('0')) phone = DEFAULT_COUNTRY_CODE + phone.slice(1);
  if (!phone.startsWith(DEFAULT_COUNTRY_CODE) && phone.length <= 11) {
    phone = DEFAULT_COUNTRY_CODE + phone;
  }
  return phone;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function checkAuth(req) {
  if (!API_KEY) return { ok: true };
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return { ok: false, status: 401, message: 'Unauthorized' };
  return { ok: true };
}

function checkConfig() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return 'WA_PHONE_NUMBER_ID ve WA_ACCESS_TOKEN zorunlu.';
  }
  return '';
}

async function graphSend(payload) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && req.url === '/health') {
    const missing = checkConfig();
    return json(res, 200, { ok: !missing, missing: missing || null });
  }

  if (req.method === 'GET' && req.url && req.url.startsWith('/webhook')) {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const mode = u.searchParams.get('hub.mode');
    const token = u.searchParams.get('hub.verify_token');
    const challenge = u.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge || '');
      return;
    }
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    try {
      const body = await readBody(req);
      console.log('[WA webhook]', JSON.stringify(body));
      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 400, { ok: false, error: String(error.message || error) });
    }
  }

  if (req.method === 'POST' && req.url === '/api/wa/send-text') {
    const auth = checkAuth(req);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.message });

    const missing = checkConfig();
    if (missing) return json(res, 500, { ok: false, error: missing });

    try {
      const body = await readBody(req);
      const to = normalizePhone(body.to);
      const text = String(body.text || '').trim();
      if (!to || !text) return json(res, 400, { ok: false, error: '`to` ve `text` zorunlu.' });

      const result = await graphSend({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false }
      });
      return json(res, result.ok ? 200 : result.status, result);
    } catch (error) {
      return json(res, 500, { ok: false, error: String(error.message || error) });
    }
  }

  if (req.method === 'POST' && req.url === '/api/wa/send-template') {
    const auth = checkAuth(req);
    if (!auth.ok) return json(res, auth.status, { ok: false, error: auth.message });

    const missing = checkConfig();
    if (missing) return json(res, 500, { ok: false, error: missing });

    try {
      const body = await readBody(req);
      const to = normalizePhone(body.to);
      const templateName = String(body.templateName || '').trim();
      const languageCode = String(body.languageCode || 'tr').trim();
      const components = Array.isArray(body.components) ? body.components : [];
      if (!to || !templateName) {
        return json(res, 400, { ok: false, error: '`to` ve `templateName` zorunlu.' });
      }

      const result = await graphSend({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      });
      return json(res, result.ok ? 200 : result.status, result);
    } catch (error) {
      return json(res, 500, { ok: false, error: String(error.message || error) });
    }
  }

  return json(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[wa-gateway] http://${HOST}:${PORT}`);
});
