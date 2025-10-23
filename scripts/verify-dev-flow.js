const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let body = '';
      res.on('data', (d) => body += d.toString());
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  const base = 'http://localhost:5000';
  console.log('1) Requesting upload URL');
  const gen = await fetchJson(`${base}/files/generate-upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: 'verify.txt', content_type: 'text/plain' }) });
  console.log(' -> upload url:', gen.url);

  console.log('2) PUTting small test file');
  const content = 'hello from verify flow';
  await fetchJson(gen.url, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: content });
  console.log(' -> uploaded');

  console.log('3) Asking server to create sample video');
  const create = await fetchJson(`${base}/functions/v1/create-sample-video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration: 2, fps: 24 }) });
  if (!create.data || !create.data.output || !create.data.output.url) {
    console.error('unexpected response from create-sample-video', create);
    process.exit(2);
  }
  const url = create.data.output.url;
  console.log(' -> sample video url:', url);

  console.log('4) Polling for output (10s timeout)');
  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const res = await fetchJson(url);
      if (typeof res === 'string' || res instanceof Buffer) {
        console.log('Found output');
        process.exit(0);
      }
    } catch (e) {
      // not ready
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error('timeout waiting for output');
  process.exit(3);
}

run().catch((err) => { console.error(err); process.exit(1); });