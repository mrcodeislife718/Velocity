# Velocity Vision

## Product identity

Velocity is the universal Cannon application platform and developer-workflow layer.

Its mission is to make creating, running, previewing, hot-reloading, targeting, and locally building Cannon applications across web, mobile, and desktop dramatically easier without making the cloud mandatory.

## Primary comparison set

Velocity is our answer to lessons drawn primarily from:

- Expo
- modern universal application-development tooling

Velocity should preserve Expo-class ease of getting from project creation to a running application and extend that experience across the Cannon stack while avoiding cloud-only assumptions and unnecessary friction when developers need native/platform access.

## Strengths to preserve

- Project creation and templates.
- Dev server and file watching.
- Fast hot reload.
- Asset handling.
- Environment/config integration.
- Web/mobile/desktop target orchestration.
- Device connections and previews.
- Local builds.
- Native-module/plugin integration through Plasma.
- Smooth composition of Sprout UI and Cadence backend workflows.

## Weaknesses to eliminate

- mandatory cloud dependency for ordinary development;
- delayed or awkward access to native/platform capabilities;
- platform-specific workflow fragmentation;
- local/remote behavior divergence that surprises developers;
- project tooling that becomes an accidental owner of compiler, runtime, framework, or deployment semantics.

## Independent ceiling

Velocity should become a complete, excellent universal application-development platform in its own right. It is not merely the handoff layer to Chronos and not merely a task graph beneath Cortex.

## Ecosystem role

Scout can represent structured project configuration. Nova supplies compiler/build intelligence. Parallel supplies runtime execution. Sprout and Cadence provide application frameworks. Plasma provides native/foreign modules. Chronos handles remote production build/release/deployment. Cortex integrates the experience.

## Velocity vs Chronos

**Velocity answers:** How do I create, develop, run, preview, hot-reload, target, connect devices to, and locally build this application?

**Chronos answers:** How do I reproducibly build, sign, store, release, deploy, update, and roll back the product through managed or private infrastructure?

Velocity must remain useful without Chronos.

## Architectural invariant

**Do not redefine Velocity as a generic package manager, remote build cloud, compiler, runtime, or deployment system. Dependency/workspace/build capabilities belong in Velocity only where they directly serve its original universal application-development mission.**
