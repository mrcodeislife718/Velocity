# Velocity Roadmap

Velocity is the universal Cannon application platform and developer workflow layer.

## Product contract

Velocity owns project creation, dev server, hot reload, asset handling, environment/config integration, web/mobile/desktop target orchestration, device connections, previews, local builds, native-module integration, and project templates.

## Design sources

Velocity takes Expo's frictionless local development and device workflow plus modern universal app tooling, while avoiding cloud-only assumptions, native escape-hatch friction, and delayed access to platform capabilities.

## Implementation order

1. `cannon create`/Velocity project templates.
2. Dev server and file watching.
3. Sprout web target.
4. Cadence full-stack development integration.
5. Local device preview protocol.
6. Android/iOS target orchestration.
7. Desktop target.
8. Plugin/native-module contract through Plasma.
9. Chronos remote-build handoff.

## Proof gates

A target is supported only after a generated project builds and launches on that target. Hot reload requires end-to-end change propagation tests. Native modules require real device/platform tests.

## Commercial boundary

Local Velocity tooling stays free. Revenue can come from hosted previews, remote device testing, team collaboration, premium templates, analytics, and Chronos cloud integration.
