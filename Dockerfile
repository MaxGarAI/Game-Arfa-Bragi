FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .

# Install dependencies using high-speed Yandex PyPI mirror in Russia (with official PyPI fallback)
RUN pip install --no-cache-dir --prefer-binary \
    -i https://mirror.yandex.ru/pypi/simple \
    --extra-index-url https://pypi.org/simple \
    -r requirements.txt

COPY . .

# Initialize and seed database with bots and craft beers
RUN python seed.py

EXPOSE 80 5000

# Start with Gunicorn on port 80 (accessible directly in browser without :5000)
CMD ["gunicorn", "--bind", "0.0.0.0:80", "--workers", "2", "--threads", "4", "app:app"]
