# Dockerfile

# use python 3.11 slim as base image
FROM python:3.11-slim

# set environment variables to avoid writing .pyc files and to stream logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# install system dependencies for building packages and postgres support
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        postgresql-server-dev-all \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# set working directory inside the container
WORKDIR /app

# copy requirements first to leverage Docker cache
COPY requirements.txt /app/

# install python dependencies
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# copy application code
COPY . /app/

# configure celery to use redis broker (if you add a redis service)
ENV CELERY_BROKER_URL=redis://redis:6379/0
ENV CELERY_RESULT_BACKEND=redis://redis:6379/0

# run migrations, collect static, then start gunicorn
CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn EeriecastDjango.wsgi:application --bind 0.0.0.0:8000"]
