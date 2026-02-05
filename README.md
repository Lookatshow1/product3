# CallFlow OS

**Операционная система контроля обращений для клиник и стоматологий.**

Каждый день показывает руководителю, сколько денег утекло через пропущенные звонки, слабые скрипты и сорванные записи — и выдаёт конкретный план, как эти деньги вернуть.

---

## Структура репозитория

```
docs/
├── 00-product-alternatives.md   # 3 альтернативы + обоснование выбора
├── 01-prd.md                    # PRD: позиционирование, JTBD, user stories, модули A-I, NFR
├── 02-ux-screens.md             # Карта экранов (9 экранов), wireframes, состояния
├── 03-formulas-and-data.md      # Формулы потерь, коэффициенты, детектор аномалий
├── 04-technical-architecture.md # Стек, архитектура, БД-схема, API, транскрипция
├── 05-development-plan.md       # План MVP (5 нед.) + V1 (11 нед.) + бэклог
├── 06-definition-of-done.md     # 8 критериев приёмки + технический чеклист
├── 07-market-packaging.md       # Лендинг, онбординг, демо, прайсинг, 10 тезисов продаж
├── 08-compliance-checklist.md   # ПДн, обезличивание, удаление, аудит, чеклист запуска
└── 09-one-pager-sprint.md       # Спринт-план на 2 недели (102ч, 2 разработчика)

schema/
├── 001-init.sql                 # Полная DDL-схема PostgreSQL (20+ таблиц, индексы, RLS)
└── 002-seed-demo.sql            # Демо-данные (30 дней, 3 оператора, уроки, скрипты)

templates/
├── journal-template.csv         # Шаблон журнала обращений (20 строк-примеров)
├── funnel-template.csv          # Шаблон воронки дня (5 дней)
└── README-templates.md          # Инструкции по выгрузке из АТС

api-spec/
└── openapi-summary.yaml         # Сводная спецификация API (35+ эндпойнтов)
```

## Быстрый старт разработки

1. Изучить: `docs/09-one-pager-sprint.md` — план на первые 2 недели
2. Схема БД: `schema/001-init.sql`
3. API контракт: `api-spec/openapi-summary.yaml`
4. Формулы: `docs/03-formulas-and-data.md`
5. Экраны: `docs/02-ux-screens.md`

## Ключевые решения

| Вопрос | Решение |
|--------|---------|
| Стек | Next.js 14 + NestJS + Prisma + PostgreSQL 16 + Redis + BullMQ |
| Деплой | Docker Compose (MVP), K8s (V1) |
| Монорепо | Turborepo: apps/web + apps/api + packages/shared |
| Приватность | По умолчанию "обезличенный", персональный — только с подтверждением |
| Транскрипция | Интерфейс провайдера: Whisper local / OpenAI API / Yandex |
