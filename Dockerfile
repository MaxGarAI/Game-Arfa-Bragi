FROM python:3.12-slim

WORKDIR /app

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Copy requirements and install (pure Python wheels, no gcc/apt needed!)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Initialize and seed database with beer catalog and bots
RUN python seed.py

# Expose game port
EXPOSE 5000

# Start with production-grade Gunicorn WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "120", "app:app"]
