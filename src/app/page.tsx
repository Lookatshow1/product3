import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600">CallFlow OS</div>
          <div className="flex gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">Войти</Link>
            <Link href="/register" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Попробовать бесплатно</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            Сколько денег ваша клиника<br/>
            <span className="text-red-600">теряет на звонках?</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            CallFlow OS считает потери от пропущенных, плохих скриптов и сорванных записей —
            и показывает, как вернуть деньги. Старт за 10 минут.
          </p>
          <Link href="/register" className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200">
            Узнать свои потери — бесплатно
          </Link>
          <p className="text-sm text-gray-500 mt-3">14 дней бесплатно. Без интеграций. Без привязки карты.</p>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Средняя клиника теряет 150 000–400 000 ₽/мес</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl font-bold text-red-600 mb-2">15–25%</div>
              <div className="text-gray-600">звонков пропускается каждый день</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl font-bold text-orange-500 mb-2">35–50%</div>
              <div className="text-gray-600">конверсия вместо 55–70% по бенчмарку</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm text-center">
              <div className="text-4xl font-bold text-yellow-500 mb-2">70–80%</div>
              <div className="text-gray-600">доходимость — каждый 5-й не приходит</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Как работает</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Загрузите данные', desc: 'CSV из АТС или вбейте 5 чисел вручную' },
              { step: '2', title: 'Увидьте потери', desc: 'Дашборд покажет сколько ₽ утекло и почему' },
              { step: '3', title: 'Получите план', desc: 'Кому перезвонить, кого подтвердить, кого дожать' },
              { step: '4', title: 'Контролируйте', desc: 'KPI операторов, аномалии, обучение, отчёты' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">{item.step}</div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Для кого</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-2xl mb-3">👔</div>
              <h3 className="font-semibold mb-2">Собственник</h3>
              <p className="text-sm text-gray-600">1-страничный отчёт: потери, тренды, рекомендации. Раз в неделю, без погружения в детали.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-semibold mb-2">Управляющий</h3>
              <p className="text-sm text-gray-600">Ежедневный дашборд + план задач + KPI операторов. Полный контроль за 5 минут утром.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-2xl mb-3">👩‍💼</div>
              <h3 className="font-semibold mb-2">Старший админ</h3>
              <p className="text-sm text-gray-600">Список задач на день + прогресс + обучение. Всё понятно, ничего не забыть.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Case study */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Пример результата</h2>
          <div className="bg-gradient-to-r from-red-50 to-green-50 p-8 rounded-2xl">
            <p className="text-center text-gray-500 mb-6">Стоматология, 5 кресел, средний чек 8 500 ₽</p>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold text-red-700 mb-4">Было</h3>
                <ul className="space-y-2 text-sm">
                  <li>Пропущенных: 22% (19 из 87/день)</li>
                  <li>Конверсия: 50%</li>
                  <li>Доходимость: 82%</li>
                  <li className="font-bold text-red-600 text-lg mt-4">Потери: ~320 000 ₽/мес</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-green-700 mb-4">Стало (через 2 месяца)</h3>
                <ul className="space-y-2 text-sm">
                  <li>Пропущенных: 7% (6 из 87/день)</li>
                  <li>Конверсия: 66%</li>
                  <li>Доходимость: 89%</li>
                  <li className="font-bold text-green-600 text-lg mt-4">Возвращено: +250 000 ₽/мес</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Тарифы</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Starter', price: '4 900', desc: 'Для одной клиники',
                features: ['1 филиал', '3 пользователя', '100 импортов/мес', 'Дашборд потерь', 'План дня', 'KPI операторов', 'Утренний дайджест'],
              },
              {
                name: 'Pro', price: '12 900', desc: 'Для растущей клиники', popular: true,
                features: ['До 5 филиалов', '15 пользователей', 'Безлимит импортов', 'Все дайджесты', 'PDF-отчёты', 'Детектор аномалий', 'Coach Mode', 'Аудио 10ч/мес'],
              },
              {
                name: 'Enterprise', price: '24 900', desc: 'Для сетей клиник',
                features: ['До 50 филиалов', 'Безлимит пользователей', 'API / Webhooks', 'White-label отчёты', 'Аудио 50ч/мес', 'Выделенный менеджер', 'Сравнение филиалов'],
              },
            ].map(plan => (
              <div key={plan.name} className={`bg-white p-6 rounded-xl shadow-sm ${plan.popular ? 'ring-2 ring-blue-600 relative' : ''}`}>
                {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">Популярный</div>}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                <div className="text-3xl font-bold mb-1">{plan.price} <span className="text-base font-normal text-gray-500">₽/мес</span></div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="text-sm flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`mt-6 block text-center py-2 rounded-lg text-sm font-medium ${plan.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  Начать бесплатно
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Частые вопросы</h2>
          {[
            { q: 'Нужна ли интеграция с АТС?', a: 'Нет, на старте достаточно CSV-выгрузки или ручного ввода 5 чисел. Интеграции — опционально.' },
            { q: 'Мы не ведём журнал звонков', a: 'Вводите 5 чисел раз в день (30 секунд). Мы дадим шаблон для ведения журнала.' },
            { q: 'Это CRM?', a: 'Нет. CallFlow OS не заменяет CRM, а показывает сколько денег вы теряете и что делать.' },
            { q: 'Безопасность данных?', a: 'По умолчанию мы не требуем персональных данных пациентов. Все данные шифруются. Удаление одной кнопкой.' },
            { q: 'Сколько времени на внедрение?', a: 'Первый результат через 10 минут. Полная настройка — до 30 минут.' },
          ].map(item => (
            <details key={item.q} className="mb-4 bg-gray-50 rounded-lg">
              <summary className="p-4 font-medium cursor-pointer hover:bg-gray-100 rounded-lg">{item.q}</summary>
              <p className="px-4 pb-4 text-gray-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Узнайте свои потери за 10 минут</h2>
          <p className="text-blue-100 mb-8">Загрузите данные — увидьте, сколько денег утекает. 14 дней бесплатно.</p>
          <Link href="/register" className="inline-block px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-xl hover:bg-blue-50 transition">
            Попробовать бесплатно
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div>CallFlow OS &copy; 2025</div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-700">Политика конфиденциальности</a>
            <a href="#" className="hover:text-gray-700">Пользовательское соглашение</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
