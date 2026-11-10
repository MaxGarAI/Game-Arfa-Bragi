#!/usr/bin/env bash
# ========================================================
# Скрипт автоматического развёртывания игры «Арфа Браги»
# на сервере VPS (Firstbyte / Ubuntu / Debian)
# ========================================================

set -e

echo "⚔️ Развёртывание игры «АРФА БРАГИ» на сервере..."

# 1. Проверка наличия Git
if ! command -v git &> /dev/null; then
    echo "📦 Установка git..."
    apt-get update && apt-get install -y git curl
fi

# 2. Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker не найден, устанавливаем Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# 3. Разблокировка IP в fail2ban (если IP был заблокирован из-за ошибок ввода пароля)
if command -v fail2ban-client &> /dev/null; then
    echo "🛡️ Проверка fail2ban..."
    fail2ban-client unban 91.238.88.24 2>/dev/null || true
    fail2ban-client unban --all 2>/dev/null || true
fi

# 4. Переход в директорию проекта
APP_DIR="/opt/arfa-bragi"
if [ ! -d "$APP_DIR" ]; then
    echo "📥 Клонирование репозитория в $APP_DIR..."
    git clone https://github.com/MaxGarAI/Game-Arfa-Bragi.git "$APP_DIR"
    cd "$APP_DIR"
else
    echo "🔄 Обновление репозитория в $APP_DIR..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
fi

# 5. Запуск через Docker Compose
echo "🚀 Сборка и запуск контейнера игры..."
if docker compose version &> /dev/null; then
    docker compose down 2>/dev/null || true
    docker compose up -d --build
else
    docker-compose down 2>/dev/null || true
    docker-compose up -d --build
fi

# 6. Открытие портов в ufw/iptables (если включен фаервол)
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 5000/tcp 2>/dev/null || true
fi

echo ""
echo "=========================================================="
echo "🎉 САГА НАЧАЛАСЬ! Игра «Арфа Браги» успешно запущена!"
echo "🌐 Играть прямо в браузере:"
echo "   http://91.200.13.149"
echo "   http://91.200.13.149:5000"
echo "=========================================================="
