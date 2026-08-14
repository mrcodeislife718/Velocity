import test from 'node:test';
import assert from 'node:assert/strict';
import { defineApp, createBuildPlan, validateApp } from '../src/app.js';

test('Velocity builds a deterministic ecosystem plan', () => {
  const app = defineApp({
    name: 'example',
    targets: ['web', 'server'],
    services: { database: 'syncio' }
  });
  const plan = createBuildPlan(app, { deploy: true });
  assert.deepEqual(plan.map((step) => step.name), ['source', 'compile', 'ui', 'backend', 'database', 'artifact', 'deploy']);
  assert.equal(plan.at(-1).command.tool, 'chronos');
});

test('Velocity rejects unsupported targets', () => {
  assert.throws(() => defineApp({ name: 'bad', targets: ['mainframe'] }), /unsupported Velocity target/);
});

test('Velocity validates app contracts', () => {
  const app = defineApp({ name: 'ok', targets: ['cli'] });
  assert.deepEqual(validateApp(app), { valid: true, errors: [] });
});
