import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeTargetPlan } from '../src/workflow.js';

async function pidFrom(pathname) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { return Number(await fs.readFile(pathname, 'utf8')); } catch { await new Promise((resolve) => setTimeout(resolve, 5)); }
  }
  throw new Error('child pid file was not created');
}

test('Velocity timeout rejects only after the target process is reaped', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-reap-'));
  const pidFile = path.join(root, 'pid');
  const script = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{},1000);`;
  try {
    const execution = executeTargetPlan({ target:'web', tool:process.execPath }, {
      cwd:root,
      args:['-e', script],
      timeoutMs:40
    });
    const pid = await pidFrom(pidFile);
    await assert.rejects(execution, /timed out after 40ms/);
    assert.throws(() => process.kill(pid, 0), (error) => error?.code === 'ESRCH');
  } finally { await fs.rm(root, { recursive:true, force:true }); }
});

test('Velocity abort rejects only after the target process closes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-abort-reap-'));
  const pidFile = path.join(root, 'pid');
  const script = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{},1000);`;
  const controller = new AbortController();
  try {
    const execution = executeTargetPlan({ target:'web', tool:process.execPath }, {
      cwd:root,
      args:['-e', script],
      signal:controller.signal,
      timeoutMs:2000
    });
    const pid = await pidFrom(pidFile);
    controller.abort(new Error('cancel build'));
    await assert.rejects(execution, /cancel build/);
    assert.throws(() => process.kill(pid, 0), (error) => error?.code === 'ESRCH');
  } finally { await fs.rm(root, { recursive:true, force:true }); }
});
