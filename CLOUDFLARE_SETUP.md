# Одноразовая настройка Cloudflare

Приложение рассчитано на бесплатный Cloudflare Workers Free. В пользовательском интерфейсе нет API-адреса и PIN: после публикации ссылка с #w=... является рабочей областью. Её нужно один раз скопировать на телефон.

## Что создаётся

- Cloudflare Pages — публикует index.html и Pages Functions.
- D1 — хранит профиль, клиентов, услуги, черновик и индекс PDF.
- Workers KV — хранит сами PDF-файлы.

## Настройка через Cloudflare Dashboard

1. В Cloudflare открыть **Workers & Pages → Create application → Pages → Connect to Git**.
2. Выбрать репозиторий `AndrewKuchik/flora-rekini`, production branch `master`.
3. Оставить build command пустым, папку вывода — корень проекта (`/`), затем сделать первый deploy.
4. В **Workers & Pages → D1 → Create database** создать базу `flora-rekini`.
5. В консоли D1 выполнить SQL из файла `schema.sql`.
6. В **Workers & Pages → KV → Create namespace** создать namespace, например `FLORA_PDF_FILES`.
7. В Pages project открыть **Settings → Bindings**:
   - добавить D1 binding с переменным именем `DB`;
   - добавить KV binding с переменным именем `PDF_FILES`.
8. Сделать новый deploy. Pages Functions из папки `functions/` начнут обслуживать `/api/state` и `/api/pdf/...`.

После этого открыть адрес Pages-сайта. Приложение само добавит к ссылке рабочую область. Нажать «Копировать ссылку для телефона» и открыть скопированную ссылку на другом устройстве.

## Бесплатность и ограничения

На Workers Free действуют дневные лимиты запросов и операций хранения. При превышении бесплатных лимитов запросы будут временно отклоняться до сброса лимита; платный тариф не включается автоматически. PDF ограничены текущим лимитом KV в 25 MiB на один объект.
