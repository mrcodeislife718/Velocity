import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scaffold, DevServer, PreviewProtocol, targetPlan, createNativeModuleManifest, chronosHandoff, defineApp, createBuildPlan } from '../src/index.js';

test('Velocity scaffolds real project files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-'));
  const result = await scaffold(root, 'blank', { name: 'demo' });
  assert.ok(result.files.includes('velocity.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'velocity.json'), 'utf8'));
  assert.equal(manifest.name, 'demo');
});

test('dev server serves files and exposes hot-reload manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-dev-'));
  await fs.writeFile(path.join(root, 'index.html'), '<h1>ok</h1>');
  const dev = new DevServer({ root });
  const address = await dev.start();
  const response = await fetch(`${address.url}/index.html`);
  assert.equal(await response.text(), '<h1>ok</h1>');
  const manifest = await (await fetch(`${address.url}/__velocity/manifest`)).json();
  assert.equal(manifest.version, 0);
  dev.invalidate('index.html');
  assert.equal(dev.version, 1);
  await dev.close();
});

test('preview pairing tokens reject tampering and register devices', () => {
  const protocol = new PreviewProtocol({ secret: Buffer.alloc(32, 7) });
  const token = protocol.createPairing({ project: 'demo' });
  const device = protocol.pair(token, { id: 'phone-1', platform: 'android' });
  assert.equal(device.project, 'demo');
  assert.throws(() => protocol.pair(token + 'x', { id: 'bad' }), /invalid preview/);
});

test('target orchestration, Plasma module manifests, and Chronos handoff are deterministic', () => {
  assert.equal(targetPlan('android').artifact, 'apk/aab');
  const module = createNativeModuleManifest({ name: 'camera', library: 'camera-native', functions: [{ name: 'capture' }] });
  assert.equal(module.protocol, 'velocity-plasma/1');
  const app = defineApp({ name: 'demo', targets: ['web','server'] });
  const plan = createBuildPlan(app, { deploy: true });
  const handoff = chronosHandoff(app, plan, { commit: 'abc123' });
  assert.equal(handoff.protocol, 'velocity-chronos/1');
  assert.equal(handoff.commit, 'abc123');
  assert.equal(handoff.digest.length, 64);
});
