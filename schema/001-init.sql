-- CallFlow OS — Initial Database Schema
-- PostgreSQL 16+
-- Run: psql -d callflow -f 001-init.sql

-- ========================================
-- EXTENSIONS
-- ========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- ОРГАНИЗАЦИИ И ПОЛЬЗОВАТЕЛИ
-- ========================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    billing_plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    billing_status VARCHAR(20) NOT NULL DEFAULT 'trial',
    trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days'
);

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'dental',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Moscow',
    chairs_count INTEGER NOT NULL DEFAULT 3,
    avg_check DECIMAL(10,2) NOT NULL DEFAULT 5000.00,
    working_hours_start TIME NOT NULL DEFAULT '09:00',
    working_hours_end TIME NOT NULL DEFAULT '21:00',
    logo_url VARCHAR(500),
    privacy_mode VARCHAR(20) NOT NULL DEFAULT 'anonymous',
    personal_data_consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_org ON clinics(organization_id);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'manager',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    totp_secret VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ========================================
-- КОЭФФИЦИЕНТЫ И НАСТРОЙКИ
-- ========================================

CREATE TABLE clinic_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
    answer_rate_target DECIMAL(4,3) NOT NULL DEFAULT 0.900,
    booking_rate_target DECIMAL(4,3) NOT NULL DEFAULT 0.550,
    show_rate_target DECIMAL(4,3) NOT NULL DEFAULT 0.850,
    callback_success_rate DECIMAL(4,3) NOT NULL DEFAULT 0.600,
    booking_rate_callback DECIMAL(4,3) NOT NULL DEFAULT 0.350,
    avg_margin DECIMAL(4,3) NOT NULL DEFAULT 0.600,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- ОПЕРАТОРЫ
-- ========================================

CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    external_id VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operators_clinic ON operators(clinic_id);

-- ========================================
-- ИМПОРТ ДАННЫХ
-- ========================================

CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL,
    filename VARCHAR(500),
    file_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]',
    column_mapping JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_imports_clinic ON imports(clinic_id, created_at DESC);

-- ========================================
-- ЗАПИСИ ОБРАЩЕНИЙ
-- ========================================

CREATE TABLE call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    import_id UUID REFERENCES imports(id) ON DELETE SET NULL,
    date_time TIMESTAMPTZ NOT NULL,
    date DATE NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'phone_in',
    status VARCHAR(20) NOT NULL DEFAULT 'answered',
    duration_sec INTEGER NOT NULL DEFAULT 0,
    result VARCHAR(20) NOT NULL DEFAULT 'missed',
    operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    reject_reason VARCHAR(30),
    patient_id VARCHAR(255),
    patient_phone_encrypted BYTEA,  -- AES-256 encrypted
    patient_name_encrypted BYTEA,   -- AES-256 encrypted
    callback_done BOOLEAN NOT NULL DEFAULT FALSE,
    callback_at TIMESTAMPTZ,
    callback_result VARCHAR(20),
    audio_url VARCHAR(500),
    transcription_text TEXT,
    transcription_status VARCHAR(20),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_records_clinic_date ON call_records(clinic_id, date);
CREATE INDEX idx_call_records_operator ON call_records(operator_id, date);
CREATE INDEX idx_call_records_status ON call_records(clinic_id, status, date);
CREATE INDEX idx_call_records_result ON call_records(clinic_id, result, date);
CREATE INDEX idx_call_records_import ON call_records(import_id);

-- ========================================
-- ВОРОНКА ДНЯ
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
    avg_check DECIMAL(10,2),
    callbacks_made INTEGER NOT NULL DEFAULT 0,
    callbacks_success INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);

CREATE INDEX idx_daily_funnels_clinic ON daily_funnels(clinic_id, date DESC);

-- ========================================
-- РАССЧИТАННЫЕ ПОТЕРИ
-- ========================================

CREATE TABLE daily_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    loss_missed DECIMAL(12,2) NOT NULL DEFAULT 0,
    loss_no_callback DECIMAL(12,2) NOT NULL DEFAULT 0,
    loss_low_conversion DECIMAL(12,2) NOT NULL DEFAULT 0,
    loss_no_show DECIMAL(12,2) NOT NULL DEFAULT 0,
    loss_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    recovery_minimum DECIMAL(12,2) NOT NULL DEFAULT 0,
    recovery_good DECIMAL(12,2) NOT NULL DEFAULT 0,
    recovery_excellent DECIMAL(12,2) NOT NULL DEFAULT 0,
    funnel_data JSONB NOT NULL DEFAULT '{}',
    coefficients_used JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, date)
);

CREATE INDEX idx_daily_losses_clinic ON daily_losses(clinic_id, date DESC);

-- ========================================
-- ЗАДАЧИ
-- ========================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    deadline TIMESTAMPTZ,
    description TEXT NOT NULL,
    source_call_id UUID REFERENCES call_records(id) ON DELETE SET NULL,
    assigned_operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    result VARCHAR(20),
    comment TEXT,
    postponed_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_clinic_date ON tasks(clinic_id, date, status);
CREATE INDEX idx_tasks_status ON tasks(clinic_id, status);
CREATE INDEX idx_tasks_operator ON tasks(assigned_operator_id, date);

-- ========================================
-- АНОМАЛИИ
-- ========================================

CREATE TABLE anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type VARCHAR(30) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'medium',
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(255),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    message TEXT NOT NULL,
    suggestion TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomalies_clinic ON anomalies(clinic_id, detected_at DESC);
CREATE INDEX idx_anomalies_entity ON anomalies(entity_type, entity_id);

-- ========================================
-- COACH MODE
-- ========================================

CREATE TABLE lesson_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
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
    quiz_options JSONB NOT NULL,
    quiz_correct_index INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quiz_answer INTEGER,
    quiz_correct BOOLEAN,
    UNIQUE(user_id, lesson_id)
);

CREATE TABLE script_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES script_categories(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL,
    text TEXT NOT NULL,
    compliance_note TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- УВЕДОМЛЕНИЯ
-- ========================================

CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE UNIQUE,
    email_morning BOOLEAN NOT NULL DEFAULT TRUE,
    email_morning_time TIME NOT NULL DEFAULT '08:30',
    email_midday BOOLEAN NOT NULL DEFAULT TRUE,
    email_midday_time TIME NOT NULL DEFAULT '12:30',
    email_evening BOOLEAN NOT NULL DEFAULT TRUE,
    email_evening_time TIME NOT NULL DEFAULT '20:30',
    email_recipients TEXT[] NOT NULL DEFAULT '{}',
    web_push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    web_push_anomalies BOOLEAN NOT NULL DEFAULT TRUE,
    web_push_deadlines BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_report_day INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    link VARCHAR(500),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    type VARCHAR(20) NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'pdf',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'generating',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_clinic ON reports(clinic_id, created_at DESC);

-- ========================================
-- АУДИТ ЛОГ
-- ========================================

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    clinic_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30),
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_clinic ON audit_log(clinic_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);

-- ========================================
-- PUSH SUBSCRIPTIONS
-- ========================================

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(500) NOT NULL,
    p256dh VARCHAR(255) NOT NULL,
    auth VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

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
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- RLS policies will be created by the application layer
-- using SET LOCAL app.current_clinic_id = 'uuid' per transaction
