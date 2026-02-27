const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.MARKETING_STUDIO_PORT || 3901);
const DATA_DIR = path.join(process.cwd(), 'data', 'marketing-studio');
const DATA_FILE = path.join(DATA_DIR, 'content-db.json');

const FEATURES = [
  'E-defter berat takip otomasyonu',
  '7/3/son gun mail uyari sistemi',
  'Klasor izleme ve eksik dosya tespiti',
  'Raporlama ve denetim hazirligi',
  'Otomatik yedekleme ve arsiv'
];

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ posts: [], createdAt: new Date().toISOString() }, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function makePost(platform, tone, objective, i) {
  const feature = pick(FEATURES, i);
  if (platform === 'youtube') {
    return {
      id: `yt-${Date.now()}-${i}`,
      platform,
      status: 'draft',
      title: `${feature}: ${objective} icin pratik cozum`,
      body: `Bu videoda ${feature} ile manuel kontrol yukunu nasil azalttigimizi anlatiyoruz.\n\nKimler icin: Mali musavir ofisleri\nNe saglar: zaman kazanci, hata azalmasi, sure takibi\n\nDemo: https://edefterotomasyon.com.tr/download-form.html`,
      tags: ['edefter', 'mali musavir', 'otomasyon', 'berat takip'],
      createdAt: new Date().toISOString(),
      tone
    };
  }

  const opener = tone === 'resmi' ? 'Muhasebe sureclerinde' : 'Hala manuel kontrol mu?';
  return {
    id: `x-${Date.now()}-${i}`,
    platform,
    status: 'draft',
    title: `${objective} - ${feature}`,
    body: `${opener}\n\n${feature} ile kritik tarihleri kacirma riskini azaltin.\n\nDemo indir: https://edefterotomasyon.com.tr/download-form.html\n#edefter #muhasebe #otomasyon`,
    tags: ['edefter', 'muhasebe', 'otomasyon'],
    createdAt: new Date().toISOString(),
    tone
  };
}

function generatePlan({ platform = 'x', tone = 'sade', objective = 'zaman kazanimi', count = 5 }) {
  const n = Math.max(1, Math.min(20, Number(count) || 5));
  return Array.from({ length: n }, (_, i) => makePost(platform, tone, objective, i));
}

const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pazarlama Studyo</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f3f5f7;margin:0;padding:24px;color:#1f2937}
    .wrap{max-width:1100px;margin:0 auto}
    .card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 8px 24px rgba(0,0,0,.08);margin-bottom:14px}
    h1{margin:0 0 8px;font-size:28px}
    .row{display:flex;gap:8px;flex-wrap:wrap}
    select,input,button{padding:10px;border:1px solid #d1d5db;border-radius:8px}
    button{cursor:pointer;background:#0ea5e9;border-color:#0ea5e9;color:#fff;font-weight:700}
    .secondary{background:#fff;color:#111827}
    textarea{width:100%;min-height:90px;border:1px solid #d1d5db;border-radius:8px;padding:8px}
    .post{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-top:10px}
    .post h4{margin:0 0 8px}
    .meta{font-size:12px;color:#6b7280}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Pazarlama Studyo</h1>
      <div class="row">
        <select id="platform"><option value="x">X Post</option><option value="youtube">YouTube Video</option></select>
        <select id="tone"><option value="sade">Sade</option><option value="resmi">Resmi</option><option value="satis">Satis Odakli</option></select>
        <input id="objective" value="zaman kazanimi" />
        <input id="count" type="number" min="1" max="20" value="5" />
        <button id="generate">Icerik Uret</button>
        <button id="save" class="secondary">Kaydet</button>
      </div>
      <p class="meta">Bu panel otomatik taslak uretir. Son kontrolu sen yapip yayinla.</p>
    </div>
    <div class="card">
      <h3>Taslaklar</h3>
      <div id="drafts"></div>
    </div>
    <div class="card">
      <h3>Kayitli Icerikler</h3>
      <div id="saved"></div>
    </div>
  </div>
<script>
let currentDrafts = [];
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function postHtml(p, editable){
  return '<div class="post" data-id="'+p.id+'">'+
    '<h4>'+esc(p.title)+'</h4>'+
    '<textarea '+(editable?'':'readonly')+' class="body">'+esc(p.body)+'</textarea>'+
    '<div class="meta">Platform: '+esc(p.platform)+' | Durum: '+esc(p.status||'draft')+'</div>'+
    (editable ? '<div class="row" style="margin-top:8px"><button class="mark" data-status="ready">Ready</button><button class="mark secondary" data-status="published">Published</button></div>' : '')+
  '</div>';
}
async function loadSaved(){
  const res = await fetch('/api/state'); const data = await res.json();
  document.getElementById('saved').innerHTML = data.posts.map(p=>postHtml(p,true)).join('') || '<p>Kayit yok</p>';
  bindMarkButtons();
}
function renderDrafts(){
  document.getElementById('drafts').innerHTML = currentDrafts.map(p=>postHtml(p,false)).join('') || '<p>Taslak yok</p>';
}
function bindMarkButtons(){
  document.querySelectorAll('.mark').forEach(btn=>{
    btn.onclick = async () => {
      const post = btn.closest('.post'); const id = post.getAttribute('data-id'); const status = btn.getAttribute('data-status');
      await fetch('/api/mark', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
      loadSaved();
    };
  });
}
document.getElementById('generate').onclick = async () => {
  const payload = {
    platform: document.getElementById('platform').value,
    tone: document.getElementById('tone').value,
    objective: document.getElementById('objective').value,
    count: Number(document.getElementById('count').value||5)
  };
  const res = await fetch('/api/generate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data = await res.json();
  currentDrafts = data.posts || [];
  renderDrafts();
};
document.getElementById('save').onclick = async () => {
  if (!currentDrafts.length) return;
  await fetch('/api/save', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({posts:currentDrafts})});
  await loadSaved();
};
loadSaved();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/state') {
    const db = readDb();
    json(res, 200, db);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    try {
      const payload = await readBody(req);
      const posts = generatePlan(payload);
      json(res, 200, { posts });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    try {
      const payload = await readBody(req);
      const db = readDb();
      const incoming = Array.isArray(payload.posts) ? payload.posts : [];
      db.posts.unshift(...incoming);
      db.posts = db.posts.slice(0, 500);
      writeDb(db);
      json(res, 200, { success: true, count: incoming.length });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/mark') {
    try {
      const payload = await readBody(req);
      const db = readDb();
      const target = db.posts.find((p) => p.id === payload.id);
      if (!target) return json(res, 404, { error: 'Not found' });
      target.status = payload.status || 'draft';
      target.updatedAt = new Date().toISOString();
      writeDb(db);
      json(res, 200, { success: true });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`[marketing-studio] ${url}`);
  exec(`start "" "${url}"`);
});
