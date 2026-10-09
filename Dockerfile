FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
COPY . .

# اگه wheels هست از لوکال نصب کن، وگرنه از PyPI
RUN if [ -d /app/wheels ] && [ -n "$(ls -A /app/wheels 2>/dev/null)" ]; then \
        echo "📦 Installing from local wheels..."; \
        pip install --no-cache-dir --no-index --find-links=/app/wheels -r requirements.txt; \
    else \
        echo "🌐 Installing from PyPI..."; \
        pip install --no-cache-dir -r requirements.txt; \
    fi

EXPOSE 5050

CMD ["python", "manage.py", "runserver", "0.0.0.0:5050"]
