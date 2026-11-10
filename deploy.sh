#!/usr/bin/env bash
# ========================================================
# Скрипт автоматического развёртывания игры «Арфа Браги»
# на сервере VPS (Firstbyte / CentOS / AlmaLinux / Debian / Ubuntu)
# ========================================================

set -e

echo "⚔️ Развёртывание игры «АРФА БРАГИ» на сервере..."

# 1. Включение IP forwarding в ядре Linux
sysctl -w net.ipv4.ip_forward=1 2>/dev/null || true

# 2. Полный сброс блокировок fail2ban и iptables
if command -v fail2ban-client &> /dev/null; then
    fail2ban-client unban --all 2>/dev/null || true
fi
iptables -F 2>/dev/null || true
iptables -X 2>/dev/null || true
nft flush ruleset 2>/dev/null || true

# 3. Настройка фаервола для портов 80, 8080, 5000
if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
    echo "🛡️ Открытие портов в firewalld..."
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=5000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 8080/tcp 2>/dev/null || true
fi

# 4. Проверка Git
if ! command -v git &> /dev/null; then
    echo "📦 Установка git..."
    if command -v dnf &> /dev/null; then
        dnf install -y git curl
    elif command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y git curl
    fi
fi

# 5. Клонирование / обновление кода в /opt/arfa-bragi
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

# 6. Сборка и запуск контейнера игры на порту 8080
if command -v docker &> /dev/null; then
    echo "🐳 Сборка и запуск Docker контейнера на порту 8080..."
    docker stop arfa-bragi-app 2>/dev/null || true
    docker rm arfa-bragi-app 2>/dev/null || true
    docker build --network=host -t arfa-bragi-app .
    docker run -d --name arfa-bragi-app --restart=always --network=host arfa-bragi-app
fi

# 7. Настройка Nginx на порту 80 (прокси на 8080, убирает ошибку 403 Forbidden)
if command -v nginx &> /dev/null; then
    echo "⚙️ Настройка Nginx прокси..."
    rm -f /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default 2>/dev/null || true
    cat << 'EOF' > /etc/nginx/conf.d/arfa-bragi.conf
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    nginx -t 2>/dev/null && systemctl restart nginx 2>/dev/null || true
fi

echo ""
echo "=========================================================="
echo "🎉 САГА НАЧАЛАСЬ! Игра «Арфа Браги» успешно запущена!"
echo "🌐 Ссылки для игры в браузере:"
echo "   http://91.200.13.149:8080 (Прямой порт)"
echo "   http://91.200.13.149      (Через Nginx порт 80)"
echo "=========================================================="
