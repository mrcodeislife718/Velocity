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
  constructor({ root, port = 0, host = '127.0.0.1', compile, renderIndex } = {}) { super(); this.root = path.resolve(root); this.port = port; this.host = host; this.compile = compile; this.renderIndex = renderIndex; this.clients = new Set(); this.server = null; this.watcher = null; this.version = 0; }
  async start() {
    if (this.server) return this.address();
    this.server = http.createServer(async (req, res) => {
      if (req.url === '/__velocity/events') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); res.write(`event: ready\ndata: ${JSON.stringify({ version: this.version })}\n\n`); this.clients.add(res); req.on('close', () => this.clients.delete(res)); return; }
      if (req.url === '/__velocity/manifest') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ root: this.root, version: this.version })); return; }
      try {
        if (this.renderIndex && (req.url === '/' || req.url === '/index.html')) { res.setHeader('content-type', 'text/html'); res.end(await this.renderIndex()); return; }
        const relative = decodeURIComponent((req.url ?? '/').replace(/^\//, '')) || 'index.html';
        const target = safeJoin(this.root, relative);
        let data = await fs.readFile(target);
        if (this.compile && target.endsWith('.cannon')) { const output = await this.compile(data.toString('utf8'), { file: target }); data = Buffer.from(output.code ?? output.output?.code ?? ''); res.setHeader('content-type', 'text/javascript'); }
        res.end(data);
      } catch (error) { res.statusCode = error.code === 'ENOENT' ? 404 : 500; res.end(error.message); }
    });
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.port, this.host, resolve); });
    this.watcher = fsWatch(this.root, { recursive: true }, (_event, filename) => { if (filename) this.invalidate(filename); });
    return this.address();
  }
  invalidate(file) { this.version++; const payload = `event: change\ndata: ${JSON.stringify({ file, version: this.version })}\n\n`; for (const client of [...this.clients]) { try { client.write(payload); } catch { this.clients.delete(client); } } this.emit('change', { file, version: this.version }); }
  address() { const address = this.server?.address(); return typeof address === 'object' && address ? { host: this.host, port: address.port, url: `http://${this.host}:${address.port}` } : null; }
  async close() { this.watcher?.close(); for (const client of this.clients) client.end(); this.clients.clear(); if (this.server) await new Promise((resolve) => this.server.close(resolve)); this.server = null; }
}

export class PreviewProtocol extends EventEmitter {
  constructor({ secret = crypto.randomBytes(32) } = {}) { super(); this.secret = Buffer.from(secret); this.devices = new Map(); }
  createPairing({ project, expiresInMs = 5 * 60_000 } = {}) { const payload = { project, nonce: crypto.randomUUID(), expiresAt: Date.now() + expiresInMs }; const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url'); const signature = crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url'); return `${encoded}.${signature}`; }
  pair(token, device) { const [encoded, signature] = String(token).split('.'); const expected = crypto.createHmac('sha256', this.secret).update(encoded).digest('base64url'); if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('invalid preview pairing token'); const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); if (payload.expiresAt < Date.now()) throw new Error('preview pairing token expired'); const id = device.id ?? crypto.randomUUID(); this.devices.set(id, { id, project: payload.project, ...structuredClone(device), pairedAt: new Date().toISOString() }); this.emit('paired', this.devices.get(id)); return structuredClone(this.devices.get(id)); }
  list(project = null) { return [...this.devices.values()].filter((device) => !project || device.project === project).map(structuredClone); }
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

export async function executeTargetPlan(plan, { cwd = process.cwd(), env = process.env, args = [] } = {}) {
  const command = resolveCommand(plan, args);
  return new Promise((resolve, reject) => {
    const child = spawn(command.bin, command.args, { cwd, env, stdio: 'pipe' });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => stdout += chunk); child.stderr.on('data', (chunk) => stderr += chunk);
    child.on('error', reject); child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr, command }));
  });
}

export function chronosHandoff(app, plan, { branch = 'main', commit = null } = {}) {
  return { protocol: 'velocity-chronos/1', app: app.name, targets: app.targets, build: app.build, branch, commit, steps: structuredClone(plan), requestedAt: new Date().toISOString(), digest: crypto.createHash('sha256').update(JSON.stringify({ app: app.name, targets: app.targets, build: app.build, branch, commit, plan })).digest('hex') };
}

function projectTemplates() { return {
  blank: { 'velocity.json': ({name}) => JSON.stringify({ name, targets: ['web'], entry: 'src/main.cannon' }, null, 2) + '\n', 'src/main.cannon': 'print("Hello from Velocity")\n', 'public/index.html': '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.cannon"></script></body></html>\n' },
  fullstack: { 'velocity.json': ({name}) => JSON.stringify({ name, targets: ['web','server'], entry: 'src/main.cannon', services: { ui: 'sprout', backend: 'cadence', database: 'syncio' } }, null, 2) + '\n', 'src/main.cannon': 'print("Velocity full stack")\n', 'server/main.cannon': 'print("Cadence server")\n' }
}; }
function safeJoin(root, relative) { const target = path.resolve(root, relative); if (!target.startsWith(root + path.sep) && target !== root) throw new Error('path escapes dev-server root'); return target; }
function resolveCommand(plan, extraArgs) { if (plan.target === 'android') return { bin: plan.tool, args: ['assembleDebug', ...extraArgs] }; if (plan.target === 'ios') return { bin: plan.tool, args: ['-configuration', 'Debug', 'build', ...extraArgs] }; if (plan.target === 'desktop') return { bin: plan.tool, args: ['build', ...extraArgs] }; return { bin: plan.tool, args: extraArgs }; }
