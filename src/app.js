import { ProjectGraph } from './velocity.js';

const VALID_TARGETS = new Set(['web', 'server', 'cli', 'desktop', 'mobile', 'worker']);

export function defineApp(config = {}) {
  if (!config.name || typeof config.name !== 'string') throw new TypeError('Velocity app requires a name');
  const targets = [...new Set(config.targets ?? ['web'])];
  for (const target of targets) {
    if (!VALID_TARGETS.has(target)) throw new Error(`unsupported Velocity target: ${target}`);
  }

  const app = {
    name: config.name,
    entry: config.entry ?? 'src/main.cannon',
    targets,
    environment: { ...(config.environment ?? {}) },
    services: {
      ui: config.services?.ui ?? (targets.includes('web') ? 'sprout' : null),
      backend: config.services?.backend ?? (targets.some((target) => ['server', 'worker'].includes(target)) ? 'cadence' : null),
      database: config.services?.database ?? null,
      deploy: config.services?.deploy ?? 'chronos'
    },
    build: {
      mode: config.build?.mode ?? 'release',
      outDir: config.build?.outDir ?? 'dist',
      sourceMaps: config.build?.sourceMaps ?? true,
      optimize: config.build?.optimize ?? true
    }
  };

  return Object.freeze(app);
}

export function createBuildGraph(app) {
  const graph = new ProjectGraph();
  graph.add('source', { command: { tool: 'nova', action: 'analyze', entry: app.entry } });
  graph.add('compile', { deps: ['source'], command: { tool: 'nova', action: 'compile', mode: app.build.mode } });

  if (app.services.ui) {
    graph.add('ui', { deps: ['compile'], command: { tool: app.services.ui, action: 'bundle' } });
  }
  if (app.services.backend) {
    graph.add('backend', { deps: ['compile'], command: { tool: app.services.backend, action: 'package' } });
  }
  if (app.services.database) {
    graph.add('database', { deps: ['source'], command: { tool: app.services.database, action: 'schema' } });
  }

  const artifactDeps = ['compile'];
  if (graph.nodes.has('ui')) artifactDeps.push('ui');
  if (graph.nodes.has('backend')) artifactDeps.push('backend');
  if (graph.nodes.has('database')) artifactDeps.push('database');

  graph.add('artifact', {
    deps: artifactDeps,
    command: {
      tool: 'velocity',
      action: 'assemble',
      targets: app.targets,
      outDir: app.build.outDir,
      sourceMaps: app.build.sourceMaps,
      optimize: app.build.optimize
    }
  });

  graph.add('deploy', {
    deps: ['artifact'],
    command: { tool: app.services.deploy, action: 'deploy', targets: app.targets }
  });

  return graph;
}

export function createBuildPlan(app, { deploy = false } = {}) {
  const graph = createBuildGraph(app);
  return graph.plan([deploy ? 'deploy' : 'artifact']).map((node, index) => ({
    id: `${String(index + 1).padStart(2, '0')}-${node.name}`,
    name: node.name,
    dependencies: [...node.deps],
    command: structuredClone(node.command)
  }));
}

export function validateApp(app) {
  const errors = [];
  if (!app?.name) errors.push('missing app name');
  if (!app?.entry) errors.push('missing app entry');
  if (!Array.isArray(app?.targets) || app.targets.length === 0) errors.push('at least one target is required');
  if (app?.targets) {
    for (const target of app.targets) if (!VALID_TARGETS.has(target)) errors.push(`unsupported target: ${target}`);
  }
  return { valid: errors.length === 0, errors };
}
