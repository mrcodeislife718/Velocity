import test from 'node:test';
import assert from 'node:assert/strict';
import { defineApp, createBuildPlan } from '../src/app.js';

test('Velocity app definitions remain immutable after creation', () => {
  const app = defineApp({
    name: 'proof',
    targets: ['web', 'server'],
    environment: { API_URL: 'https://example.invalid' },
    services: { database: 'syncio' },
    build: { outDir: 'build', optimize: false }
  });
  const before = createBuildPlan(app);

  assert.equal(Object.isFrozen(app), true);
  assert.equal(Object.isFrozen(app.targets), true);
  assert.equal(Object.isFrozen(app.environment), true);
  assert.equal(Object.isFrozen(app.services), true);
  assert.equal(Object.isFrozen(app.build), true);

  assert.throws(() => app.targets.push('desktop'), TypeError);
  assert.throws(() => { app.environment.API_URL = 'https://mutated.invalid'; }, TypeError);
  assert.throws(() => { app.services.database = null; }, TypeError);
  assert.throws(() => { app.build.outDir = 'other'; }, TypeError);

  assert.deepEqual(createBuildPlan(app), before);
});
