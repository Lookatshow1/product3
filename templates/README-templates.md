# Шаблоны импорта CallFlow OS

## journal-template.csv — Журнал обращений (детальный)

Загрузите этот файл как пример формата. Замените данные на свои.

**Обязательные колонки:**
- `date_time` — Дата и время обращения (форматы: DD.MM.YYYY HH:MM, YYYY-MM-DD HH:MM)
- `channel` — Канал: phone_in, phone_out, web_form, whatsapp, callback, walk_in, other
- `status` — Статус: answered, missed, callback_done, callback_failed, voicemail
- `result` — Результат: booked, not_booked, info_only, missed, callback_pending, cancelled, rescheduled

**Опциональные колонки:**
- `duration_sec` — Длительность в секундах (0 для пропущенных)
- `operator_name` — Имя оператора (для KPI)
- `reject_reason` — Причина отказа: high_price, not_now, wrong_service, competitor, no_slots, other
- `patient_id` — Обезличенный ID пациента (любая строка)

**Разделитель:** точка с запятой (;) или запятая (,) — определяется автоматически.
**Кодировка:** UTF-8 или Windows-1251 — определяется автоматически.

---

## funnel-template.csv — Воронка дня (агрегированная)

Используйте этот формат, если у вас нет детальной выгрузки.

**Колонки:**
- `date` — Дата
- `calls_total` — Всего входящих звонков
- `calls_answered` — Принято
- `calls_missed` — Пропущено
- `booked` — Записано на приём
- `visited` — Пришли на приём
- `avg_check` — Средний чек (₽), опционально
- `callbacks_made` — Перезвонов сделано, опционально
- `callbacks_success` — Из них успешных, опционально

---

## Как выгрузить данные из вашей АТС

### Mango Office
Журнал звонков → Экспорт → CSV

### Sipuni
Отчёты → Звонки → Выгрузить в Excel

### Zadarma
Статистика → История звонков → Скачать CSV

### Другие АТС
Найдите раздел "Журнал звонков" или "История вызовов" и экспортируйте в CSV/Excel.

Если формат вашей АТС отличается — загрузите файл, и CallFlow предложит маппинг колонок.
