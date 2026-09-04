# Velocity

Velocity is the universal Cannon application platform and developer-workflow layer.

It is the Cannon ecosystem's answer to Expo-style universal application tooling: project creation, templates, dev server, file watching/hot reload, asset handling, environment/config integration, web/mobile/desktop target orchestration, device connections, previews, local builds, and native-module integration.

## Role in the ecosystem

```text
Cannon / Cannon+ ──► Nova ──► Parallel
        │                         │
        │                      Cadence
        │                         │
        └──────► Sprout ──────────┤
                                  ▼
                               Velocity
                                  │
                    local dev     │     remote build/release
                                  ▼
                               Chronos
```

Scout can provide structured project/configuration files. Plasma supplies native/plugin boundaries. Cortex wraps the workflow in the integrated IDE experience.

## Velocity vs Chronos

**Velocity** answers: how do I create, run, preview, hot-reload, and develop this application locally and across web/mobile/desktop targets?

**Chronos** answers: how do I reproducibly build, sign, store, release, deploy, update, and roll back the application through managed or private infrastructure?

Velocity must remain useful without Chronos; local development should not require cloud lock-in.

## Current implementation

Canonical `main` contains the project-graph implementation from the earlier `implementation/runtime-v1` branch plus newer application, platform-project, and workflow infrastructure. The branch work is therefore preserved semantically in main rather than copied backward over newer code.

## Proof standard

A target is supported only after a generated project builds and launches on that target. Hot reload requires end-to-end change propagation tests. Native modules require real platform/device tests.

## Commercial boundary

Local tooling stays adoption infrastructure. Revenue can come from hosted previews, remote device testing, team collaboration, premium templates, analytics, and Chronos cloud integration.

See [ECOSYSTEM.md](./ECOSYSTEM.md) and [ROADMAP.md](./ROADMAP.md).
