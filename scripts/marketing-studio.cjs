const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.MARKETING_STUDIO_PORT || 3901);
const DATA_DIR = path.join(process.cwd(), 'data', 'marketing-studio');
const DATA_FILE = path.join(DATA_DIR, 'content-db.json');
const DEMO_URL = 'https://edefterotomasyon.com.tr/download-form.html';

const FEATURES = [
  'e-defter berat takip otomasyonu',
  '7/3/son gun e-posta uyari sistemi',
  'klasor izleme ve eksik dosya tespiti',
  'raporlama ve denetim hazirligi',
  'otomatik yedekleme ve arsivleme'
];

const PAINS = [
  'Son gun yaklasinca stres ve kontrol yukunun artmasi',
  'Mail/berat durumunun tek tek kontrol edilmesi',
  'Eksik klasor veya geciken donemlerin gec fark edilmesi',
  'Ofiste kisiye bagimli isleyis nedeniyle surec riski',
  'Yogun donemlerde atlanan takip adimlari'
];

const HOOKS = {
  sade: [
    'Hala manuel e-defter kontrolu mu?',
    'Takvim yaklastiginda ekip zorlanmasin.',
    'Kontrol listesi yerine otomatik akis kullanin.'
  ],
  resmi: [
    'Mali musavir ofisleri icin operasyonel standart:',
    'Surec yonetiminde izlenebilirlik ve zamaninda aksiyon:',
    'Denetime hazir, olculebilir bir takip yapisi:'
  ],
  satis: [
    'Her ay ayni stres? 10 dakikada duzen kurun.',
    'Ceza riski yerine otomatik takip secin.',
    'Ekibin zamani kontrole degil musteriye kalsin.'
  ]
};

const CTAS = [
  `Demo indir: ${DEMO_URL}`,
  `15 gun demo: ${DEMO_URL}`,
  `Simdi dene: ${DEMO_URL}`
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

function nowIso() {
  return new Date().toISOString();
}

function buildHashtags(platform) {
  if (platform === 'youtube') {
    return ['edefter', 'maliMusavir', 'otomasyon', 'beratTakip', 'raporlama'];
  }
  return ['#edefter', '#muhasebe', '#maliMusavir', '#otomasyon'];
}

function createXPost(tone, objective, i) {
  const feature = pick(FEATURES, i);
  const pain = pick(PAINS, i + 1);
  const hook = pick(HOOKS[tone] || HOOKS.sade, i);
  const cta = pick(CTAS, i);
  const bodyLines = [
    hook,
    '',
    `${pain}.`,
    `${feature} ile bu sureci tek panelden takip edin.`,
    '',
    `Hedef: ${objective}`,
    cta,
    buildHashtags('x').join(' ')
  ];

  return {
    id: `x-${Date.now()}-${i}`,
    platform: 'x',
    status: 'draft',
    tone,
    createdAt: nowIso(),
    title: `${feature} | ${objective}`,
    hook,
    body: bodyLines.join('\n'),
    cta,
    hashtags: buildHashtags('x')
  };
}

function createYoutubePost(tone, objective, i) {
  const feature = pick(FEATURES, i);
  const pain = pick(PAINS, i + 2);
  const hook = pick(HOOKS[tone] || HOOKS.sade, i);
  const cta = pick(CTAS, i);

  const videoFlow = [
    '0-5 sn: Problem cümlesi',
    `5-20 sn: ${pain}`,
    `20-45 sn: Ekranda ${feature} gosteri`,
    `45-60 sn: Sonuc + ${cta}`
  ].join('\n');

  const description = [
    `${hook}`,
    '',
    `Bu videoda ${feature} ile surec kontrolunu nasil sadeleştireceginizi anlatiyoruz.`,
    `Hedef: ${objective}`,
    '',
    `Kimler icin: Mali musavir ofisleri`,
    `Demo linki: ${DEMO_URL}`,
    '',
    `Video akisi:`,
    videoFlow
  ].join('\n');

  return {
    id: `yt-${Date.now()}-${i}`,
    platform: 'youtube',
    status: 'draft',
    tone,
    createdAt: nowIso(),
    title: `${feature}: ${objective} icin net cozum`,
    hook,
    body: description,
    cta,
    tags: buildHashtags('youtube'),
    videoFlow
  };
}

function generatePlan({ platform = 'x', tone = 'sade', objective = 'zaman kazanimi', count = 5 }) {
  const n = Math.max(1, Math.min(20, Number(count) || 5));
  return Array.from({ length: n }, (_, i) => {
    if (platform === 'youtube') return createYoutubePost(tone, objective, i);
    return createXPost(tone, objective, i);
  });
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
    textarea{width:100%;min-height:110px;border:1px solid #d1d5db;border-radius:8px;padding:8px}
    .post{border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-top:10px}
    .post h4{margin:0 0 8px}
    .meta{font-size:12px;color:#6b7280}
    .chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    .chip{padding:4px 8px;border-radius:999px;background:#e0f2fe;font-size:12px;color:#075985}
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
        <button id="exportDraftsTxt" class="secondary">Taslaklari TXT indir</button>
        <button id="exportDraftsJson" class="secondary">Taslaklari JSON indir</button>
      </div>
      <p class="meta">Hazir taslak uretir. Kopyala -> paylas akisi icin tasarlandi.</p>
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
let postIndex = {};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function joinTags(tags){ return (tags||[]).map(t=>'<span class="chip">'+esc(t)+'</span>').join('');}

function copyText(v){
  navigator.clipboard.writeText(v || '').then(()=>alert('Kopyalandi'));
}

function indexPosts(posts){
  (posts || []).forEach((p) => { postIndex[p.id] = p; });
}

function downloadFile(fileName, content, mimeType){
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function postPackageText(post){
  const tags = post.hashtags || post.tags || [];
  const lines = [
    'PLATFORM: ' + (post.platform || ''),
    'DURUM: ' + (post.status || 'draft'),
    'BASLIK: ' + (post.title || ''),
    'HOOK: ' + (post.hook || ''),
    'CTA: ' + (post.cta || ''),
    'ETIKETLER: ' + tags.join(', '),
    '',
    'METIN:',
    post.body || ''
  ];
  if (post.videoFlow) {
    lines.push('', 'VIDEO AKISI:', post.videoFlow);
  }
  return lines.join('\\n');
}

function postHtml(p, editable){
  const tags = p.hashtags || p.tags || [];
  const xBtn = p.platform === 'x' ? '<button class="open-x secondary">Xte Ac</button>' : '';
  return '<div class="post" data-id="'+p.id+'">'+
    '<h4>'+esc(p.title)+'</h4>'+
    '<div class="meta">Hook: '+esc(p.hook || '-')+'</div>'+
    '<textarea '+(editable?'':'readonly')+' class="body">'+esc(p.body)+'</textarea>'+
    '<div class="chips">'+joinTags(tags)+'</div>'+
    '<div class="meta">Platform: '+esc(p.platform)+' | Durum: '+esc(p.status||'draft')+'</div>'+
    '<div class="row" style="margin-top:8px">'+
      '<button class="copy secondary">Metni Kopyala</button>'+
      '<button class="copy-title secondary">Baslik Kopyala</button>'+
      '<button class="ai-image secondary">AI Gorsel Uret</button>'+
      '<button class="ai-video secondary">AI Video Prompt</button>'+
      xBtn+
      '<button class="download-one secondary">Paket indir</button>'+
      (editable ? '<button class="mark" data-status="ready">Ready</button><button class="mark secondary" data-status="published">Published</button>' : '')+
    '</div>'+
  '</div>';
}

async function loadSaved(){
  const res = await fetch('/api/state'); const data = await res.json();
  indexPosts(data.posts || []);
  document.getElementById('saved').innerHTML = data.posts.map(p=>postHtml(p,true)).join('') || '<p>Kayit yok</p>';
  bindActions();
}

function renderDrafts(){
  indexPosts(currentDrafts);
  document.getElementById('drafts').innerHTML = currentDrafts.map(p=>postHtml(p,false)).join('') || '<p>Taslak yok</p>';
  bindActions();
}

function bindActions(){
  document.querySelectorAll('.mark').forEach(btn=>{
    btn.onclick = async () => {
      const post = btn.closest('.post'); const id = post.getAttribute('data-id'); const status = btn.getAttribute('data-status');
      await fetch('/api/mark', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
      loadSaved();
    };
  });

  document.querySelectorAll('.copy').forEach(btn=>{
    btn.onclick = () => {
      const text = btn.closest('.post').querySelector('.body').value;
      copyText(text);
    };
  });

  document.querySelectorAll('.copy-title').forEach(btn=>{
    btn.onclick = () => {
      const title = btn.closest('.post').querySelector('h4').innerText;
      copyText(title);
    };
  });

  document.querySelectorAll('.open-x').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.closest('.post').getAttribute('data-id');
      const p = postIndex[id];
      if (!p) return;
      const url = 'https://x.com/intent/tweet?text=' + encodeURIComponent(p.body || '');
      window.open(url, '_blank');
    };
  });

  document.querySelectorAll('.download-one').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.closest('.post').getAttribute('data-id');
      const p = postIndex[id];
      if (!p) return;
      const safeTitle = (p.title || 'icerik').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      downloadFile('paket-' + safeTitle + '.txt', postPackageText(p), 'text/plain;charset=utf-8');
    };
  });

  document.querySelectorAll('.ai-image').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.closest('.post').getAttribute('data-id');
      const p = postIndex[id];
      if (!p) return;
      const prompt = buildImagePrompt(p);
      copyText(prompt);
      const trimmed = prompt.slice(0, 350);
      const bingUrl = 'https://www.bing.com/images/create?q=' + encodeURIComponent(trimmed);
      const pollinationsUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(trimmed) + '?model=flux&seed=' + Date.now();
      window.open(bingUrl, '_blank');
      setTimeout(() => window.open(pollinationsUrl, '_blank'), 500);
    };
  });

  document.querySelectorAll('.ai-video').forEach(btn=>{
    btn.onclick = () => {
      const id = btn.closest('.post').getAttribute('data-id');
      const p = postIndex[id];
      if (!p) return;
      const videoPrompt = buildVideoPrompt(p);
      copyText(videoPrompt);
      const safeTitle = (p.title || 'video-prompt').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
      downloadFile('video-prompt-' + safeTitle + '.txt', videoPrompt, 'text/plain;charset=utf-8');
    };
  });
}

function buildImagePrompt(p){
  const tags = (p.hashtags || p.tags || []).join(', ');
  const formatText = p.platform === 'youtube' ? 'youtube thumbnail, high contrast, readable title area' : 'social media post visual, clean layout';
  return [
    'Professional fintech style visual',
    p.title || '',
    p.hook || '',
    'Topic: E-Defter otomasyon, mali musavir ofisi',
    formatText,
    'Color palette: navy blue, cyan accents, white text',
    'No watermark, no logo distortion, sharp details',
    'Keywords: ' + tags
  ].join('. ');
}

function buildVideoPrompt(p){
  const cta = p.cta || ('Demo indir: ' + DEMO_URL);
  return [
    'TR DILINDE 60 saniyelik tanitim videosu olustur.',
    'Kitle: Mali musavir ofisleri.',
    'Baslik: ' + (p.title || ''),
    'Acilis hook: ' + (p.hook || ''),
    'Sahne 1 (0-5sn): Problem cümlesi, hızlı giriş.',
    'Sahne 2 (5-20sn): Manuel takip kaynaklı riskleri göster.',
    'Sahne 3 (20-45sn): Uygulama ekrani, klasor/berat/mail takip akışı.',
    'Sahne 4 (45-60sn): Sonuc + net CTA.',
    'Ses tonu: guven veren, profesyonel, net.',
    'Ekran yazi cagrisi: ' + cta
  ].join('\\n');
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

document.getElementById('exportDraftsTxt').onclick = () => {
  if (!currentDrafts.length) return alert('Once icerik uret');
  const text = currentDrafts.map((p, i) => '--- Taslak ' + (i + 1) + ' ---\\n' + postPackageText(p)).join('\\n\\n');
  downloadFile('taslaklar.txt', text, 'text/plain;charset=utf-8');
};

document.getElementById('exportDraftsJson').onclick = () => {
  if (!currentDrafts.length) return alert('Once icerik uret');
  downloadFile('taslaklar.json', JSON.stringify(currentDrafts, null, 2), 'application/json;charset=utf-8');
};

loadSaved();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/state') {
    json(res, 200, readDb());
    return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    try {
      const payload = await readBody(req);
      json(res, 200, { posts: generatePlan(payload) });
    } catch (err) {
      json(res, 400, { error: String(err) });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    try {
      const payload = await readBody(req);
      const incoming = Array.isArray(payload.posts) ? payload.posts : [];
      const db = readDb();
      db.posts.unshift(...incoming);
      db.posts = db.posts.slice(0, 700);
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
      target.updatedAt = nowIso();
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
  if (process.env.MARKETING_STUDIO_NO_OPEN !== '1') {
    exec(`start "" "${url}"`);
  }
});
