const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const client = require('prom-client');

// structured logger
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// prom-client metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 3]
});
const httpRequestCount = new client.Counter({ name: 'http_request_total', help: 'Count of HTTP requests' , labelNames: ['method','route','status_code']});

const app = express();
const PORT = process.env.PORT || 5000;
// PUBLIC_URL is the externally reachable base URL for generated public links (use your domain)
const PUBLIC_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

app.use(cors());
app.use(express.json());

// simple metrics middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    httpRequestCount.inc({ method: req.method, route, status_code: res.statusCode });
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper to sanitize filenames
const sanitize = (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

app.get('/', (req, res) => {
  logger.info({ msg: 'root hit' });
  res.send('StoryForge backend is running!');
});

// metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
  } catch (err) {
    logger.error({ err }, 'metrics_error');
    res.status(500).send(err.message);
  }
});

// POST /files/generate-upload-url
// Expects JSON: { file_name, content_type, status }
app.post('/files/generate-upload-url', (req, res) => {
  try {
    const { file_name, content_type } = req.body || {};
    if (!file_name) return res.status(400).json({ error: 'file_name is required' });
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
    const targetName = `${id}-${sanitize(file_name)}`;
    const url = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(targetName)}`;
    // For client compatibility we return { url }
    return res.json({ url, file_name: targetName });
  } catch (err) {
    console.error('generateuploadurl error - index.js:82', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Accept raw PUT uploads to /uploads/:filename
app.put('/uploads/:filename', express.raw({ type: '*/*', limit: '500mb' }), (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename) return res.status(400).send('filename required');
    const targetPath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(targetPath, req.body);
    console.log('Saved upload: - index.js:94', targetPath);
    return res.status(200).json({ ok: true, path: `/uploads/${filename}` });
  } catch (err) {
    console.error('upload save error - index.js:97', err);
    return res.status(500).json({ error: 'save_failed' });
  }
});

// POST /files/generate-download-url
// Expects JSON: { file_name }
app.post('/files/generate-download-url', (req, res) => {
  try {
    const { file_name } = req.body || {};
    if (!file_name) return res.status(400).json({ error: 'file_name is required' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(file_name)}`;
    return res.json({ url });
  } catch (err) {
    console.error('generatedownloadurl error - index.js:111', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// POST /files/generate-public-url (alias for download in local dev)
app.post('/files/generate-public-url', (req, res) => {
  try {
    const { file_name } = req.body || {};
    if (!file_name) return res.status(400).json({ error: 'file_name is required' });
    const url = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(file_name)}`;
    return res.json({ url });
  } catch (err) {
    console.error('generatepublicurl error - index.js:124', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

const { spawn } = require('child_process');
let enqueueExport = async () => { return { id: 'noop' }; };
let exportQueue = { getJob: async () => null };
let readTokens = async () => ({});
let writeTokens = async () => {};
try {
  const queueModule = require('./queue');
  enqueueExport = queueModule.enqueueExport || enqueueExport;
  exportQueue = queueModule.exportQueue || exportQueue;
  readTokens = queueModule.readTokens || readTokens;
  writeTokens = queueModule.writeTokens || writeTokens;
} catch (e) {
  console.warn('Queue module unavailable, using noop stubs - index.js:141');
}
const { google } = require('googleapis');
const { createPersona, generateReply, streamReply } = require('./ai/bot');

// Locate ffmpeg binary: check environment override, where.exe, and common install paths
function findFfmpegBinary() {
  // env override
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;

  // try where.exe
  try {
    const where = require('child_process').execSync('where ffmpeg', { stdio: 'pipe' }).toString().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (const p of where) {
      if (fs.existsSync(p)) return p;
    }
  } catch (e) {
    // ignore
  }

  // common locations to check
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Gyan', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    'C:\\Program Files\\Wondershare\\Wondershare UniConverter 16 for Windows (CPC)\\ffmpeg.exe',
    'C:\\Program Files (x86)\\HitPaw\\HitPaw Univd\\ffmpeg.exe',
    'C:\\Program Files (x86)\\HitPaw\\HitPaw Univd\\Regener\\kux\\ffmpeg.exe'
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }

  // fallback to plain 'ffmpeg' (will rely on PATH)
  return 'ffmpeg';
}

const FFMPEG_BIN = findFfmpegBinary();
console.log('Using ffmpeg binary: - index.js:178', FFMPEG_BIN);

// Simple health endpoint
app.get('/_health', (req, res) => {
  res.json({ status: 'ok', ffmpeg: FFMPEG_BIN });
});

// Helper: spawn a process and collect stdout/stderr (with optional retries)
function spawnPromise(cmd, args, opts = {}) {
  const maxAttempts = opts.retries || 1;
  let attempt = 0;
  return new Promise((resolve, reject) => {
    const runOnce = () => {
      attempt++;
      const p = spawn(cmd, args, { windowsHide: true });
      let stdout = '';
      let stderr = '';
      p.stdout?.on('data', d => stdout += d.toString());
      p.stderr?.on('data', d => stderr += d.toString());
      p.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr });
        if (attempt < maxAttempts) {
          setTimeout(runOnce, 500);
        } else {
          return reject(new Error(`Process exited ${code}: ${stderr || stdout}`));
        }
      });
      p.on('error', (err) => {
        if (attempt < maxAttempts) setTimeout(runOnce, 500);
        else reject(err);
      });
    };
    runOnce();
  });
}

// Create a small sample video using lavfi color source (returns path/url)
async function createSampleVideo({ outputName, duration = 2, fps = 24 } = {}) {
  const outputPath = path.join(UPLOADS_DIR, outputName);
  const args = ['-y', '-f', 'lavfi', '-i', `color=size=320x240:rate=${fps}:color=red`, '-t', String(duration), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath];
  const result = await spawnPromise(FFMPEG_BIN, args, { retries: 2 });
  return { path: outputPath, url: `${PUBLIC_URL}/uploads/${encodeURIComponent(outputName)}`, stdout: result.stdout, stderr: result.stderr };
}

// Simple function-invocation mock endpoint to emulate W.functions.invoke("name", { body })
app.post('/functions/v1/:name', express.json(), async (req, res) => {
  const name = req.params.name;
  const body = req.body || {};
  console.log(`Function invoked: ${name} - index.js:226`, body ? Object.keys(body) : '');

  try {
    switch (name) {
      case 'generate-director-guidance': {
        const promptText = body.prompt || '';
        const characters = Array.isArray(body.characters) ? body.characters : (body.characters ? [body.characters] : []);
        // naive guidance generator (mock)
        const guidance = {
          cinematicFlow: `Start with a slow establishing shot. Build tension across three beats based on: ${promptText.slice(0,120)}`,
          cameraAngles: [
            { beat: 1, angle: 'wide', description: 'establish location and characters' },
            { beat: 2, angle: 'over-the-shoulder', description: `focus on ${characters[0] || 'protagonist'} reaction` },
            { beat: 3, angle: 'close-up', description: 'capture emotional peak' }
          ],
          beats: [
            { idx: 1, action: 'inciting incident' },
            { idx: 2, action: 'rising conflict' },
            { idx: 3, action: 'confrontation/resolution' }
          ],
          timestamp: new Date().toISOString()
        };
        return res.json({ data: { guidance }, error: null });
      }

      case 'scene-orchestration': {
        const shortPrompt = body.shortPrompt || body.prompt || '';
        // simple template matcher
        const templates = [
          { name: 'boutique_brawl', keywords: ['boutique', 'shop', 'clothes'], timeSaved: 0.7 },
          { name: 'brunch_expose', keywords: ['brunch', 'coffee', 'expose'], timeSaved: 0.6 },
          { name: 'reunion_reveal', keywords: ['reunion', 'reveal', 'party'], timeSaved: 0.5 }
        ];
        const matched = templates.find(t => t.keywords.some(k => shortPrompt.toLowerCase().includes(k))) || templates[0];
        const orchestration = {
          matchedTemplate: matched.name,
          timeSaved: matched.timeSaved,
          scene: {
            description: `Orchestrated scene from prompt: ${shortPrompt}`,
            steps: [
              { step: 1, note: 'establish the setting' },
              { step: 2, note: 'introduce conflict via look or line' },
              { step: 3, note: 'escalate and reveal' }
            ]
          },
          generated_at: new Date().toISOString()
        };
        return res.json({ data: { orchestration }, error: null });
      }
      case 'generate-episode-from-prompt': {
        // Create episode metadata, and produce a short sample video for preview (dev-mode)
        const episodeId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,6);
        const title = body.prompt?.slice(0,80) || 'Generated Episode';
        const meta = {
          id: episodeId,
          title,
          prompt: body.prompt || null,
          created_at: new Date().toISOString(),
        };
        // persist metadata for dev inspection
        const episodesDir = path.join(UPLOADS_DIR, 'episodes');
        try { if (!fs.existsSync(episodesDir)) fs.mkdirSync(episodesDir, { recursive: true }); } catch (e) {}
        const metaPath = path.join(episodesDir, `${episodeId}.json`);
        try { fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2)); } catch (e) { console.warn('failed to write meta - index.js:289', e); }

        // create a short sample video to preview the episode (uses ffmpeg)
        try {
          const sampleName = `episode-${episodeId}-preview.mp4`;
          const result = await createSampleVideo({ outputName: sampleName, duration: body.duration || 2, fps: body.fps || 24 });
          return res.json({ data: { episodeId, title, preview: result.url, message: 'Episode created and preview generated' }, error: null });
        } catch (err) {
          console.error('generateepisode sample creation failed - index.js:297', err);
          return res.json({ data: { episodeId, title, message: 'Episode created (preview failed)' }, error: null });
        }
      }

      case 'bot-orchestrator': {
        return res.json({ data: { message: 'Orchestration started (mock)' }, error: null });
      }

      case 'ultra-video-bot': {
        // Mock: pretend frames were generated and return their filenames if provided
        const episodeId = body.episodeId || ('ep-'+Date.now().toString(36));
        const frames = [];
        if (Array.isArray(body.frames)) {
          // echo back provided frames
          for (const f of body.frames) frames.push(f);
        }
        return res.json({ data: { message: 'Ultra video frames generated (mock)', episodeId, frames }, error: null });
      }

      case 'render-episode-video': {
        // If client provided file_names, call compile-video logic
        if (Array.isArray(body.file_names) && body.file_names.length > 0) {
          // call compile helper
          const outputName = body.output_name || (`${Date.now().toString(36)}-episode.mp4`);
          try {
            const result = await compileVideo(body.file_names, outputName, body.fps || 30);
            return res.json({ data: { message: 'Video rendered', output: result }, error: null });
          } catch (err) {
            console.error('compileVideo error - index.js:326', err);
            return res.status(500).json({ data: null, error: { message: err.message } });
          }
        }
        return res.json({ data: { message: 'Render started (mock)' }, error: null });
      }

      case 'compile-video': {
        if (!Array.isArray(body.file_names) || body.file_names.length === 0) return res.status(400).json({ data: null, error: { message: 'file_names required' } });
        const outputName = body.output_name || (`${Date.now().toString(36)}-compiled.mp4`);
        try {
          const result = await compileVideo(body.file_names, outputName, body.fps || 30);
          return res.json({ data: { message: 'Compiled', output: result }, error: null });
        } catch (err) {
          console.error('compilevideo error - index.js:340', err);
          return res.status(500).json({ data: null, error: { message: err.message } });
        }
      }

      case 'create-sample-video': {
        try {
          const outputName = body.output_name || (`sample-${Date.now().toString(36)}.mp4`);
          const result = await createSampleVideo({ outputName, duration: body.duration || 2, fps: body.fps || 24 });
          return res.json({ data: { message: 'Sample video created', output: result }, error: null });
        } catch (err) {
          console.error('createsamplevideo error - index.js:351', err);
          return res.status(500).json({ data: null, error: { message: err.message } });
        }
      }

      // default: return a generic mock success
      default:
        return res.json({ data: { message: `${name} invoked (mock)` }, error: null });
    }
  } catch (err) {
    console.error('function invoke error - index.js:361', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// List generated episodes (reads uploads/episodes/*.json)
app.get('/episodes', (req, res) => {
  try {
    const episodesDir = path.join(UPLOADS_DIR, 'episodes');
    if (!fs.existsSync(episodesDir)) return res.json({ data: [], error: null });
    const files = fs.readdirSync(episodesDir).filter(f => f.endsWith('.json'));
    const episodes = files.map(f => {
      try {
        const content = fs.readFileSync(path.join(episodesDir, f), 'utf8');
        const parsed = JSON.parse(content);
        // attach preview URL if exists
        const previewName = `episode-${parsed.id}-preview.mp4`;
        const previewPath = path.join(UPLOADS_DIR, previewName);
        parsed.preview = fs.existsSync(previewPath) ? `${PUBLIC_URL}/uploads/${encodeURIComponent(previewName)}` : null;
        return parsed;
      } catch (e) { return null; }
    }).filter(Boolean);
    return res.json({ data: episodes, error: null });
  } catch (err) {
    console.error('episodes list error - index.js:385', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// Get episode metadata by id
app.get('/episodes/:id', (req, res) => {
  try {
    const id = req.params.id;
    const episodesDir = path.join(UPLOADS_DIR, 'episodes');
    const metaPath = path.join(episodesDir, `${id}.json`);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ error: 'not_found' });
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const previewName = `episode-${parsed.id}-preview.mp4`;
    const previewPath = path.join(UPLOADS_DIR, previewName);
    parsed.preview = fs.existsSync(previewPath) ? `${PUBLIC_URL}/uploads/${encodeURIComponent(previewName)}` : null;
    return res.json({ data: parsed, error: null });
  } catch (err) {
    console.error('episode fetch error - index.js:403', err);
    return res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// compileVideo helper: expects array of file names (relative to uploads dir)
// Uses ffmpeg to concatenate image files into an MP4. Requires ffmpeg installed in PATH.
function compileVideo(fileNames, outputName, fps = 30) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Validate files exist
        const absoluteFiles = fileNames.map((f) => path.join(UPLOADS_DIR, f));
        for (const p of absoluteFiles) {
          if (!fs.existsSync(p)) return reject(new Error(`Missing file: ${p}`));
        }

        // Create temp dir for sequence
        const tmpDir = path.join(UPLOADS_DIR, `tmp-seq-${Date.now().toString(36)}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        // Copy files into tmpDir as img0001.png, img0002.png, ...
        for (let i = 0; i < absoluteFiles.length; i++) {
          const src = absoluteFiles[i];
          const dest = path.join(tmpDir, `img${String(i+1).padStart(4,'0')}${path.extname(src)}`);
          fs.copyFileSync(src, dest);
        }

        const outputPath = path.join(UPLOADS_DIR, outputName);

        // Build ffmpeg args using image2 pattern
        const pattern = path.join(tmpDir, `img%04d${path.extname(absoluteFiles[0])}`);
        const args = ['-y', '-framerate', String(fps), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath];
        console.log('Running ffmpeg (image2) - index.js:436', args.join(' '));

        // use spawnPromise with retries
        try {
          const proc = await spawnPromise(FFMPEG_BIN, args, { retries: 3 });
          // Cleanup tmpDir
          try {
            const files = fs.readdirSync(tmpDir);
            for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
            fs.rmdirSync(tmpDir);
          } catch (e) {}
          const publicUrl = `${'http://localhost:' + (process.env.PORT || PORT)}/uploads/${encodeURIComponent(outputName)}`;
          return resolve({ path: outputPath, url: publicUrl, stdout: proc.stdout, stderr: proc.stderr });
        } catch (err) {
          try {
            const files = fs.readdirSync(tmpDir);
            for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
            fs.rmdirSync(tmpDir);
          } catch (e) {}
          return reject(err);
        }
        
      } catch (err) {
        return reject(err);
      }
    })();
  });
}

// Export endpoint: provide direct download + a stub YouTube export
app.post('/export/download', express.json(), (req, res) => {
  const { file_name } = req.body || {};
  if (!file_name) return res.status(400).json({ error: 'file_name required' });
  const p = path.join(UPLOADS_DIR, file_name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not_found' });
  // enqueue a download job to track it and return job id
  enqueueExport({ file_name, target: 'download' }).then(job => {
    return res.json({ data: { jobId: job.id, file_name }, error: null });
  }).catch(err => res.status(500).json({ error: err.message }));
});

app.post('/export/youtube', express.json(), (req, res) => {
  // stub - in prod this would enqueue/upload to YouTube and return job status
  const { file_name } = req.body || {};
  if (!file_name) return res.status(400).json({ error: 'file_name required' });
  enqueueExport({ file_name, target: 'youtube' }).then(job => {
    return res.json({ data: { jobId: job.id, message: 'enqueued', file_name }, error: null });
  }).catch(err => res.status(500).json({ error: err.message }));
});

// AI respond: character-driven synchronous response
app.post('/ai/respond', express.json(), (req, res) => {
  const { character = {}, prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  const persona = createPersona(prompt, character);
  const reply = generateReply(persona, prompt);
  return res.json({ data: { reply }, error: null });
});

// AI stream via SSE
app.get('/ai/stream', (req, res) => {
  const prompt = req.query.prompt;
  const name = req.query.name || 'anon';
  if (!prompt) return res.status(400).send('prompt required');
  const persona = createPersona(prompt, { name, style: req.query.style || 'neutral' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  const emitter = streamReply(persona, prompt);
  emitter.on('data', (chunk) => {
    res.write(`data: ${chunk}\n\n`);
  });
  emitter.on('end', () => {
    res.write('event: done\ndata: \n\n');
    res.end();
  });
});

// YouTube OAuth: redirect user to consent screen
app.get('/youtube/auth', (req, res) => {
  const oAuth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
  const scopes = ['https://www.googleapis.com/auth/youtube.upload'];
  const url = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes });
  res.json({ url });
});

// OAuth callback: exchange code for tokens and persist
app.get('/youtube/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('missing_code');
  try {
    const oAuth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
    const { tokens } = await oAuth2Client.getToken(code);
    writeTokens(tokens);
    res.send('YouTube authorized. Tokens saved.');
  } catch (err) {
    console.error('youtube callback error - index.js:536', err);
    res.status(500).send('token_exchange_failed');
  }
});

// query job status
app.get('/export/status/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const job = await exportQueue.getJob(id);
    if (!job) return res.status(404).json({ error: 'not_found' });
    const state = await job.getState();
    const resData = { id: job.id, state, data: job.data, attemptsMade: job.attemptsMade };
    return res.json({ data: resData, error: null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET endpoint for function invocation
app.get('/functions/v1/:name', async (req, res) => {
  const functionName = req.params.name;
  
  // Mock response for now
  res.json({
    success: true,
    data: `Mock response from ${functionName}`
  });
});

const http = require('http');
const WebSocket = require('ws');

// Create HTTP server so we can attach a WebSocket server
const server = http.createServer(app);

// WebSocket server for ai streaming (mobile clients prefer WS)
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = require('url').parse(request.url || '');
  if (pathname === '/ai/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  try {
    const urlParts = require('url').parse(request.url, true);
    const q = urlParts.query || {};
    const prompt = q.prompt || '';
    const name = q.name || 'anon';
    const style = q.style || 'neutral';
    const persona = createPersona(prompt, { name, style });

    const emitter = streamReply(persona, prompt);
    const onData = (chunk) => {
      try { ws.send(JSON.stringify({ type: 'data', chunk })); } catch (e) {}
    };
    const onEnd = () => {
      try { ws.send(JSON.stringify({ type: 'done' })); } catch (e) {}
      try { ws.close(); } catch (e) {}
    };
    emitter.on('data', onData);
    emitter.on('end', onEnd);

    ws.on('close', () => {
      try { emitter.removeListener('data', onData); emitter.removeListener('end', onEnd); } catch (e) {}
    });
  } catch (err) {
    try { ws.send(JSON.stringify({ type: 'error', message: String(err) })); } catch (e) {}
    try { ws.close(); } catch (e) {}
  }
});

// Start HTTP server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} - index.js:617`);
});
