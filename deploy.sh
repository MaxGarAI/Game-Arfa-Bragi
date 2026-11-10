#!/usr/bin/env bash
# ========================================================
# Скрипт автоматического развёртывания игры «Арфа Браги»
# на сервере VPS (Firstbyte / CentOS / AlmaLinux / Debian / Ubuntu)
# ========================================================

set -e

echo "⚔️ Развёртывание игры «АРФА БРАГИ» на сервере..."

# 1. Включение IP forwarding в ядре Linux (нужно для Docker сетей)
sysctl -w net.ipv4.ip_forward=1 2>/dev/null || true

# 2. Настройка фаервола (firewalld / ufw) для работы сети
if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
    echo "🛡️ Настройка firewalld..."
    firewall-cmd --zone=trusted --add-interface=docker0 --permanent 2>/dev/null || true
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=5000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 5000/tcp 2>/dev/null || true
fi

# 3. Разблокировка IP в fail2ban
if command -v fail2ban-client &> /dev/null; then
    fail2ban-client unban --all 2>/dev/null || true
fi
iptables -D INPUT -s 91.238.88.24 -j DROP 2>/dev/null || true
iptables -D INPUT -s 91.238.88.24 -j REJECT 2>/dev/null || true

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

# 6. Сборка и запуск
DEPLOYED=0

# Вариант А: Запуск через Docker с --network=host
if command -v docker &> /dev/null; then
    echo "🐳 Сборка Docker контейнера с прямым доступом к сети (--network=host)..."
    if docker build --network=host -t arfa-bragi-app .; then
        echo "🚀 Запуск Docker контейнера..."
        docker stop arfa-bragi-app 2>/dev/null || true
        docker rm arfa-bragi-app 2>/dev/null || true
        docker run -d --name arfa-bragi-app --restart=always --network=host arfa-bragi-app
        DEPLOYED=1
    fi
fi

# Вариант Б: Запуск напрямую через Python venv и systemd (если Docker недоступен)
if [ $DEPLOYED -eq 0 ]; then
    echo "🐍 Запуск напрямую через Python 3 и systemd сервис..."
    if command -v dnf &> /dev/null; then
        dnf install -y python3 python3-pip
    elif command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y python3 python3-venv python3-pip
    fi

    python3 -m venv "$APP_DIR/venv"
    "$APP_DIR/venv/bin/pip" install --no-cache-dir -i https://mirror.yandex.ru/pypi/simple --extra-index-url https://pypi.org/simple -r requirements.txt
    "$APP_DIR/venv/bin/python" seed.py

    cat <<EOF > /etc/systemd/system/arfa-bragi.service
[Unit]
Description=Arfa Bragi Viking Brewery Game
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/gunicorn --bind 0.0.0.0:80 --workers 2 --threads 4 app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now arfa-bragi
    systemctl restart arfa-bragi
    DEPLOYED=1
fi

echo ""
echo "=========================================================="
echo "🎉 САГА НАЧАЛАСЬ! Игра «Арфа Браги» успешно запущена!"
echo "🌐 Играть прямо в браузере:"
echo "   http://91.200.13.149"
echo "=========================================================="
