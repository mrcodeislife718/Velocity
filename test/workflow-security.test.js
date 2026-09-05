import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DevServer, executeTargetPlan, PreviewProtocol, chronosHandoff } from '../src/index.js';

async function projectFixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-workflow-'));
  const root = path.join(base, 'project');
  const outside = path.join(base, 'outside');
  await fs.mkdir(root); await fs.mkdir(outside);
  await fs.writeFile(path.join(root, 'index.html'), '<h1>inside</h1>');
  await fs.writeFile(path.join(outside, 'secret.txt'), 'secret');
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  return { root, outside };
}

test('dev server refuses symlink escapes outside the project root', async (t) => {
  const { root, outside } = await projectFixture(t);
  await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'escape.txt'));
  const server = new DevServer({ root, exposeErrors: false });
  t.after(() => server.close());
  const address = await server.start();
  const ok = await fetch(`${address.url}/index.html`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '<h1>inside</h1>');
  const escaped = await fetch(`${address.url}/escape.txt`);
  assert.equal(escaped.status, 403);
  assert.equal(await escaped.text(), 'forbidden');
});

test('target execution enforces a deadline on real child processes', async () => {
  await assert.rejects(() => executeTargetPlan({ target: 'test', tool: process.execPath }, { args: ['-e', 'setTimeout(()=>{},10000)'], timeoutMs: 40 }), /timed out/);
});

test('target execution enforces output ceilings', async () => {
  await assert.rejects(() => executeTargetPlan({ target: 'test', tool: process.execPath }, { args: ['-e', 'process.stdout.write("x".repeat(4096))'], maxOutputBytes: 128 }), /stdout exceeded/);
});

test('target execution can be aborted by the caller', async () => {
  const controller = new AbortController();
  const pending = executeTargetPlan({ target: 'test', tool: process.execPath }, { args: ['-e', 'setTimeout(()=>{},10000)'], timeoutMs: 5000, signal: controller.signal });
  controller.abort(new Error('cancelled target'));
  await assert.rejects(() => pending, /cancelled target/);
});

test('preview pairing tokens reject tampering and expiry', () => {
  const secret = Buffer.alloc(32, 7);
  const protocol = new PreviewProtocol({ secret });
  const token = protocol.createPairing({ project: 'demo', expiresInMs: 10_000 });
  assert.equal(protocol.pair(token, { id: 'device-1' }).project, 'demo');
  assert.throws(() => protocol.pair(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), { id: 'device-2' }), /invalid preview pairing token/);
  const [encoded] = protocol.createPairing({ project: 'demo', expiresInMs: 10_000 }).split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  payload.expiresAt = Date.now() - 1;
  const changed = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const resigned = crypto.createHmac('sha256', secret).update(changed).digest('base64url');
  assert.throws(() => protocol.pair(`${changed}.${resigned}`, { id: 'device-3' }), /expired/);
});

test('Chronos handoff digest is deterministic across object key insertion order', () => {
  const appA = { name: 'demo', targets: ['web'], build: { z: 1, a: 2 } };
  const appB = { name: 'demo', targets: ['web'], build: { a: 2, z: 1 } };
  const first = chronosHandoff(appA, [{ task: 'build', config: { b: 2, a: 1 } }], { branch: 'main', commit: 'abc' });
  const second = chronosHandoff(appB, [{ config: { a: 1, b: 2 }, task: 'build' }], { branch: 'main', commit: 'abc' });
  assert.equal(first.digest, second.digest);
});
