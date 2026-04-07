# Instagram Carousel Tool

Веб-приложение для создания уникальных Instagram-каруселей на основе анализа постов конкурентов.

## Что делает приложение

1. **Анализ конкурента** — вставляешь ссылку на публичный Instagram-пост, приложение показывает карусель через embed и читает подпись
2. **Контекст / ДНК клиента** — загружаешь файл (PDF/DOCX/TXT), или подключаешь Notion / Google Docs / любой URL
3. **Генерация** — Claude AI пишет уникальный текст для каждого слайда, DALL-E 3 / Flux / Ideogram генерирует изображения
4. **Результат** — готовая карусель с текстом, хэштегами и изображениями

## Стек

- **Frontend/Backend**: Next.js 14 App Router + TypeScript
- **UI**: Tailwind CSS, тёмная тема
- **AI текст**: Claude claude-sonnet-4-6 (Anthropic)
- **AI изображения**: DALL-E 3 (OpenAI), Flux Schnell/Dev/Pro (Replicate), Ideogram v2, Stable Diffusion XL
- **БД**: Prisma ORM + Neon Serverless PostgreSQL
- **Хранилище**: Vercel Blob (prod) / локальная файловая система (dev)
- **Деплой**: Vercel (auto-deploy при каждом пуше в ветку)

## Структура проекта

```
src/
├── app/
│   ├── analyze/page.tsx           # Главная страница — пошаговый мастер создания карусели
│   ├── carousel/[id]/page.tsx     # Просмотр готовой карусели
│   ├── avatar/page.tsx            # Управление аватаром (накладывается на слайды)
│   ├── scheduled/page.tsx         # Отложенные публикации
│   ├── settings/page.tsx          # Настройки Instagram аккаунта
│   └── api/
│       ├── analyze/route.ts       # Парсинг Instagram поста (oEmbed)
│       ├── generate/route.ts      # Генерация карусели (Claude + изображения)
│       ├── fetch-context/route.ts # Загрузка контекста с URL (Notion, Google Docs)
│       ├── upload-context/route.ts# Загрузка файла (PDF/DOCX/TXT)
│       ├── carousels/route.ts     # CRUD каруселей
│       ├── post/route.ts          # Публикация в Instagram
│       ├── schedule/route.ts      # Cron для отложенных публикаций
│       ├── avatar/route.ts        # Управление аватаром
│       └── debug-key/route.ts     # Диагностика API ключей
├── lib/
│   ├── instagram-scraper.ts       # Парсинг Instagram (oEmbed + embed iframe)
│   ├── content-generator.ts       # Генерация текста через Claude API
│   ├── image-generator.ts         # Генерация изображений (6 провайдеров)
│   ├── instagram-poster.ts        # Публикация через Instagram Graph API
│   ├── storage.ts                 # Сохранение файлов (Vercel Blob / локально)
│   └── db.ts                      # Prisma клиент
└── components/
    └── Navigation.tsx             # Боковое меню
```

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/golovatskiysmm-del/Vitalii.git
cd Vitalii
git checkout claude/instagram-carousel-tool-0ZgdT
npm install
```

### 2. Переменные окружения

Создать файл `.env.local`:

```env
# Обязательно
ANTHROPIC_API_KEY=sk-ant-api03-...        # console.anthropic.com

# Для генерации изображений (хотя бы одно)
OPENAI_API_KEY=sk-...                     # platform.openai.com  (DALL-E 3)
REPLICATE_API_TOKEN=r8_...                # replicate.com        (Flux, SDXL)
IDEOGRAM_API_KEY=...                      # ideogram.ai          (Ideogram v2)

# База данных — Neon Serverless PostgreSQL
DATABASE_URL=postgresql://...             # neon.tech (pooled)
DATABASE_URL_UNPOOLED=postgresql://...    # neon.tech (direct)

# Хранилище изображений
BLOB_READ_WRITE_TOKEN=vercel_blob_...     # Vercel Storage → Blob

# Instagram автопостинг (опционально)
INSTAGRAM_ACCESS_TOKEN=...               # Facebook Developers → Graph API
INSTAGRAM_ACCOUNT_ID=...
```

### 3. База данных

```bash
npx prisma generate
npx prisma db push
```

### 4. Запуск локально

```bash
npm run dev
# → http://localhost:3000
```

## Деплой на Vercel

1. Форкнуть репозиторий на GitHub
2. Vercel → New Project → Import → выбрать репозиторий
3. Добавить все переменные окружения (см. выше)
4. Подключить Neon Postgres: Vercel → Storage → Create Database → Neon
5. Deploy

Каждый пуш в ветку `claude/instagram-carousel-tool-0ZgdT` → автодеплой.

## Провайдеры генерации изображений

| Провайдер | Env переменная | Качество | Цена |
|---|---|---|---|
| DALL-E 3 | `OPENAI_API_KEY` | ★★★★☆ | ~$0.04/img |
| Flux Schnell | `REPLICATE_API_TOKEN` | ★★★☆☆ | ~$0.003/img |
| Flux Dev | `REPLICATE_API_TOKEN` | ★★★★☆ | ~$0.025/img |
| Flux 1.1 Pro | `REPLICATE_API_TOKEN` | ★★★★★ | ~$0.04/img |
| Ideogram v2 | `IDEOGRAM_API_KEY` | ★★★★★ | ~$0.08/img |
| Stable Diffusion XL | `REPLICATE_API_TOKEN` | ★★★☆☆ | ~$0.002/img |

## Известные ограничения

- **Instagram изображения**: Instagram блокирует серверный доступ к медиафайлам с облачных IP (Vercel/AWS). Карусель конкурента показывается через официальный iframe embed. Для получения реальных CDN URL слайдов нужна интеграция с Instagram Graph API (Facebook App + User Access Token).
- **Notion**: страница должна быть публичной (Share → Publish to web)
- **Google Docs**: документ открыт «для всех по ссылке»
- **Cron на Vercel Hobby**: только ежедневный (0 9 * * *)

## Что можно доработать

- [ ] Instagram Graph API — получение реальных изображений карусели
- [ ] Редактор слайдов с drag-and-drop и текстом поверх изображений
- [ ] Поддержка нескольких Instagram аккаунтов
- [ ] Календарь публикаций
- [ ] Аналитика постов
- [ ] Экспорт карусели в PDF / ZIP
- [ ] Шаблоны стилей оформления
