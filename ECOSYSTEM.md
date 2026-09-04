# Velocity ecosystem role

Velocity is the universal Cannon application platform and developer-workflow layer: the ecosystem's answer to the responsibility served by Expo-style universal application tooling, without making cloud services mandatory.

## Intent

Velocity owns project creation, templates, dev server, file watching/hot reload, asset handling, environment/config integration, web/mobile/desktop target orchestration, device connections, previews, local builds, native-module integration and local developer workflow.

## Relationships

- Cannon/Cannon+ provide application code.
- Scout can provide structured project/configuration files.
- Nova provides compilation and diagnostics.
- Parallel provides runtime execution.
- Sprout provides the UI layer.
- Cadence provides full-stack/backend integration.
- Plasma provides plugin/native-module boundaries.
- Chronos is Velocity's remote-build/release/deployment handoff.
- Cortex provides the integrated IDE experience around the workflow.

## Velocity vs Chronos

Velocity answers: how do I create, run, preview and develop this application locally and across targets?

Chronos answers: how do I reproducibly build, sign, store, preview, release, deploy, update and roll back this application through managed or private infrastructure?

Velocity stays useful without Chronos. Chronos can monetize remote infrastructure without owning the local development experience.
