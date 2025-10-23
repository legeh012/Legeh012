const Queue = require('bull');
const path = require('path');
const fs = require('fs');
const Redis = require('ioredis');
const { google } = require('googleapis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redis;
let exportQueue;

// attempt to initialize Redis and Bull; if connection fails, export no-op fallbacks
try {
  // configure Redis client to avoid aggressive reconnects in local dev when Redis isn't available
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null, enableOfflineQueue: false });
  // log only the first error to avoid flooding the terminal
  let _redisErrorLogged = false;
  redis.on('error', (err) => {
    if (!_redisErrorLogged) {
      _redisErrorLogged = true;
      console.warn('[ioredis] redis error (caught): - queue.js:20', err && err.message ? err.message : err);
    }
  });

  exportQueue = new Queue('export-queue', REDIS_URL);
} catch (e) {
  console.warn('Redis/Bull init failed, falling back to noop queue. Error: - queue.js:26', e && e.message ? e.message : e);
  // no-op redis and queue implementations for dev when Redis unavailable
  redis = {
    on: () => {},
    get: async () => null
  };
  exportQueue = {
    add: async (data) => ({ id: `noop-${Date.now().toString(36)}` }),
    getJob: async () => null,
    process: () => {}
  };
}

// simple token store (file-based for dev)
const TOKENS_PATH = path.join(__dirname, 'youtube_tokens.json');
function readTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_PATH)); } catch (e) { return null; }
}
function writeTokens(t) { try { fs.writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2)); } catch (e) {} }

async function uploadToYoutube(filePath, title = 'StoryForge Export') {
  const tokens = readTokens();
  if (!tokens) throw new Error('no_youtube_tokens');
  const oAuth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
  oAuth2Client.setCredentials(tokens);
  const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
  const res = await youtube.videos.insert({
    part: ['snippet','status'],
    requestBody: {
      snippet: { title },
      status: { privacyStatus: 'private' }
    },
    media: { body: fs.createReadStream(filePath) }
  });
  return res.data;
}

// worker: process export jobs
exportQueue.process(async (job) => {
  const { file_name, target } = job.data;
  const filePath = path.join(__dirname, 'uploads', file_name);
  if (!fs.existsSync(filePath)) throw new Error('file_missing');

  if (target === 'youtube') {
    // attempt upload to YouTube (requires tokens); on failure, job will retry
    const uploaded = await uploadToYoutube(filePath, `StoryForge Export - ${file_name}`);
    return { ok: true, uploaded };
  }

  // default: simulate work
  await new Promise(r => setTimeout(r, 1000));
  return { ok: true, file: file_name, target };
});

// helper to enqueue
function enqueueExport(data) {
  try {
    return exportQueue.add(data, { attempts: 3, backoff: 2000 });
  } catch (e) {
    // fallback for no-op queue
    return Promise.resolve({ id: `noop-${Date.now().toString(36)}` });
  }
}

module.exports = { enqueueExport, exportQueue, redis, readTokens, writeTokens };