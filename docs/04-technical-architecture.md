# CallFlow OS — Техническая архитектура

## 1. Стек технологий

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR для SEO лендинга, RSC для дашбордов, единый стек |
| UI Kit | Tailwind CSS + shadcn/ui | Быстрая разработка, консистентный дизайн |
| Графики | Recharts | Легковесный, React-native, достаточный для наших дашбордов |
| State | Zustand + React Query (TanStack) | Zustand для UI state, React Query для серверного кэша |
| Backend API | Node.js + NestJS + TypeScript | Типизация, DI, модульность, совпадает с фронтом по языку |
| ORM | Prisma | Type-safe, отличные миграции, поддержка Postgres |
| БД | PostgreSQL 16 | RLS, JSONB, отличная аналитика, зрелая экосистема |
| Очередь задач | BullMQ (Redis) | Надёжный, retry, cron-jobs, dashboard |
| Кэш | Redis 7 | Сессии, кэш дашборда, rate limiting |
| Объектное хранилище | S3-совместимое (MinIO / AWS S3) | Аудиофайлы, сгенерированные PDF |
| Email | Resend (или Nodemailer + SMTP) | Transactional emails, простой API |
| PDF генерация | Puppeteer (headless Chrome) | HTML→PDF, полный контроль над стилями |
| Транскрипция | Интерфейс провайдера (см. ниже) | Сменный: Whisper local / OpenAI API / Yandex |
| Парсинг CSV/Excel | Papa Parse (CSV) + xlsx (Excel) | Клиентская валидация + серверный парсинг |
| Аутентификация | NextAuth.js v5 | Email+password, invite flow, sessions |
| Web Push | web-push (VAPID) | Стандартные push-уведомления |
| Мониторинг | Sentry (errors) + PostHog (analytics) | Ошибки + продуктовая аналитика |
| Деплой | Docker + Docker Compose (MVP), K8s (V1) | Простота для MVP, масштабируемость для V1 |
| CI/CD | GitHub Actions | Стандартный, достаточный |

---

## 2. Архитектурная диаграмма

```
┌─────────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТ (Браузер)                            │
│  Next.js App (React) ← SSR / RSC                                   │
│  ├── Dashboard pages                                                │
│  ├── CSV parser (client-side preview)                               │
│  └── Service Worker (web push)                                      │
└─────────────┬───────────────────────────────────────────────────────┘
              │ HTTPS (TLS 1.3)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS SERVER (API Routes + SSR)              │
│  ├── /api/auth/* (NextAuth)                                         │
│  ├── /api/v1/* (REST API — NestJS mounted)                         │
│  └── SSR pages (dashboard, reports)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                          NestJS API                                  │
│  ├── AuthModule (JWT, sessions, roles)                              │
│  ├── ImportModule (CSV/Excel parsing, validation)                   │
│  ├── AnalyticsModule (loss calculations, forecasts)                 │
│  ├── TaskModule (daily tasks CRUD, generation)                      │
│  ├── OperatorModule (KPI, anomaly detection)                        │
│  ├── CoachModule (lessons, scripts, progress)                       │
│  ├── ReportModule (PDF/HTML generation)                             │
│  ├── NotificationModule (email, push, in-app)                       │
│  ├── TranscriptionModule (audio upload, provider interface)         │
│  ├── ClinicModule (settings, benchmarks)                            │
│  └── AdminModule (users, roles, billing)                            │
└──────────┬──────────────┬─────────────────┬─────────────────────────┘
           │              │                 │
           ▼              ▼                 ▼
┌────────────────┐ ┌─────────────┐ ┌──────────────────┐
│  PostgreSQL 16 │ │  Redis 7    │ │  S3 / MinIO      │
│  ├── RLS       │ │  ├── BullMQ │ │  ├── audio/      │
│  ├── Tables    │ │  ├── Cache  │ │  ├── reports/    │
│  └── Indexes   │ │  └── Sessions│ │  └── imports/   │
└────────────────┘ └──────┬──────┘ └──────────────────┘
                          │
                   ┌──────▼──────┐
                   │  BullMQ     │
                   │  Workers    │
                   │  ├── ImportWorker (parse, validate, store)
                   │  ├── AnalyticsWorker (recalculate losses)
                   │  ├── TaskGeneratorWorker (daily tasks)
                   │  ├── NotificationWorker (email, push)
                   │  ├── ReportWorker (PDF generation)
                   │  ├── AnomalyWorker (detect anomalies)
                   │  └── TranscriptionWorker (audio → text)
                   └─────────────┘
```

---

## 3. Схема БД

### 3.1 Таблицы

```sql
-- ========================================
-- ОРГАНИЗАЦИИ И ПОЛЬЗОВАТЕЛИ
-- ========================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    billing_plan VARCHAR(50) DEFAULT 'starter',  -- starter | pro | enterprise
    billing_status VARCHAR(20) DEFAULT 'trial',   -- trial | active | past_due | cancelled
    trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days'
);

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'dental',  -- dental | cosmetology | multi | ent | ophthalmology | other
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Moscow',
    chairs_count INTEGER DEFAULT 3,
    avg_check DECIMAL(10,2) DEFAULT 5000.00,
    working_hours_start TIME DEFAULT '09:00',
    working_hours_end TIME DEFAULT '21:00',
    logo_url VARCHAR(500),
    privacy_mode VARCHAR(20) DEFAULT 'anonymous',  -- anonymous | personal
    personal_data_consent_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,  -- NULL = все филиалы
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'manager',  -- owner | manager | supervisor | operator
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    totp_secret VARCHAR(255),  -- для 2FA
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- КОЭФФИЦИЕНТЫ И НАСТРОЙКИ
-- ========================================

CREATE TABLE clinic_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
    answer_rate_target DECIMAL(4,3) DEFAULT 0.900,
    booking_rate_target DECIMAL(4,3) DEFAULT 0.550,
    show_rate_target DECIMAL(4,3) DEFAULT 0.850,
    callback_success_rate DECIMAL(4,3) DEFAULT 0.600,
    booking_rate_callback DECIMAL(4,3) DEFAULT 0.350,
    avg_margin DECIMAL(4,3) DEFAULT 0.600,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- ОПЕРАТОРЫ
-- ========================================

CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    external_id VARCHAR(255),  -- ID из АТС/CRM, опционально
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operators_clinic ON operators(clinic_id);

-- ========================================
-- ИМПОРТ ДАННЫХ
-- ========================================

CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL,  -- journal | funnel | audio
    filename VARCHAR(500),
    file_url VARCHAR(500),       -- S3 URL оригинала
    status VARCHAR(20) DEFAULT 'processing',  -- processing | completed | failed | partial
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',   -- [{row: 5, field: "date_time", error: "invalid format"}]
    column_mapping JSONB,        -- {source_col: target_field, ...}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_imports_clinic ON imports(clinic_id, created_at DESC);

-- ========================================
-- ЗАПИСИ ОБРАЩЕНИЙ (детальные)
-- ========================================

CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
    date_time TIMESTAMPTZ NOT NULL,
    date DATE GENERATED ALWAYS AS (date_time::date) STORED,  -- для быстрых агрегатов
    channel VARCHAR(20) NOT NULL DEFAULT 'phone_in',
        -- phone_in | phone_out | web_form | whatsapp | callback | walk_in | other
    status VARCHAR(20) NOT NULL DEFAULT 'answered',
        -- answered | missed | callback_done | callback_failed | voicemail
    duration_sec INTEGER DEFAULT 0,
    result VARCHAR(20) NOT NULL DEFAULT 'missed',
        -- booked | not_booked | info_only | missed | callback_pending | cancelled | rescheduled
    operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    reject_reason VARCHAR(30),
        -- high_price | not_now | wrong_service | competitor | no_slots | other | NULL
    patient_id VARCHAR(255),     -- обезличенный ID или телефон (если consent)
    patient_phone VARCHAR(20),   -- только в режиме personal, шифруется
    callback_done BOOLEAN DEFAULT FALSE,
    callback_at TIMESTAMPTZ,
    callback_result VARCHAR(20), -- booked | not_booked | no_answer | NULL
    audio_url VARCHAR(500),
    transcription_text TEXT,
    transcription_status VARCHAR(20),  -- pending | completed | failed | NULL
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_records_clinic_date ON call_records(clinic_id, date);
CREATE INDEX idx_call_records_operator ON call_records(operator_id, date);
CREATE INDEX idx_call_records_status ON call_records(clinic_id, status, date);
CREATE INDEX idx_call_records_result ON call_records(clinic_id, result, date);

-- ========================================
-- ВОРОНКА ДНЯ (агрегированные данные)
-- ========================================

CREATE TABLE daily_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
    calls_total INTEGER NOT NULL DEFAULT 0,
    calls_answered INTEGER NOT NULL DEFAULT 0,
    calls_missed INTEGER NOT NULL DEFAULT 0,
    booked INTEGER NOT NULL DEFAULT 0,
    visited INTEGER NOT NULL DEFAULT 0,
    avg_check DECIMAL(10,2),         -- если передан, иначе берётся из настроек
    callbacks_made INTEGER DEFAULT 0,
    callbacks_success INTEGER DEFAULT 0,
    source VARCHAR(20) DEFAULT 'manual',  -- manual | computed | imported
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);

CREATE INDEX idx_daily_funnels_clinic ON daily_funnels(clinic_id, date DESC);

-- ========================================
-- РАССЧИТАННЫЕ ПОТЕРИ (кэш, пересчитывается)
-- ========================================

CREATE TABLE daily_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    loss_missed DECIMAL(12,2) DEFAULT 0,
    loss_no_callback DECIMAL(12,2) DEFAULT 0,
    loss_low_conversion DECIMAL(12,2) DEFAULT 0,
    loss_no_show DECIMAL(12,2) DEFAULT 0,
    loss_total DECIMAL(12,2) DEFAULT 0,
    recovery_minimum DECIMAL(12,2) DEFAULT 0,
    recovery_good DECIMAL(12,2) DEFAULT 0,
    recovery_excellent DECIMAL(12,2) DEFAULT 0,
    funnel_data JSONB NOT NULL DEFAULT '{}',  -- snapshot воронки на момент расчёта
    coefficients_used JSONB NOT NULL DEFAULT '{}',  -- snapshot коэффициентов
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);

-- ========================================
-- ЗАДАЧИ (ПЛАН ДНЯ)
-- ========================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
        -- callback | confirm_booking | reschedule | follow_up | review_call
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
        -- high | medium | low
    status VARCHAR(20) NOT NULL DEFAULT 'open',
        -- open | done | postponed | irrelevant
    deadline TIMESTAMPTZ,
    description TEXT NOT NULL,
    source_call_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
    assigned_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    result VARCHAR(20),          -- booked | not_booked | no_answer | rescheduled | NULL
    comment TEXT,
    postponed_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_clinic_date ON tasks(clinic_id, date, status);
CREATE INDEX idx_tasks_status ON tasks(clinic_id, status);

-- ========================================
-- АНОМАЛИИ
-- ========================================

CREATE TABLE anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    type VARCHAR(30) NOT NULL,
        -- short_calls | monotone_reasons | low_show_rate | shift_end_spike | missed_prime_time | sudden_change
    severity VARCHAR(10) NOT NULL DEFAULT 'medium',
        -- high | medium | low
    entity_type VARCHAR(20) NOT NULL, -- operator | clinic
    entity_id UUID,
    entity_name VARCHAR(255),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    message TEXT NOT NULL,
    suggestion TEXT,
    data JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anomalies_clinic ON anomalies(clinic_id, detected_at DESC);

-- ========================================
-- COACH MODE
-- ========================================

CREATE TABLE lesson_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES lesson_categories(id),
    title VARCHAR(255) NOT NULL,
    situation TEXT NOT NULL,
    correct_script TEXT NOT NULL,
    incorrect_script TEXT NOT NULL,
    incorrect_explanation TEXT NOT NULL,
    quiz_question TEXT NOT NULL,
    quiz_options JSONB NOT NULL,  -- ["option A", "option B", "option C"]
    quiz_correct_index INTEGER NOT NULL,  -- 0-based
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    quiz_answer INTEGER,
    quiz_correct BOOLEAN,
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE script_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,  -- NULL = системная
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES script_categories(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,  -- NULL = системный
    type VARCHAR(10) NOT NULL,  -- good | bad
    text TEXT NOT NULL,
    compliance_note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- УВЕДОМЛЕНИЯ
-- ========================================

CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
    email_morning BOOLEAN DEFAULT TRUE,
    email_morning_time TIME DEFAULT '08:30',
    email_midday BOOLEAN DEFAULT TRUE,
    email_midday_time TIME DEFAULT '12:30',
    email_evening BOOLEAN DEFAULT TRUE,
    email_evening_time TIME DEFAULT '20:30',
    email_recipients TEXT[] DEFAULT '{}',
    web_push_enabled BOOLEAN DEFAULT TRUE,
    web_push_anomalies BOOLEAN DEFAULT TRUE,
    web_push_deadlines BOOLEAN DEFAULT TRUE,
    weekly_report_enabled BOOLEAN DEFAULT TRUE,
    weekly_report_day INTEGER DEFAULT 1,  -- 1=Monday
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = для всех
    type VARCHAR(20) NOT NULL,
        -- import_complete | anomaly | task_deadline | lesson_available | report_ready | digest
    title VARCHAR(255) NOT NULL,
    body TEXT,
    link VARCHAR(500),
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_clinic ON notifications(clinic_id, created_at DESC);

-- ========================================
-- ОТЧЁТЫ
-- ========================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL,  -- owner_summary | manager_detailed
    format VARCHAR(10) NOT NULL DEFAULT 'pdf',  -- pdf | html | csv
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'generating',  -- generating | ready | failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- АУДИТ ЛОГ
-- ========================================

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    clinic_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
        -- login | import | export | delete_data | change_role | change_privacy_mode | view_personal_data
    entity_type VARCHAR(30),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_clinic ON audit_log(clinic_id, created_at DESC);

-- ========================================
-- PUSH SUBSCRIPTIONS
-- ========================================

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Пример RLS policy (clinic_id из JWT через SET LOCAL)
-- CREATE POLICY clinic_isolation ON call_records
--     USING (clinic_id = current_setting('app.current_clinic_id')::uuid);
```

### 3.2 ER-диаграмма (текстовая)

```
organizations 1──* clinics 1──* operators
    │                │              │
    │                │              │
    *                *              *
   users          call_records   tasks
    │                │
    │                │
    *                *
lesson_progress   daily_funnels
                     │
                     *
                  daily_losses
```

---

## 4. API эндпойнты

### 4.1 Аутентификация

| Method | Path | Описание |
|--------|------|---------|
| POST | `/api/v1/auth/register` | Регистрация организации + первого пользователя |
| POST | `/api/v1/auth/login` | Логин (email + пароль) → JWT |
| POST | `/api/v1/auth/logout` | Инвалидация сессии |
| POST | `/api/v1/auth/refresh` | Обновление JWT |
| POST | `/api/v1/auth/forgot-password` | Запрос сброса пароля |
| POST | `/api/v1/auth/reset-password` | Сброс пароля по токену |
| GET  | `/api/v1/auth/me` | Текущий пользователь + роль |

### 4.2 Импорт данных

| Method | Path | Описание |
|--------|------|---------|
| POST | `/api/v1/import/journal` | Загрузка CSV/Excel журнала обращений (multipart/form-data) |
| POST | `/api/v1/import/funnel` | Ввод воронки дня (JSON body) |
| POST | `/api/v1/import/audio` | Загрузка аудиозаписи (multipart/form-data) |
| GET  | `/api/v1/import/history` | Список импортов (пагинация) |
| GET  | `/api/v1/import/:id` | Статус и детали импорта |
| GET  | `/api/v1/import/templates/:type` | Скачать шаблон (journal_csv, journal_xlsx, funnel_csv) |
| POST | `/api/v1/import/preview` | Превью файла: автодетект, маппинг, первые 5 строк |
| PUT  | `/api/v1/import/:id/mapping` | Сохранить маппинг колонок |

### 4.3 Дашборд и аналитика

| Method | Path | Описание |
|--------|------|---------|
| GET | `/api/v1/dashboard/losses` | Потери за период (query: start, end, clinic_id) |
| GET | `/api/v1/dashboard/funnel` | Воронка за период |
| GET | `/api/v1/dashboard/top-leaks` | Топ-5 утечек с рекомендациями |
| GET | `/api/v1/dashboard/forecast` | Прогнозы recovery (3 сценария) |
| GET | `/api/v1/dashboard/trends` | Тренды потерь (7/30/90 дней) |
| GET | `/api/v1/dashboard/benchmark-comparison` | Сравнение с бенчмарками |

### 4.4 Задачи (План дня)

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/tasks` | Список задач (query: date, type, status, operator_id) |
| GET  | `/api/v1/tasks/summary` | Агрегированная сводка задач на день |
| PATCH | `/api/v1/tasks/:id` | Обновить статус задачи (done/postponed/irrelevant + comment) |
| POST | `/api/v1/tasks/bulk-update` | Пакетное обновление (для агрегированного режима) |
| POST | `/api/v1/tasks/generate` | Триггер генерации задач (обычно автоматически после импорта) |

### 4.5 Операторы и KPI

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/operators` | Список операторов клиники |
| GET  | `/api/v1/operators/:id` | Детали оператора |
| GET  | `/api/v1/operators/:id/kpi` | KPI оператора за период |
| GET  | `/api/v1/operators/ranking` | Рейтинг операторов |
| POST | `/api/v1/operators` | Создать оператора |
| PUT  | `/api/v1/operators/:id` | Обновить оператора |
| GET  | `/api/v1/anomalies` | Список аномалий (query: clinic_id, severity, acknowledged) |
| PATCH | `/api/v1/anomalies/:id/acknowledge` | Подтвердить аномалию |

### 4.6 Coach Mode

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/coach/lessons` | Список уроков (с прогрессом текущего пользователя) |
| GET  | `/api/v1/coach/lessons/:id` | Детали урока |
| POST | `/api/v1/coach/lessons/:id/complete` | Отметить прохождение + ответ на квиз |
| GET  | `/api/v1/coach/lessons/daily` | Урок дня для текущего пользователя |
| GET  | `/api/v1/coach/scripts` | База скриптов (по категориям) |
| POST | `/api/v1/coach/scripts` | Добавить свой скрипт (manager+) |
| GET  | `/api/v1/coach/recommendations/:operator_id` | Рекомендации для оператора |

### 4.7 Отчёты

| Method | Path | Описание |
|--------|------|---------|
| POST | `/api/v1/reports/generate` | Запустить генерацию отчёта |
| GET  | `/api/v1/reports` | Список сгенерированных отчётов |
| GET  | `/api/v1/reports/:id` | Статус отчёта |
| GET  | `/api/v1/reports/:id/download` | Скачать файл отчёта |

### 4.8 Настройки

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/clinics/current` | Данные текущей клиники |
| PUT  | `/api/v1/clinics/current` | Обновить настройки клиники |
| GET  | `/api/v1/clinics/current/benchmarks` | Коэффициенты |
| PUT  | `/api/v1/clinics/current/benchmarks` | Обновить коэффициенты |
| POST | `/api/v1/clinics/current/reset-benchmarks` | Сбросить к дефолтам |

### 4.9 Пользователи и роли

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/users` | Список пользователей организации |
| POST | `/api/v1/users/invite` | Пригласить пользователя (email + role) |
| PUT  | `/api/v1/users/:id/role` | Изменить роль |
| DELETE | `/api/v1/users/:id` | Деактивировать пользователя |

### 4.10 Уведомления

| Method | Path | Описание |
|--------|------|---------|
| GET  | `/api/v1/notifications` | Список in-app уведомлений (пагинация) |
| PATCH | `/api/v1/notifications/:id/read` | Пометить прочитанным |
| POST | `/api/v1/notifications/read-all` | Прочитать все |
| GET  | `/api/v1/notifications/settings` | Настройки уведомлений клиники |
| PUT  | `/api/v1/notifications/settings` | Обновить настройки |
| POST | `/api/v1/push/subscribe` | Подписка на web-push |
| DELETE | `/api/v1/push/subscribe` | Отписка |

### 4.11 Данные и приватность

| Method | Path | Описание |
|--------|------|---------|
| POST | `/api/v1/privacy/delete-all` | Удалить все данные клиники |
| POST | `/api/v1/privacy/export-all` | Экспорт всех данных (GDPR) |
| PUT  | `/api/v1/privacy/mode` | Переключить режим (anonymous/personal) |

---

## 5. Провайдер транскрипции — интерфейс

```typescript
// src/modules/transcription/transcription-provider.interface.ts

export interface TranscriptionSegment {
  start: number;      // seconds
  end: number;        // seconds
  text: string;
  confidence: number; // 0-1
  speaker?: string;   // speaker diarization (optional)
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;   // total audio duration in seconds
  confidence: number; // average confidence 0-1
}

export interface TranscriptionProvider {
  name: string;

  /**
   * Transcribe audio file from URL or local path
   */
  transcribe(audioUrl: string, options?: {
    language?: string;       // default: 'ru'
    model?: string;          // provider-specific model
    speakerDiarization?: boolean;
  }): Promise<TranscriptionResult>;

  /**
   * Check if provider is available and configured
   */
  healthCheck(): Promise<boolean>;

  /**
   * Estimated cost per minute (for display)
   */
  costPerMinute(): number; // in rubles
}

// Implementations:
// - WhisperLocalProvider: self-hosted Whisper (free, requires GPU)
// - WhisperApiProvider: OpenAI Whisper API (~1.8 ₽/мин)
// - YandexSpeechKitProvider: Yandex SpeechKit (~1.5 ₽/мин)
// - MockProvider: returns dummy text (for testing)
```

---

## 6. Cron-задачи (BullMQ Schedulers)

| Задача | Cron | Описание |
|--------|------|---------|
| `generate-daily-tasks` | `0 7 * * *` (07:00 UTC) | Генерация задач на день для всех клиник |
| `send-morning-digest` | `0 5-9 * * *` (каждый час 05-09 UTC) | Утренний email (в 08:30 по TZ клиники) |
| `send-midday-nudge` | `0 9-13 * * *` | Дневной nudge (12:30 по TZ) |
| `send-evening-report` | `0 17-20 * * *` | Вечерний отчёт (20:30 по TZ) |
| `detect-anomalies` | `0 8 * * *` | Проверка аномалий за вчера |
| `recalculate-losses` | после каждого импорта | Пересчёт потерь |
| `cleanup-expired-audio` | `0 3 * * *` | Удаление аудио с истёкшим TTL |
| `weekly-report` | `0 7 * * 1` | Генерация еженедельного отчёта |

---

## 7. Безопасность

### 7.1 Аутентификация
- JWT (access token: 15 мин, refresh token: 7 дней)
- HttpOnly cookies для refresh token
- Rate limiting: 5 попыток логина / 15 мин / IP

### 7.2 Авторизация
- RBAC (Role-Based Access Control): owner, manager, supervisor, operator
- Middleware проверяет роль на каждом endpoint
- Row-Level Security в PostgreSQL для изоляции данных клиник

### 7.3 Данные
- Шифрование at rest: AES-256 (PostgreSQL pgcrypto для чувствительных полей)
- Шифрование in transit: TLS 1.2+
- Персональные данные (patient_phone, patient_name) шифруются на уровне приложения
- Аудио-файлы: S3 с server-side encryption
- Аудит лог всех действий с персональными данными

### 7.4 Приватность
- Режим "обезличенный" по умолчанию
- Переключение в "персональный" только с подтверждением
- Удаление всех данных одной кнопкой (hard delete + S3 cleanup)
- Экспорт данных (GDPR/ФЗ-152 compliant)
