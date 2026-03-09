# Documentation Index

This folder is the initial product and engineering foundation for `Klava Bot`.

Recommended reading order:
1. [Product Vision](./01_PRODUCT_VISION.md)
2. [PRD and Technical Spec](./02_PRD_TZ.md)
3. [System Architecture](./03_ARCHITECTURE.md)
4. [Security and Privileged Execution](./04_SECURITY_AND_PRIVILEGED_EXECUTION.md)
5. [UX Specification](./05_UX_SPEC.md)
6. [Repository and Modules](./06_REPOSITORY_AND_MODULES.md)
7. [Implementation Plan](./07_IMPLEMENTATION_PLAN.md)
8. [Upstream Sync and Update Strategy](./08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)
9. [Release Ops and QA](./09_RELEASE_OPS_AND_QA.md)
10. [Epics and Backlog](./10_EPICS_AND_BACKLOG.md)
11. [Voice and Multimodal Stack](./11_VOICE_AND_MULTIMODAL_STACK.md)
12. [Cloud Gateway and Update Server](./12_CLOUD_GATEWAY_AND_UPDATE_SERVER.md)
13. [Top 1 Strategy](./13_TOP1_STRATEGY.md)
14. [Implementation Audit](./14_IMPLEMENTATION_AUDIT.md)
15. [Execution Playbook](./15_EXECUTION_PLAYBOOK.md)
16. [Tasklist](../TASKLIST.md)

Document purpose:
- `01`: product identity, target users, strategic principles, success metrics.
- `02`: formal requirements, scope, release tiers, acceptance criteria.
- `03`: target architecture, module boundaries, deployment model, platform strategy.
- `04`: security model, secret handling, approvals, privileged helper, system safety.
- `05`: interaction model and visual direction for the desktop app.
- `06`: proposed monorepo structure, boundaries, ownership rules, engineering conventions.
- `07`: phased roadmap with milestones and delivery gates.
- `08`: how to keep the OpenClaw fork easy to upgrade and how to ship updates to users.
- `09`: CI/CD, release channels, testing, observability, support operations.
- `10`: initial feature epics and backlog slices.
- `11`: voice input/output architecture, pack registry, low-latency audio strategy.
- `12`: one-key cloud access model, model routing, update server, artifact delivery.
- `13`: product differentiators and strategic additions for category leadership.
- `14`: implemented state, current risks, audit notes, and next hardening steps.
- `15`: concrete repository backlog, file-level build order, and AI-friendly execution rules.
- `16`: hard checkbox plan with file creation order, command contract, and definition of done.

Top-level decision:
- `OpenClaw` is the product core and default capability engine.
- `Klava Bot` is a thin modular desktop layer around that core.
- The project should prefer composition, wrappers, and optional modules over fork changes and rewrites.
