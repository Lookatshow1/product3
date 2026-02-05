# CallFlow OS — Формулы, коэффициенты и детектор аномалий

## 1. Формулы расчёта потерь

### 1.1 Потери от пропущенных звонков

```
loss_missed = missed_calls × booking_rate × show_rate × avg_check
```

Где:
- `missed_calls` — количество пропущенных звонков за период
- `booking_rate` — конверсия принятого звонка в запись (дефолт: 0.50)
- `show_rate` — доходимость записи до визита (дефолт: 0.80)
- `avg_check` — средний чек визита (дефолт: 5 000 ₽, настраивается при онбординге)

**Пример:** 23 пропущенных × 0.50 × 0.80 × 8 500 ₽ = 78 200 ₽

### 1.2 Потери от "не перезвонили"

```
loss_no_callback = (missed_calls - callback_success) × booking_rate_callback × show_rate × avg_check
```

Где:
- `callback_success` — количество успешных перезвонов (дозвонились)
- `booking_rate_callback` — конверсия перезвона в запись (дефолт: 0.35, ниже чем входящий, т.к. "остывший" контакт)

**Если нет данных о перезвонах:** предполагаем callback_success = 0 (худший сценарий), показываем плашку "данные о перезвонах не загружены — показан максимальный сценарий потерь".

### 1.3 Потери от низкой конверсии

```
loss_low_conversion = answered_calls × max(0, benchmark_booking_rate - actual_booking_rate) × show_rate × avg_check
```

Где:
- `benchmark_booking_rate` — целевая конверсия (дефолт: 0.55)
- `actual_booking_rate` — фактическая конверсия за период

**Пример:** 68 принятых × max(0, 0.55 - 0.40) × 0.80 × 8 500 ₽ = 69 360 ₽

### 1.4 Потери от неявки

```
loss_no_show = (booked - visited) × avg_check
```

Простейшая формула: каждая неявка = потерянный средний чек.

### 1.5 Итого потерь

```
total_loss = loss_missed + loss_no_callback + loss_low_conversion + loss_no_show
```

**Важно:** Потери пропущенных и "не перезвонили" могут частично пересекаться. Чтобы не дублировать:

```
loss_missed_net = callback_success × booking_rate_callback × show_rate × avg_check  // то, что "спасли" перезвоном
loss_missed_display = loss_missed - loss_missed_net  // чистые потери от пропущенных
loss_no_callback_display = loss_no_callback  // потери от тех, кому НЕ перезвонили
```

### 1.6 Прогноз возврата

```
recovery_minimum = actionable_callbacks × callback_success_rate × booking_rate_callback × show_rate × avg_check
recovery_good = recovery_minimum + (answered × conversion_uplift_10pp × show_rate × avg_check)
recovery_excellent = recovery_good + (booked × show_rate_uplift_10pp × avg_check)
```

Где:
- `actionable_callbacks` — пропущенные, которым ещё можно позвонить (< 48 часов)
- `callback_success_rate` — вероятность дозвона при перезвоне (дефолт: 0.60)
- `conversion_uplift_10pp` — разница 10 процентных пунктов конверсии (0.10)
- `show_rate_uplift_10pp` — разница 10 процентных пунктов доходимости (0.10)

---

## 2. Дефолтные коэффициенты

### 2.1 По типу клиники

| Коэффициент | Стоматология | Косметология | Многопрофильная | ЛОР/Офтальм. |
|-------------|-------------|-------------|-----------------|---------------|
| avg_check | 5 000 ₽ | 4 000 ₽ | 3 500 ₽ | 3 000 ₽ |
| booking_rate (бенчмарк) | 0.55 | 0.50 | 0.45 | 0.50 |
| show_rate (бенчмарк) | 0.85 | 0.80 | 0.82 | 0.85 |
| answer_rate (бенчмарк) | 0.90 | 0.88 | 0.85 | 0.88 |
| callback_success_rate | 0.60 | 0.55 | 0.55 | 0.58 |
| booking_rate_callback | 0.35 | 0.30 | 0.28 | 0.32 |
| avg_margin | 0.60 | 0.65 | 0.50 | 0.55 |

### 2.2 По размеру клиники

| Размер | Кресел/кабинетов | Типичный объём звонков/день | Коррекция avg_check |
|--------|-----------------|---------------------------|-------------------|
| Малая | 1–3 | 15–30 | ×1.0 |
| Средняя | 4–8 | 30–80 | ×1.1 |
| Крупная | 9–15 | 80–200 | ×1.15 |
| Сеть | 15+ (филиалы) | 200+ | ×1.2 |

### 2.3 Изменяемость

Все коэффициенты:
- Устанавливаются автоматически по типу клиники при онбординге
- Редактируются пользователем в Настройки → Коэффициенты
- Пересчитываются системой по мере накопления реальных данных (после 30 дней → предложение "Обновить коэффициенты на основе ваших данных?")

---

## 3. Формула Score оператора

```
operator_score =
  w1 × normalize(answer_rate, 0.70, 1.00) +          // вес 0.20
  w2 × normalize(booking_rate, 0.20, 0.80) +          // вес 0.35
  w3 × normalize(show_rate, 0.50, 1.00) +             // вес 0.20
  w4 × normalize(avg_duration, 60, 300) +              // вес 0.10 (оптимум ~180с)
  w5 × normalize(callback_attempt_rate, 0, 1.00) +    // вес 0.10
  w6 × anomaly_penalty                                 // вес -0.05 до 0
```

Где:
- `normalize(value, min, max)` = `(value - min) / (max - min)`, clamped to [0, 1]
- `avg_duration` — колокольчатая нормализация: оптимум 120–240с, штраф за <60с и >360с
- `anomaly_penalty` — штраф за обнаруженные аномалии (0 = нет аномалий, -1 = серьёзные)

**Итоговый Score: 0–100** (отображается как число и цветовой индикатор)

---

## 4. Детектор аномалий

### 4.1 Правила (rule-based, MVP)

```python
# Правило 1: Массовые короткие звонки (подозрение на сброс)
def detect_short_calls(operator, period):
    short = count(calls WHERE duration < 15 AND status = 'answered')
    total = count(calls WHERE status = 'answered')
    if total > 5 and short / total > 0.30:
        return Anomaly(
            type="short_calls",
            severity="high",
            message=f"{operator.name}: {pct(short/total)} звонков <15 сек (норма <10%)",
            suggestion="Проверить: возможен сброс звонков или проблемы с линией"
        )

# Правило 2: Монотонные причины отказа
def detect_monotone_reasons(operator, period):
    reasons = group_by(calls WHERE result = 'not_booked', 'reject_reason')
    if len(reasons) > 0:
        top_reason_pct = max(reasons.values()) / sum(reasons.values())
        if top_reason_pct > 0.70 and sum(reasons.values()) > 10:
            return Anomaly(
                type="monotone_reasons",
                severity="medium",
                message=f"{operator.name}: {pct(top_reason_pct)} отказов с причиной '{top_reason}' (разнообразие подозрительно низкое)",
                suggestion="Проверить: оператор может ставить одну причину не разбираясь"
            )

# Правило 3: Аномально низкая доходимость у оператора
def detect_low_show_rate(operator, clinic_avg, period):
    op_show = operator.show_rate(period)
    if clinic_avg - op_show > 0.15 and operator.booked_count(period) > 10:
        return Anomaly(
            type="low_show_rate",
            severity="high",
            message=f"{operator.name}: доходимость {pct(op_show)} при средней по клинике {pct(clinic_avg)}",
            suggestion="Проверить качество записи: возможно, неверная квалификация или давление на запись"
        )

# Правило 4: Пик активности в конце смены
def detect_end_of_shift_spike(operator, period):
    shift_end_hour = operator.shift_end  # или последний час данных
    last_hour_bookings = count(bookings WHERE hour = shift_end_hour - 1)
    total_bookings = count(bookings)
    if total_bookings > 5 and last_hour_bookings / total_bookings > 0.40:
        return Anomaly(
            type="shift_end_spike",
            severity="medium",
            message=f"{operator.name}: {pct(last_hour_bookings/total_bookings)} записей в последний час смены",
            suggestion="Проверить: возможна накрутка записей перед концом смены"
        )

# Правило 5: Высокий % пропущенных в рабочее время
def detect_missed_prime_time(clinic, period):
    work_hours_missed = count(calls WHERE status='missed' AND hour BETWEEN 9 AND 18)
    work_hours_total = count(calls WHERE hour BETWEEN 9 AND 18)
    if work_hours_total > 10 and work_hours_missed / work_hours_total > 0.20:
        return Anomaly(
            type="missed_prime_time",
            severity="high",
            message=f"Пропущено {pct(work_hours_missed/work_hours_total)} звонков в рабочее время (09:00-18:00)",
            suggestion="Проверить: нехватка операторов на линии или технические проблемы"
        )

# Правило 6: Резкое изменение показателей (vs предыдущий период)
def detect_sudden_change(metric, current, previous, threshold=0.25):
    if previous > 0 and abs(current - previous) / previous > threshold:
        direction = "рост" if current > previous else "падение"
        return Anomaly(
            type="sudden_change",
            severity="medium",
            message=f"Резкое {direction} {metric}: {previous} → {current} ({pct(abs(current-previous)/previous)})",
            suggestion="Проверить: изменение может быть связано с внешними факторами или ошибкой данных"
        )
```

### 4.2 Статистическая модель (V1, опционально)

Для клиник с >90 дней данных:

```
# Z-score по скользящему среднему (30 дней)
z_score = (current_value - rolling_mean_30d) / rolling_std_30d

if abs(z_score) > 2.0:
    severity = "medium"
if abs(z_score) > 3.0:
    severity = "high"
```

Применяется к метрикам: answer_rate, booking_rate, show_rate, avg_duration (по оператору и по клинике).

### 4.3 Формат алерта аномалии

```json
{
  "id": "uuid",
  "clinic_id": "uuid",
  "detected_at": "2025-01-15T10:30:00Z",
  "type": "short_calls",
  "severity": "high",  // high | medium | low
  "entity_type": "operator",  // operator | clinic
  "entity_id": "uuid",
  "entity_name": "Иванова А.С.",
  "period": "2025-01-15",
  "message": "35% звонков <15 сек (норма <10%)",
  "suggestion": "Проверить: возможен сброс звонков",
  "acknowledged": false,
  "acknowledged_by": null,
  "acknowledged_at": null,
  "data": {
    "short_calls_count": 12,
    "total_calls_count": 34,
    "short_calls_pct": 0.35,
    "threshold": 0.10
  }
}
```

---

## 5. Генерация задач — алгоритм

```python
def generate_daily_tasks(clinic, date):
    tasks = []

    # 1. Перезвоны по пропущенным (P0)
    missed = get_calls(clinic, date-1, status='missed', callback_done=False)
    for call in missed:
        tasks.append(Task(
            type='callback',
            priority='high',
            deadline=date + timedelta(hours=3),  # до 12:00
            source_call_id=call.id,
            description=f"Перезвонить по пропущенному {call.date_time.strftime('%H:%M')}",
        ))

    # 2. Подтверждения записей на завтра (P1)
    bookings_tomorrow = get_bookings(clinic, date+1)
    for booking in bookings_tomorrow:
        tasks.append(Task(
            type='confirm_booking',
            priority='medium',
            deadline=date + timedelta(hours=9),  # до 18:00
            source_booking_id=booking.id,
            description=f"Подтвердить запись на {booking.date_time.strftime('%d.%m %H:%M')}",
        ))

    # 3. Удержание отмен (P1)
    cancelled = get_bookings(clinic, date, status='cancelled', cancel_date=date-1)
    for booking in cancelled:
        tasks.append(Task(
            type='reschedule',
            priority='medium',
            deadline=date + timedelta(hours=6),  # до 15:00
            source_booking_id=booking.id,
            description=f"Предложить перенос отменённой записи",
        ))

    # 4. Дожим "не сейчас" (P2)
    not_now = get_calls(clinic, date-1, result='not_booked',
                        reject_reason__in=['not_now', 'high_price'])
    for call in not_now:
        tasks.append(Task(
            type='follow_up',
            priority='low',
            deadline=date + timedelta(hours=10),  // до 19:00
            source_call_id=call.id,
            description=f"Дожим: отказ '{call.reject_reason}' {call.date_time.strftime('%H:%M')}",
        ))

    # 5. Разбор звонков оператора (P2) — если конверсия низкая
    for operator in clinic.operators:
        if operator.booking_rate(date-7, date) < clinic.benchmark_booking_rate - 0.15:
            tasks.append(Task(
                type='review_call',
                priority='low',
                deadline=date + timedelta(hours=10),
                operator_id=operator.id,
                description=f"Разбор звонков: {operator.name}, конверсия {operator.booking_rate():.0%}",
            ))

    return tasks

# Агрегированный режим (без персданных)
def aggregate_tasks(tasks):
    summary = {}
    for task in tasks:
        key = task.type
        summary.setdefault(key, {'count': 0, 'deadline': task.deadline})
        summary[key]['count'] += 1
        summary[key]['deadline'] = min(summary[key]['deadline'], task.deadline)
    return summary
    # Результат: {"callback": {"count": 23, "deadline": "12:00"}, ...}
```

---

## 6. Бенчмарки отрасли (предустановленные)

| Показатель | Плохо | Средне | Хорошо | Отлично |
|-----------|-------|--------|--------|---------|
| Answer rate | <75% | 75–85% | 85–92% | >92% |
| Booking rate | <35% | 35–50% | 50–60% | >60% |
| Show rate | <70% | 70–80% | 80–88% | >88% |
| Callback rate (по пропущенным) | <20% | 20–50% | 50–75% | >75% |
| Avg call duration | <60с | 60–120с | 120–240с | >240с (осторожно) |
| Time to callback | >4ч | 1–4ч | 15мин–1ч | <15мин |

Цветовая кодировка в UI:
- Плохо → Красный (#DC2626)
- Средне → Жёлтый (#F59E0B)
- Хорошо → Зелёный (#16A34A)
- Отлично → Синий (#2563EB)
