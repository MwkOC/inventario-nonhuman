FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY manage.py ./
COPY server ./server
COPY lab ./lab
COPY --from=frontend /app/dist ./dist
RUN NONHUMAN_DEBUG=1 python manage.py collectstatic --noinput
COPY scripts/start.sh ./scripts/start.sh
RUN useradd --uid 10001 --create-home app && chown -R app:app /app
USER app
ENV NONHUMAN_DEBUG=0 DEMO_MODE=0
CMD ["sh", "scripts/start.sh"]
