-- CallFlow OS — Demo Data Seed
-- Generates 30 days of realistic data for a dental clinic

-- Demo organization
INSERT INTO organizations (id, name, billing_plan, billing_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Демо-Организация', 'pro', 'trial');

-- Demo clinic
INSERT INTO clinics (id, organization_id, name, type, chairs_count, avg_check, timezone)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
        'Демо-Клиника "Улыбка"', 'dental', 5, 8500.00, 'Europe/Moscow');

-- Demo benchmarks
INSERT INTO clinic_benchmarks (clinic_id, answer_rate_target, booking_rate_target, show_rate_target)
VALUES ('00000000-0000-0000-0000-000000000010', 0.900, 0.550, 0.850);

-- Demo user (owner)
INSERT INTO users (id, organization_id, clinic_id, email, password_hash, name, role)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010', 'demo@callflow.ru',
        '$2b$12$demo.hash.placeholder', 'Демо Пользователь', 'owner');

-- Demo operators
INSERT INTO operators (id, clinic_id, name) VALUES
('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000010', 'Петрова М.В.'),
('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000010', 'Сидорова К.А.'),
('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000010', 'Иванова А.С.');

-- Notification settings
INSERT INTO notification_settings (clinic_id, email_recipients)
VALUES ('00000000-0000-0000-0000-000000000010', ARRAY['demo@callflow.ru']);

-- Demo daily funnels (30 days)
-- Realistic pattern: weekdays busy, weekends quiet, some variation
INSERT INTO daily_funnels (clinic_id, date, calls_total, calls_answered, calls_missed, booked, visited, avg_check, callbacks_made, callbacks_success, source)
SELECT
    '00000000-0000-0000-0000-000000000010',
    d::date,
    -- calls_total: 70-100 weekdays, 25-45 weekends
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 25 + floor(random() * 20)::int
         ELSE 70 + floor(random() * 30)::int END,
    -- calls_answered: ~78% answer rate
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 20 + floor(random() * 15)::int
         ELSE 55 + floor(random() * 20)::int END,
    -- calls_missed: total - answered (computed below)
    0, -- will be updated
    -- booked: ~42% of answered
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 8 + floor(random() * 8)::int
         ELSE 22 + floor(random() * 15)::int END,
    -- visited: ~76% of booked
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 6 + floor(random() * 6)::int
         ELSE 17 + floor(random() * 10)::int END,
    8500.00,
    -- callbacks_made: ~25% of missed
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN 1 + floor(random() * 3)::int
         ELSE 3 + floor(random() * 5)::int END,
    -- callbacks_success: ~60% of callbacks_made
    CASE WHEN EXTRACT(DOW FROM d) IN (0, 6)
         THEN floor(random() * 2)::int
         ELSE 2 + floor(random() * 3)::int END,
    'imported'
FROM generate_series(CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day', '1 day') AS d;

-- Fix calls_missed = calls_total - calls_answered
UPDATE daily_funnels
SET calls_missed = calls_total - calls_answered
WHERE clinic_id = '00000000-0000-0000-0000-000000000010';

-- Lesson categories
INSERT INTO lesson_categories (id, name, sort_order) VALUES
('00000000-0000-0000-0001-000000000001', 'Приветствие и первый контакт', 1),
('00000000-0000-0000-0001-000000000002', 'Работа с возражениями', 2),
('00000000-0000-0000-0001-000000000003', 'Запись и подтверждение', 3),
('00000000-0000-0000-0001-000000000004', 'Сложные ситуации', 4);

-- Sample lessons
INSERT INTO lessons (category_id, title, situation, correct_script, incorrect_script, incorrect_explanation, quiz_question, quiz_options, quiz_correct_index, sort_order) VALUES
('00000000-0000-0000-0001-000000000002',
 'Как работать с возражением "дорого"',
 'Пациент позвонил записаться на имплантацию. Вы назвали стоимость 45 000 ₽. Пациент говорит: "Ой, это дорого, я подумаю..."',
 'Я вас понимаю, это важное решение. Давайте я расскажу, что входит в стоимость: осмотр, снимок, сама установка и коронка. У нас есть рассрочка на 6 месяцев без переплаты. Могу записать вас на бесплатную консультацию, чтобы врач составил индивидуальный план?',
 'У нас и так самые низкие цены в городе!',
 'Это заявление нарушает ФЗ о рекламе — нельзя делать недоказуемые заявления о ценах. Также это не помогает пациенту принять решение.',
 'Пациент говорит "дорого". Какой ответ лучший?',
 '["Расскажите, что входит в стоимость, и предложите рассрочку", "Дайте скидку 10%", "Скажите что у конкурентов ещё дороже"]',
 0, 1),

('00000000-0000-0000-0001-000000000002',
 'Как работать с возражением "подумаю"',
 'Пациент выслушал информацию об услуге, но говорит: "Спасибо, я подумаю и перезвоню".',
 'Конечно, я понимаю. Чтобы вам было удобнее, могу я предложить записаться на удобное время? Если планы изменятся, вы всегда сможете перенести или отменить запись бесплатно. Так вам не придётся снова звонить и ждать.',
 'Хорошо, звоните когда надумаете. До свидания!',
 'Отпускать пациента без попытки "якорной записи" — это потеря. 80% тех, кто сказал "подумаю", никогда не перезвонят.',
 'Пациент говорит "подумаю". Что делать?',
 '["Предложить якорную запись с возможностью отмены", "Сказать до свидания и ждать", "Предложить скидку за немедленную запись"]',
 0, 2),

('00000000-0000-0000-0001-000000000001',
 'Правильное приветствие по телефону',
 'Раздаётся входящий звонок. Вам нужно снять трубку и поприветствовать пациента.',
 'Стоматология "Улыбка", администратор Мария, добрый день! Чем могу вам помочь?',
 'Алло? Да? Слушаю.',
 'Сухое "алло" не создаёт доверия. Пациент не понимает, куда позвонил. Правильное приветствие: название клиники + имя + вопрос.',
 'Как правильно ответить на входящий звонок?',
 '["Название клиники, имя, приветствие, вопрос", "Алло, слушаю", "Добрый день, вы позвонили в клинику"]',
 0, 1);

-- System script categories
INSERT INTO script_categories (id, name, sort_order) VALUES
('00000000-0000-0000-0002-000000000001', 'Приветствие и выяснение потребности', 1),
('00000000-0000-0000-0002-000000000002', 'Возражение "дорого"', 2),
('00000000-0000-0000-0002-000000000003', 'Возражение "подумаю"', 3),
('00000000-0000-0000-0002-000000000004', 'Запись на приём', 4),
('00000000-0000-0000-0002-000000000005', 'Отмена и перенос', 5),
('00000000-0000-0000-0002-000000000006', 'Запрещённые формулировки', 6);

-- Sample scripts
INSERT INTO scripts (category_id, type, text, compliance_note) VALUES
('00000000-0000-0000-0002-000000000002', 'good',
 'Я понимаю, что стоимость — важный фактор. Давайте я расскажу, что входит в эту сумму. У нас также есть рассрочка без переплаты.',
 'Не сравнивать с конкурентами. Не обещать скидки без согласования.'),
('00000000-0000-0000-0002-000000000006', 'bad',
 'У нас самые лучшие врачи в городе!',
 'Нарушение ФЗ о рекламе. Недоказуемое утверждение.'),
('00000000-0000-0000-0002-000000000006', 'bad',
 'Мы гарантируем результат лечения.',
 'Медицинские гарантии давать запрещено. Результат зависит от множества факторов.'),
('00000000-0000-0000-0002-000000000006', 'bad',
 'У конкурентов хуже / дороже / некачественно.',
 'Нарушение ФЗ о рекламе. Нельзя давать негативную оценку конкурентам.');
