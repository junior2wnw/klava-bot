# Klava

`Klava` — это OpenClaw-derived desktop agent, который поставляется как один запускаемый Windows `.exe`.

[![Release](https://img.shields.io/github/v/release/junior2wnw/klava-bot?display_name=tag&sort=semver)](https://github.com/junior2wnw/klava-bot/releases/latest)
[![License](https://img.shields.io/github/license/junior2wnw/klava-bot)](./LICENSE)
[![Issues](https://img.shields.io/github/issues/junior2wnw/klava-bot)](https://github.com/junior2wnw/klava-bot/issues)
[![Discussions](https://img.shields.io/github/discussions/junior2wnw/klava-bot)](https://github.com/junior2wnw/klava-bot/discussions)

Languages: [English](./README.md) | **Русский**

Он объединяет local-first runtime, безопасную работу с секретами, typed approvals и современную desktop-оболочку, чтобы человек мог перейти от "помоги мне с задачей" к "проверь, измени, почини или перенастрой этот компьютер" в одном продукте.

Главная ставка простая:

> один исполняемый файл, один лог задач, одна модель approvals, один агент, который может реально работать с компьютером перед тобой.

Этот репозиторий опубликован как самостоятельный продуктовый repo, но lineage к upstream указан явно:

- Upstream project: [`OpenClaw`](https://github.com/openclaw/openclaw)
- Upstream boundary в репозитории: [forks/openclaw/README.md](./forks/openclaw/README.md)
- Пояснение по форку и публикации: [UPSTREAM.md](./UPSTREAM.md)
- Документ по открытому проекту и lineage: [docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md](./docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md)
- Публичная landing page: [junior2wnw.github.io/klava-bot](https://junior2wnw.github.io/klava-bot/)
- Русская landing page: [junior2wnw.github.io/klava-bot/ru/](https://junior2wnw.github.io/klava-bot/ru/)

## Зачем нужен Klava

Большинство агентов останавливаются на советах, shell snippets или браузерной автоматизации.

`Klava` задуман для полного desktop loop:

- понять задачу;
- изучить локальную машину и состояние проекта;
- запросить approval перед рискованными действиями;
- выполнять typed workflows вместо свободного privileged текста;
- оставлять audit trail;
- сохранять recovery hints и support bundles.

Итоговая форма должна ощущаться не как "LLM, прикрученная к терминалу", а как связный desktop operator, которому можно доверить серьёзную локальную работу.

## Что уже реально работает

В текущем состоянии репозитория уже есть:

- Electron + React desktop shell;
- local runtime manager с typed HTTP API;
- безопасное локальное хранение секретов через Windows DPAPI-backed wrapping;
- onboarding для GONKA mainnet, валидация, balance checks и выбор сильнейшей модели;
- task system с transcript history и export support bundle;
- guarded terminal с approval modes;
- portable Windows `.exe` через Electron Builder.

Текущий command UX:

- `new task`
- `/terminal <command>`
- `$ <command>`
- `guard strict`
- `guard balanced`
- `guard off`

Текущее natural-language поведение:

- обычный chat использует GONKA mainnet completion после onboarding;
- guarded commands по-прежнему проходят через approval model;
- terminal results пишутся обратно в task transcript и terminal history.

Текущая заметка по provider status:

- onboarding, валидация, balance checks и model discovery для GONKA в текущем состоянии репозитория работают;
- публичный GONKA-backed chat path сейчас заблокирован provider-side transfer-agent panic, который отслеживается в [`gonka-ai/gonka#876`](https://github.com/gonka-ai/gonka/issues/876);
- после исправления этой provider-side проблемы на стороне Gonka документированный signed `chat/completions` path в Klava должен снова заработать без смены клиентской архитектуры.

## На что рассчитана архитектура

Не каждый workflow ниже уже полностью shipped. Часть уже реализована, часть является запланированной поверхностью для privileged helper, cloud modules и typed workflow packs, описанных в docs.

Но именно в этом и идея `Klava`: все такие кейсы должны жить в одном продукте:

- проверить сломанную workstation, подготовить restore point, переустановить GPU, audio или network driver, провалидировать состояние устройства и объяснить, что изменилось;
- заменить BaaS в локальном проекте, переписать env/config, обновить adapters, прогнать smoke checks и оставить diff summary;
- переключить проект с одного inference provider на другой, обновить local runtime settings, проверить новый путь и откатиться при необходимости;
- поднять новую developer machine из одного executable: установить toolchains, клонировать repo, настроить environment, проверить services и оставить машину в рабочем состоянии;
- починить локальное dev-окружение через проверку `PATH`, shell profiles, startup tasks, Docker/WSL state и service health;
- вынести локальные secrets из `.env` в vault-backed setup без утечки значений в transcript или logs;
- сбросить network adapters, перенастроить firewall rules через approved typed flows и проверить connectivity;
- собрать logs, crash state, config snapshots и system metadata в support bundle, которым реально сможет пользоваться другой инженер;
- показать, что именно изменилось на машине, кто это approved, какая версия helper/runtime это выполнила и какой rollback path доступен.

Это и есть целевой дизайн: не chat toy и не prompt wrapper, а серьёзный local operator.

## Модель безопасности

Klava специально строится вокруг жёстких правил:

- `Local-first`: основной desktop loop должен работать без обязательного remote SaaS control plane.
- `Secrets outside transcript`: ключи должны жить во vault, а не в chat history.
- `Typed approvals`: опасные действия требуют явного review с impact и rollback context.
- `Typed privileged helper`: модель не должна получать общий канал "run anything as admin".
- `Auditability`: важные действия должны оставлять структурированные следы.

Если Klava будет заниматься driver repair, backend replacement или system recovery, это должно происходить через typed workflows, а не через prompt improvisation.

## OpenClaw lineage

Klava — это сильно модифицированный OpenClaw-derived project.

Что сохраняется близко к upstream:

- runtime-first architecture;
- приоритет composition вместо rewrite;
- минимальная fork surface, где это возможно;
- модульные capability seams вместо гигантских монолитных features.

Что является явно klava-specific:

- desktop shell и UX;
- onboarding, approvals и diagnostics;
- packaging и release ergonomics;
- local vault integration;
- продуктовые modules и surface registry;
- более строгая security-модель вокруг privileged execution.

Если GitHub не показывает native fork badge, lineage всё равно явно зафиксирован через [`UPSTREAM.md`](./UPSTREAM.md) и [`forks/openclaw/README.md`](./forks/openclaw/README.md).

## Структура репозитория

- [`apps/desktop`](./apps/desktop) - Electron shell и UI composition
- [`packages/runtime`](./packages/runtime) - local runtime API и provider integrations
- [`packages/ui`](./packages/ui) - reusable UI components
- [`packages/contracts`](./packages/contracts) - shared contracts и types
- [`docs`](./docs) - product, architecture, security и execution docs
- [`forks/openclaw`](./forks/openclaw) - явная upstream boundary

## Документация

Рекомендуемый порядок чтения:

1. [Documentation Index](./docs/00_INDEX.md)
2. [Security and Privileged Execution](./docs/04_SECURITY_AND_PRIVILEGED_EXECUTION.md)
3. [Upstream Sync and Update Strategy](./docs/08_UPSTREAM_SYNC_AND_UPDATE_STRATEGY.md)
4. [Implementation Audit](./docs/14_IMPLEMENTATION_AUDIT.md)
5. [Execution Playbook](./docs/15_EXECUTION_PLAYBOOK.md)
6. [Open Source and Fork Lineage](./docs/16_OPEN_SOURCE_AND_FORK_LINEAGE.md)
7. [Roadmap](./ROADMAP.md)
8. [Governance](./GOVERNANCE.md)
9. [Support](./SUPPORT.md)

## Быстрый старт

### Для разработчиков

Требования:

- `Node.js 24+`

Запуск:

```bash
npm install
npm run dev
```

Что поднимется:

- Vite renderer на `http://127.0.0.1:5173`
- Electron desktop shell
- local runtime API на `http://127.0.0.1:4120`, который стартует из desktop process

Сборка:

```bash
npm run build
```

Portable Windows executable:

```bash
npm run dist:win
```

### Для пользователей

Большинству людей dev stack не нужен.

Klava должен потребляться как один portable executable:

- `apps/desktop/release/Klava 0.1.0.exe`

Первое использование:

1. Запусти `Klava`.
2. Подключи provider secret через secure onboarding flow.
3. Дай приложению провалидировать и закэшировать provider state.
4. Начни работать через tasks, chat и approvals.

## Что уже проверено

- `npm run check`
- `npm run build`
- `npm run dist:win`
- runtime smoke test для `guarded -> approval -> reject`
- runtime smoke test для task creation и guarded terminal approval generation
- runtime smoke test для support bundle export без утечки секретов
- runtime smoke test для GONKA onboarding rejection на account-not-found phrase
- packaged `Klava 0.1.0.exe` startup smoke test без main-process crash

## Open source

Klava задуман как серьёзный публичный проект, а не просто code dump.

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Roadmap: [ROADMAP.md](./ROADMAP.md)
- Governance: [GOVERNANCE.md](./GOVERNANCE.md)
- Support: [SUPPORT.md](./SUPPORT.md)
- Manifesto: [MANIFESTO.md](./MANIFESTO.md)
- Launch post kit: [LAUNCH_POST.md](./LAUNCH_POST.md)

Если хочешь помочь, самые ценные вкладки — те, которые делают систему понятнее, безопаснее и более composable.
