import fs from 'node:fs/promises';
import { watch as fsWatch } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export async function scaffold(target, template = 'blank', { name = path.basename(path.resolve(target)), force = false } = {}) {
  const root = path.resolve(target);
  const templates = projectTemplates();
  const files = templates[template];
  if (!files) throw new Error(`unknown Velocity template: ${template}`);
  await fs.mkdir(root, { recursive: true });
  for (const [relative, create] of Object.entries(files)) {
    const full = path.join(root, relative);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (!force) { try { await fs.access(full); throw new Error(`file exists: ${full}`); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
    await fs.writeFile(full, typeof create === 'function' ? create({ name }) : create, 'utf8');
  }
  return { root, template, files: Object.keys(files) };
}

export class DevServer extends EventEmitter {
  constructor({ root, port = 0, host = '127.0.0.1', compile, renderIndex, exposeErrors = true } = {}) {
    super();
    if (!root) throw new TypeError('DevServer requires root');
    this.root = path.resolve(root);
    this.rootReal = null;
    this.port = port;
    this.host = host;
    this.compile = compile;
    this.renderIndex = renderIndex;
    this.exposeErrors = Boolean(exposeErrors);
    this.clients = new Set();
    this.server = null;
    this.watcher = null;
    this.version = 0;
  }
  async start() {
    if (this.server) return this.address();
    this.rootReal = await fs.realpath(this.root);
    this.server = http.createServer(async (req, res) => {
      res.setHeader('x-content-type-options', 'nosniff');
      if (req.url === '/__velocity/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-store', connection: 'keep-alive' }); res.write(`event: ready\ndata: ${JSON.stringify({ version: this.version })}\n\n`); this.clients.add(res); req.on('close', () => this.clients.delete(res)); return; }
      if (req.url === '/__velocity/manifest') { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify({ root: this.root, version: this.version })); return; }
      try {
        if (this.renderIndex && (req.url === '/' || req.url === '/index.html')) { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(await this.renderIndex()); return; }
        const parsed = new URL(req.url ?? '/', 'http://velocity.local');
        const relative = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'index.html';
        const target = await secureProjectFile(this.root, this.rootReal, relative);
        let data = await fs.readFile(target);
        if (this.compile && target.endsWith('.cannon')) {
          const output = await this.compile(data.toString('utf8'), { file: target });
          if (!output || (typeof output.code !== 'string' && typeof output.output?.code !== 'string')) throw new Error('Velocity compiler returned no executable code');
          data = Buffer.from(output.code ?? output.output.code);
          res.setHeader('content-type', 'text/javascript; charset=utf-8');
        }
        res.end(data);
      } catch (error) {
        const status = error.code === 'ENOENT' ? 404 : error.code === 'VELOCITY_PATH_ESCAPE' ? 403 : 500;
        res.statusCode = status;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end(this.exposeErrors ? error.message : status === 404 ? 'not found' : status === 403 ? 'forbidden' : 'internal error');
      }
    });
    this.server.requestTimeout = 30_000;
    this.server.headersTimeout = 15_000;
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.port, this.host, resolve); });
    this.watcher = fsWatch(this.root, { recursive: true }, (_event, filename) => { if (filename) this.invalidate(filename); });
    return this.address();
  }
  invalidate(file) { this.version++; const payload = `event: change\ndata: ${JSON.stringify({ file, version: this.version })}\n\n`; for (const client of [...this.clients]) { try { client.write(payload); } catch { this.clients.delete(client); } } this.emit('change', { file, version: this.version }); }
  address() { const address = this.server?.address(); return typeof address === 'object' && address ? { host: this.host, port: address.port, url: `http://${this.host}:${address.port}` } : null; }
  async close() { this.watcher?.close(); this.watcher = null; for (const client of this.clients) client.end(); this.clients.clear(); if (this.server) await new Promise((resolve) => this.server.close(resolve)); this.server = null; }
}

export class PreviewProtocol extends EventEmitter {
  constructor({ secret = crypto.randomBytes(32) } = {}) { super(); this.secret = Buffer.from(secret); this.devices = new Map(); }
  createPairing({ project, expiresInMs = 5 * 60_000 } = {}) {
    if (!project) throw new TypeError('preview pairing requires project');
    if (!Number.isInteger(expiresInMs) || expiresInMs < 1 || expiresInMs > 24 * 60 * 60_000) throw new TypeError('expiresInMs must be between 1ms and 24h');
    const payload = { project, nonce: crypto.randomUUID(), expiresAt: Date.now() + expiresInMs };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }
  pair(token, device) {
    if (!device || typeof device !== 'object') throw new TypeError('preview pairing requires device metadata');
    const parts = String(token).split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('invalid preview pairing token');
    const [encoded, signature] = parts;
    const expected = crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url');
    const suppliedBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (suppliedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(suppliedBytes, expectedBytes)) throw new Error('invalid preview pairing token');
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { throw new Error('invalid preview pairing token'); }
    if (!payload?.project || !payload?.nonce || !Number.isFinite(payload.expiresAt)) throw new Error('invalid preview pairing token');
    if (payload.expiresAt < Date.now()) throw new Error('preview pairing token expired');
    const id = device.id ?? crypto.randomUUID();
    this.devices.set(id, { id, project: payload.project, ...structuredClone(device), pairedAt: new Date().toISOString() });
    this.emit('paired', this.devices.get(id));
    return structuredClone(this.devices.get(id));
  }
  list(project = null) { return [...this.devices.values()].filter((device) => !project || device.project === project).map((device) => structuredClone(device)); }
}

export function targetPlan(target, config = {}) {
  const plans = {
    web: { target: 'web', tool: 'nova', compile: 'javascript', renderer: 'sprout-web', artifact: 'web-bundle' },
    android: { target: 'android', tool: config.androidTool ?? 'gradle', prerequisites: ['java', 'android-sdk'], renderer: 'sprout-native', artifact: 'apk/aab' },
    ios: { target: 'ios', tool: config.iosTool ?? 'xcodebuild', prerequisites: ['xcode', 'codesign'], renderer: 'sprout-native', artifact: 'app/ipa' },
    desktop: { target: 'desktop', tool: config.desktopTool ?? 'native-shell', prerequisites: ['native-toolchain'], renderer: 'sprout-desktop', artifact: 'native-app' }
  };
  if (!plans[target]) throw new Error(`unsupported Velocity target: ${target}`);
  return structuredClone(plans[target]);
}

export function createNativeModuleManifest({ name, library, functions = [], platforms = ['android','ios','desktop'] }) {
  if (!name || !library) throw new Error('native module requires name and library');
  return { protocol: 'velocity-plasma/1', name, library, platforms: [...new Set(platforms)], functions: functions.map((fn) => ({ name: fn.name, parameters: fn.parameters ?? [], returns: fn.returns ?? 'void' })) };
}

export async function executeTargetPlan(plan, { cwd = process.cwd(), env = process.env, args = [], signal, timeoutMs = 10 * 60_000, maxOutputBytes = 16 * 1024 * 1024 } = {}) {
  if (!plan?.tool) throw new TypeError('target plan requires tool');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be a positive integer');
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1) throw new TypeError('maxOutputBytes must be a positive integer');
  const command = resolveCommand(plan, args);
  return new Promise((resolve, reject) => {
    let settled = false, stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), timedOut = false;
    const child = spawn(command.bin, command.args, { cwd, env, stdio: 'pipe', shell: false, windowsHide: true });
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener?.('abort', onAbort); if (error) reject(error); else resolve(result); };
    const terminate = (error, timeout = false) => { timedOut ||= timeout; if (!child.killed) child.kill('SIGKILL'); if (error) finish(error); };
    const timer = setTimeout(() => terminate(new Error(`Velocity target command timed out after ${timeoutMs}ms`), true), timeoutMs); timer.unref?.();
    const onAbort = () => terminate(signal.reason instanceof Error ? signal.reason : new Error('Velocity target command aborted'));
    if (signal?.aborted) return onAbort();
    signal?.addEventListener?.('abort', onAbort, { once: true });
    const append = (buffer, chunk, streamName) => {
      const bytes = Buffer.from(chunk);
      if (buffer.length + bytes.length > maxOutputBytes) { terminate(new Error(`Velocity target ${streamName} exceeded ${maxOutputBytes} bytes`)); return buffer; }
      return Buffer.concat([buffer, bytes]);
    };
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk, 'stdout'); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk, 'stderr'); });
    child.on('error', (error) => finish(error));
    child.on('close', (code, exitSignal) => { if (settled) return; finish(null, { ok: code === 0, code, signal: exitSignal, timedOut, stdout: stdout.toString('utf8'), stderr: stderr.toString('utf8'), command }); });
  });
}

export function chronosHandoff(app, plan, { branch = 'main', commit = null } = {}) {
  const canonical = { app: app.name, targets: app.targets, build: app.build, branch, commit, plan };
  return { protocol: 'velocity-chronos/1', app: app.name, targets: app.targets, build: app.build, branch, commit, steps: structuredClone(plan), requestedAt: new Date().toISOString(), digest: crypto.createHash('sha256').update(stableStringify(canonical)).digest('hex') };
}

function projectTemplates() { return {
  blank: { 'velocity.json': ({name}) => JSON.stringify({ name, targets: ['web'], entry: 'src/main.cannon' }, null, 2) + '\n', 'src/main.cannon': 'print("Hello from Velocity")\n', 'public/index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.cannon"></script></body></html>\n' },
  fullstack: { 'velocity.json': ({name}) => JSON.stringify({ name, targets: ['web','server'], entry: 'src/main.cannon', services: { ui: 'sprout', backend: 'cadence' } }, null, 2) + '\n', 'src/main.cannon': 'print("Velocity full stack")\n', 'server/main.cannon': 'print("Cadence server")\n' }
}; }

async function secureProjectFile(root, rootReal, relative) {
  const lexical = path.resolve(root, relative);
  if (lexical !== root && !lexical.startsWith(root + path.sep)) throw pathEscape();
  let real;
  try { real = await fs.realpath(lexical); } catch (error) { throw error; }
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) throw pathEscape();
  return real;
}
function pathEscape() { const error = new Error('path escapes dev-server root'); error.code = 'VELOCITY_PATH_ESCAPE'; return error; }
function resolveCommand(plan, extraArgs) { if (plan.target === 'android') return { bin: plan.tool, args: ['assembleDebug', ...extraArgs] }; if (plan.target === 'ios') return { bin: plan.tool, args: ['-configuration', 'Debug', 'build', ...extraArgs] }; if (plan.target === 'desktop') return { bin: plan.tool, args: ['build', ...extraArgs] }; return { bin: plan.tool, args: extraArgs }; }
function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
