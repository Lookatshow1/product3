#!/bin/bash
set -e

# =========================================
# CallFlow OS — Deployment Script
# Запускать на сервере: ssh root@77.232.128.173
# =========================================

APP_DIR="/opt/callflow"
REPO_URL="https://github.com/Lookatshow1/product3.git"
BRANCH="claude/dental-clinic-saas-BhEUs"

echo "🔧 1. Установка зависимостей..."
apt-get update -qq
apt-get install -y -qq docker.io docker-compose git curl

systemctl enable docker
systemctl start docker

echo "📦 2. Клонирование репозитория..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "🔐 3. Настройка окружения..."
if [ ! -f .env ]; then
  cp .env.example .env
  # Генерируем безопасный JWT-секрет
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|jwt_secret_change_me_32chars_min!|${JWT_SECRET}|g" .env
  # Обновляем DATABASE_URL для docker-compose
  sed -i "s|db:5432|db:5432|g" .env
  echo "✅ Файл .env создан. Проверьте настройки: nano $APP_DIR/.env"
fi

echo "🐳 4. Сборка и запуск Docker контейнеров..."
docker-compose down 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

echo "⏳ 5. Ожидание запуска базы данных..."
sleep 10

echo "🗄️ 6. Миграция и сид базы данных..."
docker-compose exec -T app npx prisma migrate deploy 2>/dev/null || \
  docker-compose exec -T app npx prisma db push
docker-compose exec -T app npx prisma db seed 2>/dev/null || echo "Сид не выполнен (это нормально если данные уже есть)"

echo ""
echo "============================================"
echo "✅ CallFlow OS успешно задеплоен!"
echo "============================================"
echo ""
echo "🌐 Приложение: http://$(hostname -I | awk '{print $1}'):80"
echo "🌐 Или:        http://77.232.128.173"
echo ""
echo "📝 Демо-доступ (после сида):"
echo "   Email: admin@demo-clinic.ru"
echo "   Пароль: demo123"
echo ""
echo "📋 Полезные команды:"
echo "   docker-compose logs -f app    # Логи приложения"
echo "   docker-compose logs -f db     # Логи PostgreSQL"
echo "   docker-compose restart        # Перезапуск"
echo "   docker-compose down           # Остановка"
echo ""
