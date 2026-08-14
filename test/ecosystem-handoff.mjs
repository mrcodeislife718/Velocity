import fs from 'node:fs/promises';
import path from 'node:path';
import { AdapterRegistry, createJavaScriptAdapter } from '../Plasma/src/index.js';
import { createArtifact } from '../Chronos/src/index.js';
import { SigningVault, createSignedBuild, canonicalSigningPayload } from '../Chronos/src/cloud.js';

const output = process.argv[2] ?? '.proof/ecosystem-handoff.json';
const registry = new AdapterRegistry();
registry.register('javascript', createJavaScriptAdapter({
  velocityUpdate: {
    transform(message, token) {
      return { message: `Plasma:${message}`, pairingToken: token };
    },
  },
}));

const token = `pair-${Date.now()}`;
const result = await registry.invoke('javascript', {
  module: 'velocityUpdate',
  member: 'transform',
  args: ['Hot Reload Ready', token],
});
if (!result.ok) throw new Error(result.error?.message ?? 'Plasma handoff failed');

const artifact = createArtifact({
  app: 'velocity-proof',
  version: '1.0.1',
  target: 'android',
  files: [{ path: 'reload.json', content: JSON.stringify(result.value) }],
  metadata: { source: 'velocity-platform-proof', plasmaAdapter: result.adapter },
});
const vault = new SigningVault();
vault.create('velocity-proof');
const signed = createSignedBuild({ artifact, keyName: 'velocity-proof', vault, platform: 'android' });
const canonical = canonicalSigningPayload(signed);
if (!vault.verify('velocity-proof', canonical, signed.signature)) throw new Error('Chronos signature verification failed');

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ ...result.value, artifactDigest: artifact.digest, signature: signed.signature, verified: true }, null, 2));
console.log(output);
