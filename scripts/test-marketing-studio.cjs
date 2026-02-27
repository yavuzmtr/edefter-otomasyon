const { spawn } = require('child_process');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 3911;
const BASE = `http://${HOST}:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch (e) {
      // wait and retry
    }
    await sleep(300);
  }
  return false;
}

async function run() {
  const child = spawn(process.execPath, [path.join('scripts', 'marketing-studio.cjs')], {
    env: {
      ...process.env,
      MARKETING_STUDIO_PORT: String(PORT),
      MARKETING_STUDIO_NO_OPEN: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[server-err] ${d}`));

  try {
    const healthy = await waitForHealth();
    if (!healthy) throw new Error('Server health timeout');

    const genRes = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'x', tone: 'sade', objective: 'lead toplama', count: 2 })
    });
    if (!genRes.ok) throw new Error(`Generate failed: ${genRes.status}`);
    const genData = await genRes.json();
    if (!Array.isArray(genData.posts) || genData.posts.length !== 2) {
      throw new Error('Generate returned invalid posts');
    }
    const first = genData.posts[0];
    if (!first.title || !first.body || !first.hook) {
      throw new Error('Generated post missing required fields');
    }

    const saveRes = await fetch(`${BASE}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: genData.posts })
    });
    if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);

    const stateRes = await fetch(`${BASE}/api/state`);
    if (!stateRes.ok) throw new Error(`State failed: ${stateRes.status}`);
    const state = await stateRes.json();
    if (!Array.isArray(state.posts) || state.posts.length < 2) {
      throw new Error('State did not include saved posts');
    }

    const markRes = await fetch(`${BASE}/api/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: first.id, status: 'ready' })
    });
    if (!markRes.ok) throw new Error(`Mark failed: ${markRes.status}`);

    const verifyRes = await fetch(`${BASE}/api/state`);
    const verify = await verifyRes.json();
    const marked = verify.posts.find((p) => p.id === first.id);
    if (!marked || marked.status !== 'ready') {
      throw new Error('Mark status verification failed');
    }

    console.log('TEST PASSED: marketing studio end-to-end flow works.');
  } finally {
    child.kill();
  }
}

run().catch((err) => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
