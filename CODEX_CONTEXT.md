# Sendout Dashboard: контекст для Codex

## Исходное задание

Сделать локальный dashboard для анализа sendout-данных из Excel/CSV файлов:

- импортировать несколько файлов;
- сохранять импортированные данные, чтобы не загружать файлы каждый раз заново;
- удалять данные не только полностью, но и по конкретному импортированному файлу;
- показывать KPI, графики и таблицу сравнения компаний/campaign templates;
- дать возможность экспортировать результаты в DOC/PPTX.

## Важные правила данных

- Файлы могут быть `.xlsx` или `.csv`.
- Данные сохраняются в `localStorage`.
- Каждая импортированная строка получает `sourceFileId` и `sourceFileName`.
- Удаление файла удаляет только строки с этим `sourceFileId`.
- CSV/Excel rate-колонки (`Open R%`, `Click R%`, `CTOR%`, `Open Rate`, `Click Rate`) имеют приоритет над пересчетом из gross-счетчиков.
- Числа вида `"2,734"` должны парситься как `2734`, а не `2.734`.
- Пустая open-метрика отличается от реального нуля.
- SMS campaign сейчас определяется только по явному SMS-тексту в названии/строке. Нулевой `opens`, нулевой `open rate` или отсутствие open-сигналов сами по себе не означают SMS; пользователь позже даст новое правило для разделения Email/SMS.

## Добавленные фичи

- Импорт нескольких `.xlsx` и `.csv` файлов.
- Список импортированных файлов в сайдбаре.
- Удаление данных конкретного файла.
- Persist в `localStorage`.
- Защита от повторного импорта того же файла.
- Фильтры:
  - Date Range;
  - Product;
  - Market;
  - Template / Company;
  - Sent Volume min/max.
- KPI:
  - Total Sent;
  - Total Delivered;
  - Delivery Rate;
  - Open Rate;
  - Click Rate;
  - CTOR.
- Графики:
  - Conversion Funnel as a custom canvas funnel with left-side channel metrics; funnel change is represented by segment height, not by data-scaled width.
  - Daily Performance with Open Rate, Click Rate and CTOR;
  - Week-over-week Change;
  - Top 10 Campaigns by Click Rate;
  - Top 10 Campaigns by CTOR;
  - Sent Volume by Market;
  - Click Rate by Market;
  - Product Performance;
  - Delivery Rate Over Time;
  - Top 10 Campaigns by Efficiency Score;
  - Market x Product Heatmap;
  - Volume vs Engagement by campaign, using delivered volume vs CTOR in a red editorial scatter style;
  - Performance by Campaign Group with Open Rate, Click Rate bars and CTOR line;
  - Channel Split;
  - Best / Worst Campaigns;
  - Repeat Campaign Tracking.
- Weekly/WoW comparison charts use compact caption chips below the chart instead of noisy labels on chart lines.
- Canvas charts have actions to enlarge the chart and copy it as a PNG image; if clipboard access is blocked, PNG download is used as fallback.
- Chart copy/zoom uses a composed high-resolution PNG with chart title/subtitle and a white background; DOC/PPTX export uses high-resolution chart images without duplicating titles inside the image.
- KPI metrics copy uses a high-resolution PNG table image; text TSV copy is only a fallback when image clipboard access is unavailable.
- `Week-over-week Change` is a custom canvas table with rows for Delivery Rate, Open Rate, Click Rate and CTOR, showing Start value, End value, Range pp change from first selected week to last selected week, a sparkline and a mini weekly pp-change table using week numbers (`W18`, `W19`, etc.). The first visible week is shown as a `0.0` baseline cell; subsequent cells show week-to-week pp deltas. Volume deltas like `Sent %`/`Delivered %` stay hidden because they can reach thousands of percent.
- A small disclaimer under `Week-over-week Change` explains that Start/End are total weighted averages for the selected range, while weekly cells show week-to-week pp changes.
- Campaign group charts keep semantic groups like Underperforming MTD, Risk of Churn, Retention and Reactivation. `VIP`/`CRM` are handled by a separate Audience filter, not as campaign groups.
- Added `Top 3 Campaigns by Overall Performance` as a custom canvas podium using Open Rate, Click Rate and CTOR. It now uses a presentation-style UI with medal cards, shaded platforms, compact campaign names and separated metric panels.
- Top summary uses two side-by-side panels: a red `METRIC / RESULT` table with SVG-style red icons and Sent, Delivered, Unique Opens, Unique Clicks, Delivery Rate, Open Rate, CTR and CTOR; and a red `Performance Funnel` canvas with segment labels inside and values/rates on the right.
- Layout preference: `Week-over-week Change` sits next to `Daily Performance`; `Product Performance` sits next to `Market x Product Heatmap`.
- DOC export now includes charts as images and weekly comparison, not the full company list.
- Export presets:
  - Summary DOC;
  - Summary PPTX;
  - Weekly DOC;
  - Deep Dive DOC.

## Убранные фичи

- Removed `Open Rate vs Click Rate` scatter chart.
- Removed the large `Weekly KPI Comparison` chart from the dashboard layout.
- Removed full Company Comparison table from DOC export.

## Recent UI/UX Notes

- Filter selections persist in `localStorage` under `sendiq_filters_v1` and are restored on reload; selected values are pruned only if they no longer exist in the loaded data.
- Mobile layout has a floating burger button that opens the sidebar as a drawer with an overlay.
- Multi-select filter dropdowns stay open while checking/unchecking options, so several values can be selected in one pass.
- Best/Worst Campaigns tables include separate CSS medal top-3 boards above each table, with Copy image and Download PNG actions for the ranking graphics; the calendar uses modern dark styling and starts weeks on Monday.
- Best/Worst Campaigns do not apply the 50 delivered threshold; they rank the currently filtered campaign set directly by Click Rate.
- Campaign Group Performance value labels use collision-aware placement with a subtle white background so close percentages do not overlap.
- Campaign Group Performance uses one shared percentage scale for all metrics, mirrored on the right side for readability.
- Top 3 Overall Campaigns does not apply the 50 delivered threshold; it ranks the currently filtered campaign set directly by efficiency score so filtered low-volume VIP campaigns can appear in the podium.

## Технические заметки

- Проект сейчас состоит из:
  - `index.html`;
  - `styles.css`;
  - `script.js`.
- Внешние зависимости подключаются через CDN:
  - SheetJS;
  - Chart.js;
  - Flatpickr.
- Node.js на машине не найден, поэтому `node --check script.js` не запускался.
- В проекте есть следы старой поврежденной кодировки в некоторых символах UI (`â...`). Это отдельная косметическая проблема.
