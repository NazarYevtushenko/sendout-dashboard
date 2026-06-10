/**
 * ============================================================
 * SendIQ — Sendout Analytics Dashboard
 * script.js — Core application logic
 * ============================================================
 */

'use strict';

/* ============================================================
   1. COLUMN MAPPING
   Maps every known header variant → canonical field name
   ============================================================ */

const COLUMN_MAP = {
  // Date
  'date': 'date',
  'first in range': 'date',

  // Template / Company
  'template name': 'template',
  'templates': 'template',
  'action name': 'template',
  'campaign name': 'template',
  'campaign': 'template',
  'name': 'template',

  // Product
  'product': 'product',

  // Market
  'market': 'market',
  'country': 'market',

  // Sent
  'sent': 'sent',
  'sms - sent': 'sent',
  'targeted customers': 'sent',
  'recipients': 'sent',
  'total recipients': 'sent',

  // Delivered
  'delivered': 'delivered',
  'sms - delivered': 'delivered',

  // Opens
  'unique opens': 'opens',
  'opens': 'opens',
  'gross opens': 'opens',
  'opened': 'opens',

  // Clicks
  'unique clicks': 'clicks',
  'clicks': 'clicks',
  'gross clicks': 'clicks',
  'clicked': 'clicks',
  'sms - clicked': 'clicks',

  // Open Rate
  'open rate': 'openRate',
  'open r%': 'openRate',
  'avg open rate': 'openRate',

  // Click Rate
  'click rate': 'clickRate',
  'click r%': 'clickRate',
  'sms - click rate': 'clickRate',
  'avg click rate': 'clickRate',

  // CTOR
  'ctor %': 'ctor',
  'ctor%': 'ctor',
  'ctor': 'ctor',
  'click to open rate': 'ctor',
  'avg ctor': 'ctor',

  // Delivery Rate
  'delivery rate': 'deliveryRate',
  'delivery r%': 'deliveryRate',
};

function normaliseRow(rawRow, headerMap) {
  const rec = {
    date: null,
    template: null,
    product: null,
    market: null,
    channel: null,
    sent: 0,
    delivered: 0,
    opens: 0,
    clicks: 0,
    openRate: null,
    clickRate: null,
    ctor: null,
    deliveryRate: null,
    hasOpens: false,
    hasClicks: false,
    hasOpenRate: false,
    hasClickRate: false,
    hasCtor: false,
  };

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const key = String(rawKey).trim().toLowerCase();
    const canon = headerMap[key];
    if (!canon) continue;

    if (value === null || value === undefined || String(value).trim() === '') continue;

    if (canon === 'date') {
      if (value instanceof Date) {
        rec.date = formatDate(value);
      } else if (typeof value === 'number') {
        const jsDate = excelSerialToDate(value);
        rec.date = formatDate(jsDate);
      } else {
        const str = String(value).trim();
        rec.date = str.includes('T') ? str.split('T')[0] : str;
      }
    } else if (['sent', 'delivered', 'opens', 'clicks'].includes(canon)) {
      rec[canon] = parseNumber(value);
      if (canon === 'opens') rec.hasOpens = true;
      if (canon === 'clicks') rec.hasClicks = true;
    } else if (['openRate', 'clickRate', 'ctor', 'deliveryRate'].includes(canon)) {
      const num = parseNumber(value);
      rec[canon] = isNaN(num) ? null : num;
      if (canon === 'openRate') rec.hasOpenRate = true;
      if (canon === 'clickRate') rec.hasClickRate = true;
      if (canon === 'ctor') rec.hasCtor = true;
    } else {
      rec[canon] = String(value).trim();
    }
  }

  if (!rec.date && !rec.template && !rec.sent && !rec.delivered && !rec.opens && !rec.clicks) {
    return null;
  }

  if (!rec.date) return null;
  if (!rec.template) return null;

  if (/^template name$/i.test(rec.template)) return null;
  if (/^grand total:?$/i.test(rec.template)) return null;
  if (/^total:?$/i.test(rec.template)) return null;
  if (isSummaryRecord(rec)) return null;

  if (!rec.product) rec.product = '(Unknown)';
  if (!rec.market) rec.market = '(Unknown)';

  rec.product = normaliseProduct(rec.product);
  rec.market = normaliseMarket(rec.market);
  rec.channel = inferChannel(rawRow, rec);

  if (!rec.delivered && rec.sent) {
    rec.delivered = rec.sent;
  }

  ['openRate', 'clickRate', 'ctor', 'deliveryRate'].forEach(k => {
    if (rec[k] !== null && rec[k] <= 1) {
      rec[k] = rec[k] * 100;
    }
  });

  return rec;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  let s = String(value).trim();
  if (!s) return 0;

  s = s.replace('%', '').replace(/\s/g, '');

  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  } else if (/^-?\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function isSummaryRecord(rec) {
  const text = [rec.template, rec.product, rec.market]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('grand total') ||
    text.includes('total campaigns') ||
    text.includes('total recipients') ||
    text.includes('delivery rate:') ||
    text.includes('avg click rate') ||
    text.includes('avg open rate') ||
    text.includes('avg ctor') ||
    text.trim() === 'total'
  );
}

function normaliseProduct(value) {
  const raw = String(value || '').trim();
  const v = raw.toLowerCase();

  if (v === 'casino') return 'Casino';
  if (v === 'sport' || v === 'sports') return 'Sport';
  if (v === 'poker') return 'Poker';
  if (v === 'app') return 'APP';

  return raw || '(Unknown)';
}

function normaliseMarket(value) {
  const raw = String(value || '').trim();
  const v = raw.toLowerCase();

  if (v === 'latvia' || v === 'lv') return 'LV';
  if (v === 'estonia' || v === 'ee') return 'EE';
  if (v === 'finland' || v === 'fi' || v === 'eu') return 'EU';
  if (v === 'sweden' || v === 'se') return 'SE';

  return raw ? raw.toUpperCase() : '(Unknown)';
}

function inferChannel(rawRow, rec) {
  const headerText = Object.keys(rawRow).join(' ').toLowerCase();
  const rowText = [
    rec.template,
    rec.product,
    rec.market,
    ...Object.values(rawRow).slice(0, 8),
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    headerText.includes('sms -') ||
    rowText.includes(' sms ') ||
    rowText.startsWith('sms ') ||
    rowText.includes('/ sms') ||
    rowText.includes('sms promo')
  ) {
    return 'SMS';
  }

  return 'Email';
}

function inferStoredChannel(record) {
  const text = [record.template, record.product, record.market].filter(Boolean).join(' ').toLowerCase();
  return text.includes('sms') ? 'SMS' : 'Email';
}

function excelSerialToDate(serial) {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseXlsxBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parseWorkbook(workbook);
}

function parseCsvText(text) {
  const workbook = XLSX.read(text, { type: 'string', cellDates: true });
  return parseWorkbook(workbook);
}

function parseWorkbook(workbook) {
  const allRecords = [];

  workbook.SheetNames.forEach(sheetName => {
    const ws = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
    if (!rows.length) return;

    const headerMap = {};
    Object.keys(rows[0]).forEach(rawKey => {
      const key = String(rawKey).trim().toLowerCase();
      const canon = COLUMN_MAP[key];
      if (canon) headerMap[key] = canon;
    });

    rows.forEach(row => {
      const rec = normaliseRow(row, headerMap);
      if (rec) allRecords.push(rec);
    });
  });

  return allRecords;
}

/* ============================================================
   2. STORAGE
   ============================================================ */

const STORAGE_KEY = 'sendiq_records_v2';
const STORAGE_FILES_KEY = 'sendiq_imported_files_v1';
const STORAGE_DEMO_DISABLED_KEY = 'sendiq_demo_disabled_v1';
const STORAGE_FILTERS_KEY = 'sendiq_filters_v1';

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records)
      ? records.map(r => ({ ...r, channel: inferStoredChannel(r) }))
      : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('localStorage quota exceeded; data not persisted.', e);
  }
}

function loadImportedFiles() {
  try {
    const raw = localStorage.getItem(STORAGE_FILES_KEY);
    const files = raw ? JSON.parse(raw) : [];
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

function saveImportedFiles(files) {
  try {
    localStorage.setItem(STORAGE_FILES_KEY, JSON.stringify(files));
  } catch (e) {
    console.warn('Imported file list was not persisted.', e);
  }
}

function saveAllState() {
  saveRecords(allRecords);
  saveImportedFiles(importedFiles);
}

function mergeRecords(existing, incoming) {
  const makeKey = r => [
    r.sourceFileId || '',
    r.date,
    r.template,
    r.product,
    r.market,
    r.sent,
    r.delivered,
    r.opens,
    r.clicks,
  ].join('|');
  const seen = new Set(existing.map(makeKey));
  const merged = [...existing];
  let added = 0;

  for (const rec of incoming) {
    const k = makeKey(rec);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(rec);
      added++;
    }
  }

  return { merged, added };
}

/* ============================================================
   3. GLOBAL STATE
   ============================================================ */

let allRecords = [];
let filteredRecords = [];
let importedFiles = [];
let usingDemoData = false;

let filterState = createEmptyFilterState();

let tableSortCol = 'sent';
let tableSortDir = 'desc';
let tableSearch = '';

function createEmptyFilterState() {
  return {
    dateFrom: null,
    dateTo: null,
    products: new Set(),
    markets: new Set(),
    audiences: new Set(),
    templates: new Set(),
    sentMin: null,
    sentMax: null,
  };
}

function serialiseFilterState() {
  return {
    dateFrom: filterState.dateFrom,
    dateTo: filterState.dateTo,
    products: [...filterState.products],
    markets: [...filterState.markets],
    audiences: [...filterState.audiences],
    templates: [...filterState.templates],
    sentMin: filterState.sentMin,
    sentMax: filterState.sentMax,
  };
}

function hydrateFilterState(saved) {
  if (!saved || typeof saved !== 'object') return createEmptyFilterState();
  const toSet = value => new Set(Array.isArray(value) ? value.filter(v => v !== null && v !== undefined) : []);
  const toNumberOrNull = value => {
    const n = value === '' || value === null || value === undefined ? null : Number(value);
    return n !== null && !isNaN(n) ? n : null;
  };

  return {
    dateFrom: saved.dateFrom || null,
    dateTo: saved.dateTo || null,
    products: toSet(saved.products),
    markets: toSet(saved.markets),
    audiences: toSet(saved.audiences),
    templates: toSet(saved.templates),
    sentMin: toNumberOrNull(saved.sentMin),
    sentMax: toNumberOrNull(saved.sentMax),
  };
}

function loadFilterState() {
  try {
    const raw = localStorage.getItem(STORAGE_FILTERS_KEY);
    return hydrateFilterState(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.warn('Could not load saved filters.', e);
    return createEmptyFilterState();
  }
}

function saveFilterState() {
  try {
    localStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(serialiseFilterState()));
  } catch (e) {
    console.warn('Could not persist filters.', e);
  }
}

function pruneSavedFilters(options) {
  const keepExisting = (selectedSet, validValues) => {
    const valid = new Set(validValues);
    return new Set([...selectedSet].filter(value => valid.has(value)));
  };

  filterState.products = keepExisting(filterState.products, options.products);
  filterState.markets = keepExisting(filterState.markets, options.markets);
  filterState.audiences = keepExisting(filterState.audiences, options.audiences);
  filterState.templates = keepExisting(filterState.templates, options.templates);
}

/* ============================================================
   4. DATA PIPELINE
   ============================================================ */

function applyFilters() {
  filteredRecords = allRecords.filter(r => {
    if (filterState.dateFrom && r.date < filterState.dateFrom) return false;
    if (filterState.dateTo && r.date > filterState.dateTo) return false;

    if (filterState.products.size && !filterState.products.has(r.product)) return false;
    if (filterState.markets.size && !filterState.markets.has(r.market)) return false;
    if (filterState.audiences.size && !filterState.audiences.has(inferAudience(r.template))) return false;
    if (filterState.templates.size && !filterState.templates.has(r.template)) return false;
    if (filterState.sentMin !== null && r.sent < filterState.sentMin) return false;
    if (filterState.sentMax !== null && r.sent > filterState.sentMax) return false;

    return true;
  });
}

function weightedAverageRate(records, rateField, weightField) {
  let weightedTotal = 0;
  let weightTotal = 0;

  records.forEach(r => {
    const rate = r[rateField];
    const weight = r[weightField] || 0;

    if (rate !== null && rate !== undefined && isFinite(rate) && weight > 0) {
      weightedTotal += rate * weight;
      weightTotal += weight;
    }
  });

  return weightTotal ? weightedTotal / weightTotal : null;
}

function hasAny(records, flag) {
  return records.some(r => r[flag]);
}

function aggregate(records) {
  const totalSent = records.reduce((s, r) => s + r.sent, 0);
  const totalDelivered = records.reduce((s, r) => s + r.delivered, 0);
  const totalOpens = records.reduce((s, r) => s + r.opens, 0);
  const totalClicks = records.reduce((s, r) => s + r.clicks, 0);

  const deliveryRate = totalSent ? (totalDelivered / totalSent) * 100 : 0;
  const openRate = weightedAverageRate(records, 'openRate', 'delivered')
    ?? (hasAny(records, 'hasOpens') && totalDelivered ? (totalOpens / totalDelivered) * 100 : null);
  const clickRate = weightedAverageRate(records, 'clickRate', 'delivered')
    ?? (hasAny(records, 'hasClicks') && totalDelivered ? (totalClicks / totalDelivered) * 100 : null);
  const ctor = weightedAverageRate(records, 'ctor', 'opens')
    ?? (hasAny(records, 'hasOpens') && hasAny(records, 'hasClicks') && totalOpens ? (totalClicks / totalOpens) * 100 : null);

  return {
    totalSent,
    totalDelivered,
    totalOpens,
    totalClicks,
    deliveryRate,
    openRate,
    clickRate,
    ctor,
  };
}

/* ============================================================
   5. UI — KPI CARDS
   ============================================================ */

function updateKPIs() {
  const {
    totalSent,
    totalDelivered,
    totalOpens,
    totalClicks,
    deliveryRate,
    openRate,
    clickRate,
    ctor,
  } = aggregate(filteredRecords);

  setText('kpiSent', fmtNum(totalSent));
  setText('kpiDelivered', fmtNum(totalDelivered));
  setText('kpiOpens', fmtNum(totalOpens));
  setText('kpiClicks', fmtNum(totalClicks));
  setText('kpiDeliveryRate', fmtPct(deliveryRate));
  setText('kpiOpenRate', fmtPct(openRate));
  setText('kpiClickRate', fmtPct(clickRate));
  setText('kpiCtor', fmtPct(ctor));

  setText('recordCount', `${filteredRecords.length.toLocaleString()} records`);
}

/* ============================================================
   6. UI — FUNNEL CHART
   ============================================================ */

let funnelChart = null;
let wowChangeChart = null;
let sizePerformanceChart = null;
let channelSplitChart = null;
let topOverallCampaignsChart = null;
let campaignGroupPerformanceChart = null;
let customCanvasResizeTimer = null;

function updateFunnelChart() {
  const { totalSent, totalDelivered, totalOpens, totalClicks, deliveryRate, openRate, clickRate } = aggregate(filteredRecords);
  const canvas = document.getElementById('funnelChart');
  if (!canvas) return;

  funnelChart = {
    sent: totalSent,
    delivered: totalDelivered,
    opened: totalOpens,
    clicked: totalClicks,
    deliveryRate,
    openRate,
    clickRate,
  };

  drawFunnelCanvas(canvas, funnelChart);
}

function drawFunnelCanvas(canvas, values) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 640));
  const height = Math.max(290, Math.floor(rect.height || canvas.clientHeight || 310));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  const stages = [
    { label: 'SENT', value: values.sent, rate: null, color: '#c40000' },
    { label: 'DELIVERED', value: values.delivered, rate: values.deliveryRate, color: '#df2020' },
    { label: 'UNIQUE OPENS', value: values.opened, rate: values.openRate, color: '#f15b5b' },
    { label: 'UNIQUE CLICKS', value: values.clicked, rate: values.clickRate, color: '#fb7b7b' },
  ];

  const titleW = Math.min(260, width * 0.42);
  const titleX = (width - titleW) / 2;
  ctx.fillStyle = '#c40000';
  roundedRect(ctx, titleX, 8, titleW, 34, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = "700 15px 'DM Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PERFORMANCE FUNNEL', width / 2, 25);

  const funnelTop = 58;
  const funnelHeight = height - 82;
  const segmentGap = 4;
  const segmentHeight = (funnelHeight - segmentGap * (stages.length - 1)) / stages.length;
  const funnelCenter = width * 0.43;
  const topWidth = Math.min(430, width * 0.68);
  const bottomWidth = topWidth * 0.42;
  const valueX = Math.min(width - 92, funnelCenter + topWidth / 2 + 28);
  const widthAtIndex = index => topWidth - (topWidth - bottomWidth) * (index / stages.length);

  stages.forEach((stage, index) => {
    const y1 = funnelTop + index * (segmentHeight + segmentGap);
    const y2 = y1 + segmentHeight;
    const topW = widthAtIndex(index);
    const bottomW = widthAtIndex(index + 1);

    ctx.beginPath();
    ctx.moveTo(funnelCenter - topW / 2, y1);
    ctx.lineTo(funnelCenter + topW / 2, y1);
    ctx.lineTo(funnelCenter + bottomW / 2, y2);
    ctx.lineTo(funnelCenter - bottomW / 2, y2);
    ctx.closePath();
    ctx.fillStyle = stage.color;
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = "700 15px 'DM Sans', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(stage.label, funnelCenter - topW * 0.18, y1 + segmentHeight / 2);

    if (index > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(funnelCenter - topW * 0.28, y1 - 10);
      ctx.lineTo(funnelCenter - topW * 0.28, y1 + 12);
      ctx.stroke();
      ctx.fillText('v', funnelCenter - topW * 0.28 - 4, y1 + 18);
    }

    ctx.fillStyle = '#172033';
    ctx.font = "700 17px 'DM Sans', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(fmtNum(stage.value), valueX, y1 + segmentHeight / 2 - (stage.rate === null ? 0 : 8));

    if (stage.rate !== null) {
      ctx.font = "400 12px 'DM Sans', sans-serif";
      ctx.fillStyle = '#6b6660';
      ctx.fillText(fmtPct(stage.rate), valueX, y1 + segmentHeight / 2 + 12);
    }
  });
}

function drawDottedLine(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function percentOf(value, total) {
  return total ? (value / total) * 100 : 0;
}

/* ============================================================
   7. UI — TREND CHART
   ============================================================ */

let trendChart = null;

function updateTrendChart() {
  const byDate = {};

  filteredRecords.forEach(r => {
    if (!r.date) return;

    if (!byDate[r.date]) {
      byDate[r.date] = {
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        openRateWeightedTotal: 0,
        openRateWeight: 0,
        clickRateWeightedTotal: 0,
        clickRateWeight: 0,
        ctorWeightedTotal: 0,
        ctorWeight: 0,
        hasOpens: false,
        hasClicks: false,
      };
    }

    byDate[r.date].sent += r.sent;
    byDate[r.date].delivered += r.delivered;
    byDate[r.date].opens += r.opens;
    byDate[r.date].clicks += r.clicks;
    byDate[r.date].hasOpens = byDate[r.date].hasOpens || !!r.hasOpens;
    byDate[r.date].hasClicks = byDate[r.date].hasClicks || !!r.hasClicks;

    if (r.openRate !== null && r.openRate !== undefined && isFinite(r.openRate) && r.delivered > 0) {
      byDate[r.date].openRateWeightedTotal += r.openRate * r.delivered;
      byDate[r.date].openRateWeight += r.delivered;
    }

    if (r.clickRate !== null && r.clickRate !== undefined && isFinite(r.clickRate) && r.delivered > 0) {
      byDate[r.date].clickRateWeightedTotal += r.clickRate * r.delivered;
      byDate[r.date].clickRateWeight += r.delivered;
    }

    if (r.ctor !== null && r.ctor !== undefined && isFinite(r.ctor) && r.opens > 0) {
      byDate[r.date].ctorWeightedTotal += r.ctor * r.opens;
      byDate[r.date].ctorWeight += r.opens;
    }
  });

  const dates = Object.keys(byDate).sort();

  const openRates = dates.map(d => {
    const g = byDate[d];
    const rate = g.openRateWeight ? (g.openRateWeightedTotal / g.openRateWeight) : (g.hasOpens && g.delivered ? (g.opens / g.delivered * 100) : 0);
    return +rate.toFixed(2);
  });

  const clickRates = dates.map(d => {
    const g = byDate[d];
    const rate = g.clickRateWeight ? (g.clickRateWeightedTotal / g.clickRateWeight) : (g.hasClicks && g.delivered ? (g.clicks / g.delivered * 100) : 0);
    return +rate.toFixed(2);
  });

  const ctorRates = dates.map(d => {
    const g = byDate[d];
    const rate = g.ctorWeight ? (g.ctorWeightedTotal / g.ctorWeight) : (g.hasOpens && g.hasClicks && g.opens ? (g.clicks / g.opens * 100) : 0);
    return +rate.toFixed(2);
  });

  const labels = dates.map(d => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  });

  const ctx = document.getElementById('trendChart').getContext('2d');

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = openRates;
    trendChart.data.datasets[1].data = clickRates;
    trendChart.data.datasets[2].data = ctorRates;
    trendChart.update('none');
    return;
  }

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Open Rate %',
          data: openRates,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,.1)',
          tension: .35,
          pointRadius: 3,
          fill: true,
        },
        {
          label: 'Click Rate %',
          data: clickRates,
          borderColor: '#00c8aa',
          backgroundColor: 'rgba(0,200,170,.08)',
          tension: .35,
          pointRadius: 3,
          fill: true,
        },
        {
          label: 'CTOR %',
          data: ctorRates,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,.08)',
          tension: .35,
          pointRadius: 3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'DM Sans'", size: 12 },
            boxWidth: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#e6e3dd' },
          ticks: {
            font: { family: "'IBM Plex Mono'", size: 10 },
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: '#e6e3dd' },
          ticks: {
            font: { family: "'IBM Plex Mono'", size: 11 },
            callback: v => v + '%',
          },
        },
      },
    },
  });
}

function getWeekStart(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (isNaN(d)) return dateString;
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return formatDate(d);
}

function getWeeklyComparisonRows(records) {
  const grouped = {};

  records.forEach(r => {
    if (!r.date) return;
    const week = getWeekStart(r.date);
    if (!grouped[week]) grouped[week] = [];
    grouped[week].push(r);
  });

  return Object.keys(grouped).sort().map(week => ({
    week,
    ...aggregate(grouped[week]),
  }));
}

function updateWowChangeChart() {
  const rows = getWeeklyComparisonRows(filteredRecords);
  const canvas = document.getElementById('wowChangeChart');
  if (!canvas) return;

  wowChangeChart = buildWowTableRows(rows);
  removeChartCaption('wowChangeChart');
  drawWowTableCanvas(canvas, wowChangeChart);
}

function buildWowTableRows(weeks) {
  const latest = weeks[weeks.length - 1] || null;
  const first = weeks[0] || null;
  const metrics = [
    { label: 'Delivery Rate', field: 'deliveryRate', color: '#2563eb' },
    { label: 'Open Rate', field: 'openRate', color: '#f59e0b' },
    { label: 'Click Rate', field: 'clickRate', color: '#f43f5e' },
    { label: 'CTOR', field: 'ctor', color: '#8b5cf6' },
  ];

  return metrics.map(metric => {
    const current = latest && typeof latest[metric.field] === 'number' ? latest[metric.field] : null;
    const firstValue = first && typeof first[metric.field] === 'number' ? first[metric.field] : null;
    const change = current !== null && firstValue !== null ? current - firstValue : null;

    return {
      ...metric,
      start: firstValue,
      current,
      change,
      trend: weeks
        .map(week => week[metric.field])
        .filter(value => typeof value === 'number' && isFinite(value)),
      changes: weeks.map((week, index) => {
        if (index === 0) {
          return { label: getWeekLabel(week.week), value: 0 };
        }

        const previousWeek = weeks[index - 1];
        const value = typeof week[metric.field] === 'number' ? week[metric.field] : null;
        const previous = typeof previousWeek[metric.field] === 'number' ? previousWeek[metric.field] : null;
        return {
          label: getWeekLabel(week.week),
          value: value !== null && previous !== null ? value - previous : null,
        };
      }).slice(-5),
    };
  });
}

function drawWowTableCanvas(canvas, rows) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(420, Math.floor(rect.width || canvas.clientWidth || 680));
  const height = Math.max(280, Math.floor(rect.height || canvas.clientHeight || 330));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = 18;
  const metricX = pad;
  const startX = Math.max(132, width * 0.27);
  const endX = Math.max(198, width * 0.40);
  const changeX = Math.max(266, width * 0.52);
  const trendX = Math.max(350, width * 0.66);
  const trendW = width - trendX - pad;
  const headerY = 32;
  const rowTop = 58;
  const rowH = Math.min(60, (height - rowTop - 10) / Math.max(rows.length, 1));

  ctx.font = "700 12px 'DM Sans', sans-serif";
  ctx.fillStyle = '#a8b4bf';
  ctx.fillText('WEEK-OVER-WEEK RATE CHANGES', metricX, 14);

  ctx.font = "400 12px 'DM Sans', sans-serif";
  ctx.fillStyle = '#172033';
  ctx.fillText('Start', startX, headerY);
  ctx.fillText('End', endX, headerY);
  ctx.fillText('Range pp', changeX, headerY);
  ctx.fillText('Rate Trend', trendX, headerY);
  drawWowChangeHeaders(ctx, rows[0]?.changes || [], trendX, headerY + 15, trendW);

  rows.forEach((row, index) => {
    const y = rowTop + index * rowH;
    const midY = y + rowH * 0.5;

    if (index > 0) {
      ctx.strokeStyle = '#e6e3dd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(metricX, y - 8);
      ctx.lineTo(width - pad, y - 8);
      ctx.stroke();
    }

    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.arc(metricX + 4, midY - 2, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "400 12px 'DM Sans', sans-serif";
    ctx.fillStyle = '#172033';
    ctx.fillText(row.label, metricX + 14, midY + 2);

    ctx.font = "700 15px 'DM Sans', sans-serif";
    ctx.fillStyle = '#172033';
    ctx.fillText(fmtNullablePct(row.start), startX, midY + 3);
    ctx.fillText(fmtNullablePct(row.current), endX, midY + 3);

    ctx.fillStyle = rateChangeColor(row.change);
    ctx.fillText(fmtPp(row.change), changeX, midY + 3);

    drawSparkline(ctx, row.trend, trendX, y + 6, trendW, Math.max(16, rowH * 0.38), row.color);
    drawWowChangeCells(ctx, row.changes, trendX, y + rowH - 20, trendW, 16);
  });
}

function drawWowChangeHeaders(ctx, changes, x, y, w) {
  if (!changes.length) return;
  const cellW = w / changes.length;
  ctx.font = "400 9px 'IBM Plex Mono', monospace";
  ctx.fillStyle = '#8b8378';
  changes.forEach((item, index) => {
    ctx.fillText(item.label, x + index * cellW + 2, y);
  });
}

function drawWowChangeCells(ctx, changes, x, y, w, h) {
  if (!changes.length) return;
  const cellW = w / changes.length;
  changes.forEach((item, index) => {
    const cx = x + index * cellW;
    ctx.fillStyle = changeCellBg(item.value);
    ctx.fillRect(cx, y, Math.max(18, cellW - 4), h);
    ctx.font = "700 9px 'IBM Plex Mono', monospace";
    ctx.fillStyle = rateChangeColor(item.value);
    ctx.fillText(fmtCompactPp(item.value), cx + 3, y + 11);
  });
}

function drawSparkline(ctx, values, x, y, w, h, color) {
  if (!values.length) {
    ctx.strokeStyle = '#c8c1b7';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => ({
    x: values.length === 1 ? x + w : x + (w * index) / (values.length - 1),
    y: y + h - ((value - min) / range) * h,
  }));

  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, hexToRgba(color, 0.34));
  gradient.addColorStop(1, hexToRgba(color, 0.02));

  ctx.beginPath();
  ctx.moveTo(points[0].x, y + h);
  points.forEach(point => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, y + h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
}

function fmtNullablePct(value) {
  return typeof value === 'number' && isFinite(value) ? fmtPct(value) : 'n/a';
}

function fmtPp(value) {
  if (typeof value !== 'number' || !isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pp`;
}

function fmtCompactPp(value) {
  if (typeof value !== 'number' || !isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function rateChangeColor(value) {
  if (typeof value !== 'number' || !isFinite(value) || value === 0) return '#172033';
  return value > 0 ? '#059669' : '#dc2626';
}

function changeCellBg(value) {
  if (typeof value !== 'number' || !isFinite(value) || value === 0) return 'rgba(230,227,221,.45)';
  return value > 0 ? 'rgba(16,185,129,.11)' : 'rgba(244,63,94,.10)';
}

function getWeekLabel(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (isNaN(d)) return 'W?';
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  return `W${week}`;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function mixHex(hex, targetHex, amount) {
  const parse = value => {
    const clean = value.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };
  const [r, g, b] = parse(hex);
  const [tr, tg, tb] = parse(targetHex);
  const mix = (from, to) => Math.round(from + (to - from) * amount);
  return `rgb(${mix(r, tr)},${mix(g, tg)},${mix(b, tb)})`;
}

function lightenHex(hex, amount) {
  return mixHex(hex, '#ffffff', amount);
}

function darkenHex(hex, amount) {
  return mixHex(hex, '#000000', amount);
}

function buildTopValueCaption(rows, labelField, valueField, color, formatter = fmtPct, count = 3) {
  return rows
    .filter(row => typeof row[valueField] === 'number' && isFinite(row[valueField]))
    .slice(0, count)
    .map(row => ({
      label: row[labelField] || '(Unknown)',
      value: row[valueField],
      color,
      format: formatter,
    }));
}

function buildProductCaption(rows) {
  const bestOpen = [...rows].sort((a, b) => sortNumberDesc(a, b, 'openRate'))[0];
  const bestClick = [...rows].sort((a, b) => sortNumberDesc(a, b, 'clickRate'))[0];
  const bestCtor = [...rows].sort((a, b) => sortNumberDesc(a, b, 'ctor'))[0];

  return [
    bestOpen && { label: `${bestOpen.product} Open`, value: bestOpen.openRate, color: '#f59e0b' },
    bestClick && { label: `${bestClick.product} Click`, value: bestClick.clickRate, color: '#00c8aa' },
    bestCtor && { label: `${bestCtor.product} CTOR`, value: bestCtor.ctor, color: '#8b5cf6' },
  ].filter(Boolean);
}

function buildDeliveryTrendCaption(rows) {
  if (!rows.length) return [];

  const rates = rows
    .map(row => row.deliveryRate)
    .filter(value => typeof value === 'number' && isFinite(value));
  const latest = rows[rows.length - 1];
  const min = [...rows].sort((a, b) => a.deliveryRate - b.deliveryRate)[0];
  const avg = rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;

  return [
    { label: 'Latest Delivery', value: latest.deliveryRate, color: '#3b82f6' },
    { label: 'Avg Delivery', value: avg, color: '#93c5fd' },
    min && { label: `Lowest ${min.date || ''}`.trim(), value: min.deliveryRate, color: '#f59e0b' },
  ].filter(Boolean);
}

function updateMarketProductHeatmap() {
  const container = document.getElementById('marketProductHeatmap');
  if (!container) return;

  const rows = getGroupedPerformance(filteredRecords, ['market', 'product']);
  const markets = [...new Set(rows.map(r => r.market))].sort();
  const products = [...new Set(rows.map(r => r.product))].sort();
  const byKey = new Map(rows.map(r => [`${r.market}||${r.product}`, r]));
  const values = rows.map(r => r.clickRate).filter(v => typeof v === 'number' && isFinite(v));
  const max = values.length ? Math.max(...values) : 0;

  if (!markets.length || !products.length) {
    container.innerHTML = '<div class="empty-state"><p>No data matching current filters.</p></div>';
    return;
  }

  container.innerHTML = `
    <table class="heatmap-table">
      <thead>
        <tr><th>Market</th>${products.map(p => `<th>${escHtml(p)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${markets.map(market => `
          <tr>
            <th>${escHtml(market)}</th>
            ${products.map(product => {
              const row = byKey.get(`${market}||${product}`);
              const value = row ? row.clickRate : null;
              const alpha = typeof value === 'number' && max ? Math.max(.08, value / max * .85) : 0;
              return `<td class="heatmap-cell" style="background: rgba(0,200,170,${alpha.toFixed(2)})">${fmtPct(value)}</td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function updateSizePerformanceChart() {
  const canvas = document.getElementById('sizePerformanceChart');
  if (!canvas) return;

  const rows = getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])
    .map(r => ({ ...r, campaignGroup: inferCampaignGroup(r.template) }))
    .filter(r => r.delivered > 0 && typeof r.ctor === 'number' && isFinite(r.ctor))
    .slice(0, 300);
  const groupColors = getCampaignGroupColors();
  const trendPoints = buildLogTrendline(rows, 'delivered', 'ctor');

  const data = {
    datasets: [
      ...Object.keys(groupColors).map(group => {
        const groupRows = rows.filter(r => r.campaignGroup === group);
        return {
          label: group,
          type: 'bubble',
          data: groupRows.map(r => ({
            x: Math.max(1, r.delivered),
            y: chartRateValue(r.ctor),
            r: Math.max(4, Math.min(11, Math.sqrt(r.delivered) / 55)),
            template: r.template,
            product: r.product,
            market: r.market,
            delivered: r.delivered,
            clickRate: r.clickRate,
          })),
          backgroundColor: groupColors[group],
          borderColor: groupColors[group],
          borderWidth: 1,
        };
      }).filter(ds => ds.data.length),
      {
        label: 'Trend',
        type: 'line',
        data: trendPoints,
        borderColor: '#ef4444',
        borderDash: [5, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: "'DM Sans'", size: 10 }, boxWidth: 9, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          title: items => items[0].raw.template || items[0].dataset.label,
          label: ctx => ctx.raw.template ? [
            `Delivered: ${fmtNum(ctx.raw.delivered || ctx.raw.x)}`,
            `CTOR: ${fmtPct(ctx.raw.y)}`,
            `Click Rate: ${fmtPct(ctx.raw.clickRate)}`,
            `Product/Market: ${ctx.raw.product} / ${ctx.raw.market}`,
          ] : `Trend: ${fmtPct(ctx.raw.y)}`,
        },
      },
    },
    scales: {
      x: {
        type: 'logarithmic',
        min: 1,
        title: { display: true, text: 'Total Delivered' },
        ticks: { callback: v => fmtNum(v), font: { family: "'IBM Plex Mono'", size: 10 } },
        grid: { color: '#eee9e3' },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'CTOR' },
        ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 10 } },
        grid: { color: '#eee9e3' },
      },
    },
  };

  if (sizePerformanceChart) {
    sizePerformanceChart.data = data;
    sizePerformanceChart.options = options;
    sizePerformanceChart.update('none');
    return;
  }

  sizePerformanceChart = new Chart(canvas.getContext('2d'), { type: 'bubble', data, options, plugins: [engagementCalloutPlugin] });
}

function updateCampaignGroupPerformanceChart() {
  const canvas = document.getElementById('campaignGroupPerformanceChart');
  if (!canvas) return;

  const rows = getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])
    .map(r => ({ ...r, campaignGroup: inferCampaignGroup(r.template) }));
  const grouped = getGroupedPerformanceByCampaignGroup(rows);
  const labels = grouped.map(r => r.campaignGroup);

  const data = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Open Rate',
        data: grouped.map(r => chartRateValue(r.openRate)),
        backgroundColor: 'rgba(248,113,113,.32)',
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: 'rate',
      },
      {
        type: 'bar',
        label: 'Click Rate',
        data: grouped.map(r => chartRateValue(r.clickRate)),
        backgroundColor: '#dc2626',
        borderRadius: 4,
        borderSkipped: false,
        yAxisID: 'rate',
      },
      {
        type: 'line',
        label: 'CTOR',
        data: grouped.map(r => chartRateValue(r.ctor)),
        borderColor: '#6b6660',
        backgroundColor: '#6b6660',
        pointBackgroundColor: '#6b6660',
        pointRadius: 4,
        tension: .25,
        yAxisID: 'rate',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { family: "'DM Sans'", size: 11 }, boxWidth: 10, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}`,
        },
      },
    },
    layout: {
      padding: { top: 24, right: 10 },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: "'DM Sans'", size: 11 }, maxRotation: 0 },
      },
      rate: {
        beginAtZero: true,
        suggestedMax: Math.max(
          40,
          Math.ceil(Math.max(
            0,
            ...grouped.flatMap(r => [r.openRate, r.clickRate, r.ctor].filter(v => typeof v === 'number' && isFinite(v)))
          ) * 1.22 / 10) * 10
        ),
        position: 'left',
        grid: { color: '#eee9e3' },
        ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 10 } },
      },
    },
  };

  if (campaignGroupPerformanceChart) {
    campaignGroupPerformanceChart.data = data;
    campaignGroupPerformanceChart.options = options;
    campaignGroupPerformanceChart.update('none');
    return;
  }

  campaignGroupPerformanceChart = new Chart(
    canvas.getContext('2d'),
    { type: 'bar', data, options, plugins: [campaignGroupValueLabelsPlugin] }
  );
}

function updateTopOverallCampaignsChart() {
  const canvas = document.getElementById('topOverallCampaignsChart');
  if (!canvas) return;

  const rows = limitTop(
    withMinimumDelivered(getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])),
    'efficiencyScore',
    3
  );

  topOverallCampaignsChart = rows;
  drawTopOverallCampaignsCanvas(canvas, rows);
}

function drawTopOverallCampaignsCanvas(canvas, rows) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(480, Math.floor(rect.width || canvas.clientWidth || 780));
  const height = Math.max(340, Math.floor(rect.height || canvas.clientHeight || 400));
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  ctx.font = "800 12px 'DM Sans', sans-serif";
  ctx.fillStyle = '#172033';
  ctx.textAlign = 'left';
  ctx.fillText('TOP 3 CAMPAIGNS BY OVERALL PERFORMANCE', 18, 18);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(Math.min(330, width * 0.48), 15);
  ctx.lineTo(width - 18, 15);
  ctx.stroke();

  if (!rows.length) {
    ctx.font = "400 13px 'DM Sans', sans-serif";
    ctx.fillStyle = '#8b8378';
    ctx.fillText('No campaigns matching current filters.', 18, height / 2);
    return;
  }

  const cardW = Math.min(190, Math.max(148, width * 0.245));
  const pedestalBottom = height - 14;

  const slots = [
    { rank: 2, row: rows[1], xFrac: 0.22, cardY: Math.round(height * 0.205), cardH: Math.round(height * 0.555), pedestalH: Math.round(height * 0.105),
      medalColor: '#a3aab6', ringColor: '#6b7280', borderColor: 'rgba(148,163,184,.72)', pedestalColor: '#a9b1bd', glowColor: 'rgba(148,163,184,.18)' },
    { rank: 1, row: rows[0], xFrac: 0.50, cardY: Math.round(height * 0.075), cardH: Math.round(height * 0.645), pedestalH: Math.round(height * 0.145),
      medalColor: '#facc15', ringColor: '#f59e0b', borderColor: 'rgba(220,38,38,.68)', pedestalColor: '#dc2626', glowColor: 'rgba(220,38,38,.16)' },
    { rank: 3, row: rows[2], xFrac: 0.78, cardY: Math.round(height * 0.230), cardH: Math.round(height * 0.525), pedestalH: Math.round(height * 0.092),
      medalColor: '#c08457', ringColor: '#92633b', borderColor: 'rgba(192,132,87,.62)', pedestalColor: '#c08457', glowColor: 'rgba(192,132,87,.16)' },
  ].filter(s => s.row);

  slots.forEach(s => drawPodiumCard(ctx, { ...s, x: width * s.xFrac }, cardW, pedestalBottom));
}

function drawPodiumCard(ctx, slot, cardW, pedestalBottom) {
  const { rank, row, x, cardY, cardH, pedestalH, medalColor, ringColor, borderColor, pedestalColor, glowColor } = slot;
  const cardX = x - cardW / 2;

  const pedestalY = pedestalBottom - pedestalH;
  const pedestalW = cardW * (rank === 1 ? 1.02 : 0.86);
  ctx.save();
  ctx.shadowColor = glowColor || 'rgba(0,0,0,.10)';
  ctx.shadowBlur = rank === 1 ? 18 : 12;
  ctx.fillStyle = hexToRgba(pedestalColor, 0.24);
  ctx.beginPath();
  ctx.ellipse(x, pedestalY + 3, pedestalW * 0.52, Math.max(10, pedestalH * 0.28), 0, 0, Math.PI * 2);
  ctx.fill();
  const platformGradient = ctx.createLinearGradient(0, pedestalY, 0, pedestalBottom);
  platformGradient.addColorStop(0, lightenHex(pedestalColor, 0.18));
  platformGradient.addColorStop(0.52, pedestalColor);
  platformGradient.addColorStop(1, darkenHex(pedestalColor, 0.16));
  ctx.fillStyle = platformGradient;
  roundedRect(ctx, x - pedestalW / 2, pedestalY + 8, pedestalW, pedestalH, 8);
  ctx.fill();
  ctx.fillStyle = hexToRgba('#ffffff', 0.22);
  roundedRect(ctx, x - pedestalW / 2, pedestalY + 8, pedestalW, Math.max(7, pedestalH * 0.20), 8);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = rank === 1 ? 'rgba(220,38,38,0.16)' : 'rgba(15,23,42,0.11)';
  ctx.shadowBlur = rank === 1 ? 22 : 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fff';
  roundedRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.fill();
  ctx.restore();

  // Card border
  ctx.save();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = rank === 1 ? 2 : 1.5;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.stroke();
  if (rank === 1) {
    ctx.strokeStyle = hexToRgba('#dc2626', 0.18);
    ctx.lineWidth = 5;
    roundedRect(ctx, cardX + 3, cardY + 3, cardW - 6, cardH - 6, 8);
    ctx.stroke();
  }
  ctx.restore();

  // Medal
  const medalCY = cardY + Math.round(cardH * 0.115);
  const medalR = Math.min(rank === 1 ? 28 : 24, Math.round(cardH * 0.102));

  if (rank === 1) drawLaurelWreath(ctx, x, medalCY, medalR + 11, ringColor);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, medalCY, medalR + 3, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(ringColor, 0.22);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, medalCY, medalR, 0, Math.PI * 2);
  ctx.fillStyle = medalColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - medalR * 0.22, medalCY - medalR * 0.28, medalR * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba('#ffffff', 0.30);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${rank === 1 ? 22 : 19}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(rank), x, medalCY + 1);
  ctx.restore();

  // Campaign name — centered, up to 3 lines
  const nameStartY = cardY + Math.round(cardH * 0.315);
  const nameLineH = Math.max(13, Math.round(cardH * 0.060));
  ctx.save();
  ctx.fillStyle = '#172033';
  ctx.font = `800 ${rank === 1 ? 12.5 : 11.5}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  wrapCanvasTextCentered(ctx, shortLabel(row.template, 50), x, nameStartY, cardW - 30, nameLineH, 4);
  ctx.restore();

  const metricPanelH = Math.round(cardH * 0.285);
  const metricPanelY = cardY + cardH - metricPanelH;
  ctx.save();
  ctx.fillStyle = rank === 1 ? 'rgba(254,242,242,.92)' : 'rgba(248,250,252,.92)';
  roundedRect(ctx, cardX + 10, metricPanelY - 4, cardW - 20, metricPanelH - 8, 8);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rank === 1 ? 'rgba(220,38,38,.22)' : '#e6e3dd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 16, metricPanelY);
  ctx.lineTo(cardX + cardW - 16, metricPanelY);
  ctx.stroke();
  ctx.restore();

  // Metric rows: OR / CTR / CTOR
  const metricRowH = Math.max(18, Math.round(metricPanelH * 0.255));
  const m1Y = metricPanelY + Math.round(metricPanelH * 0.245);
  drawPodiumMetric(ctx, 'OR', row.openRate, cardX + 18, cardW - 36, m1Y, rank === 1);
  drawPodiumMetric(ctx, 'CTR', row.clickRate, cardX + 18, cardW - 36, m1Y + metricRowH, rank === 1);
  drawPodiumMetric(ctx, 'CTOR', row.ctor, cardX + 18, cardW - 36, m1Y + metricRowH * 2, rank === 1);
}

function drawPodiumMetric(ctx, label, value, x, rowWidth, y, isWinner = false) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = "700 10.5px 'DM Sans', sans-serif";
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.font = `800 ${isWinner ? 13.5 : 12.5}px 'DM Sans', sans-serif`;
  ctx.fillStyle = isWinner ? '#dc2626' : '#ef4444';
  ctx.textAlign = 'right';
  ctx.fillText(fmtPct(value), x + rowWidth, y);
  ctx.restore();
}

function drawLaurelWreath(ctx, cx, cy, r, color) {
  ctx.save();
  const leafColor = hexToRgba(color, 0.70);
  const leafCount = 11;
  const startAngle = Math.PI * 0.65;
  const spanAngle  = Math.PI * 1.70;

  for (let i = 0; i < leafCount; i++) {
    const angle = startAngle + (i / (leafCount - 1)) * spanAngle;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.rotate(angle + Math.PI * 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.8, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = leafColor;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function wrapCanvasTextCentered(ctx, text, cx, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let drawn = 0;
  words.forEach(word => {
    if (drawn >= maxLines) return;
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, y);
      y += lineHeight;
      drawn++;
      line = word;
    } else {
      line = test;
    }
  });
  if (line && drawn < maxLines) ctx.fillText(line, cx, y);
}

function inferCampaignGroup(template) {
  const text = String(template || '').toLowerCase();
  if (text.includes('underperform') || text.includes('underperf') || text.includes('mtd')) return 'Underperforming MTD';
  if (text.includes('risk') || text.includes('churn')) return 'Risk of Churn';
  if (text.includes('retention') || text.includes('cashback') || text.includes('newsletter')) return 'Retention';
  if (text.includes('reactivation') || text.includes('reactivate')) return 'Reactivation';
  return 'Other';
}

function inferAudience(template) {
  const text = String(template || '').toLowerCase();
  if (/\bvip\b/.test(text) || text.startsWith('vip /')) return 'VIP';
  if (/\bcrm\b/.test(text) || text.startsWith('crm /')) return 'CRM';
  return 'Other';
}

function getCampaignGroupColors() {
  return {
    'Underperforming MTD': '#dc2626',
    'Risk of Churn': '#ef4444',
    Retention: '#fca5a5',
    Reactivation: '#8b8378',
    Other: '#9ca3af',
  };
}

function getGroupedPerformanceByCampaignGroup(rows) {
  const priority = ['Underperforming MTD', 'Risk of Churn', 'Retention', 'Reactivation', 'Other'];
  const grouped = {};

  rows.forEach(row => {
    const key = row.campaignGroup || 'Other';
    if (!grouped[key]) {
      grouped[key] = {
        campaignGroup: key,
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        openRateWeightedTotal: 0,
        openRateWeight: 0,
        clickRateWeightedTotal: 0,
        clickRateWeight: 0,
        ctorWeightedTotal: 0,
        ctorWeight: 0,
        hasOpens: false,
        hasClicks: false,
      };
    }

    grouped[key].sent += row.sent;
    grouped[key].delivered += row.delivered;
    grouped[key].opens += row.opens;
    grouped[key].clicks += row.clicks;
    grouped[key].hasOpens = grouped[key].hasOpens || !!row.hasOpens;
    grouped[key].hasClicks = grouped[key].hasClicks || !!row.hasClicks;

    if (row.openRate !== null && row.openRate !== undefined && isFinite(row.openRate) && row.delivered > 0) {
      grouped[key].openRateWeightedTotal += row.openRate * row.delivered;
      grouped[key].openRateWeight += row.delivered;
    }
    if (row.clickRate !== null && row.clickRate !== undefined && isFinite(row.clickRate) && row.delivered > 0) {
      grouped[key].clickRateWeightedTotal += row.clickRate * row.delivered;
      grouped[key].clickRateWeight += row.delivered;
    }
    if (row.ctor !== null && row.ctor !== undefined && isFinite(row.ctor) && row.opens > 0) {
      grouped[key].ctorWeightedTotal += row.ctor * row.opens;
      grouped[key].ctorWeight += row.opens;
    }
  });

  return Object.values(grouped)
    .map(g => ({
      campaignGroup: g.campaignGroup,
      openRate: g.openRateWeight ? (g.openRateWeightedTotal / g.openRateWeight) : (g.hasOpens && g.delivered ? (g.opens / g.delivered * 100) : null),
      clickRate: g.clickRateWeight ? (g.clickRateWeightedTotal / g.clickRateWeight) : (g.hasClicks && g.delivered ? (g.clicks / g.delivered * 100) : null),
      ctor: g.ctorWeight ? (g.ctorWeightedTotal / g.ctorWeight) : (g.hasOpens && g.hasClicks && g.opens ? (g.clicks / g.opens * 100) : null),
    }))
    .sort((a, b) => priority.indexOf(a.campaignGroup) - priority.indexOf(b.campaignGroup));
}

function buildLogTrendline(rows, xField, yField) {
  const points = rows
    .map(row => ({ x: Math.max(1, row[xField]), y: row[yField] }))
    .filter(point => point.x > 0 && typeof point.y === 'number' && isFinite(point.y));
  if (points.length < 2) return [];

  const xs = points.map(point => Math.log10(point.x));
  const ys = points.map(point => point.y);
  const n = points.length;
  const sumX = xs.reduce((sum, value) => sum + value, 0);
  const sumY = ys.reduce((sum, value) => sum + value, 0);
  const sumXY = xs.reduce((sum, value, index) => sum + value * ys[index], 0);
  const sumXX = xs.reduce((sum, value) => sum + value * value, 0);
  const denom = n * sumXX - sumX * sumX;
  if (!denom) return [];

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  return [minX, maxX].map(x => ({ x, y: Math.max(0, intercept + slope * Math.log10(x)) }));
}

function updateChannelSplitChart() {
  const canvas = document.getElementById('channelSplitChart');
  if (!canvas) return;

  const rows = getGroupedPerformance(filteredRecords, ['channel'])
    .sort((a, b) => String(a.channel).localeCompare(String(b.channel)));

  const data = {
    labels: rows.map(r => r.channel),
    datasets: [
      { label: 'Delivery Rate', data: rows.map(r => chartRateValue(r.deliveryRate)), backgroundColor: '#3b82f6', borderRadius: 4, borderSkipped: false },
      { label: 'Open Rate', data: rows.map(r => chartRateValue(r.openRate)), backgroundColor: '#f59e0b', borderRadius: 4, borderSkipped: false },
      { label: 'Click Rate', data: rows.map(r => chartRateValue(r.clickRate)), backgroundColor: '#00c8aa', borderRadius: 4, borderSkipped: false },
      { label: 'CTOR', data: rows.map(r => chartRateValue(r.ctor)), backgroundColor: '#8b5cf6', borderRadius: 4, borderSkipped: false },
    ],
  };

  if (channelSplitChart) {
    channelSplitChart.data = data;
    channelSplitChart.options = baseBarOptions({ percent: true, showLegend: true });
    channelSplitChart.update('none');
    return;
  }

  channelSplitChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data,
    options: baseBarOptions({ percent: true, showLegend: true }),
  });
}

function renderCampaignRankTable(containerId, title, rows) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const isWorst = /worst/i.test(title);
  const topRows = rows.slice(0, 3);

  container.innerHTML = `
    ${topRows.length ? renderCampaignRankPodium(topRows, title, isWorst) : ''}
    <table class="top-details-table">
      <thead><tr><th colspan="7">${escHtml(title)}</th></tr>
      <tr><th>Campaign</th><th>Product</th><th>Market</th><th class="num">Sent</th><th class="num">Delivered</th><th class="num">Click Rate</th><th class="num">CTOR</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escHtml(r.template)}</td>
            <td>${escHtml(r.product)}</td>
            <td>${escHtml(r.market)}</td>
            <td class="num">${fmtNum(r.sent)}</td>
            <td class="num">${fmtNum(r.delivered)}</td>
            <td class="num">${fmtPct(r.clickRate)}</td>
            <td class="num">${fmtPct(r.ctor)}</td>
          </tr>
        `).join('') || '<tr><td colspan="7">No data matching current filters.</td></tr>'}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-rank-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      exportCampaignRankImage(topRows, title, isWorst, btn.dataset.rankExport);
    });
  });
}

function renderCampaignRankPodium(rows, title, isWorst) {
  return `
    <div class="campaign-rank-board ${isWorst ? 'campaign-rank-board-worst' : 'campaign-rank-board-best'}">
      <div class="campaign-rank-board-header">
        <div>
          <span class="campaign-rank-kicker">${escHtml(title)}</span>
          <strong>${isWorst ? 'Bottom 3 campaigns' : 'Top 3 campaigns'}</strong>
        </div>
        <div class="campaign-rank-actions">
          <button type="button" data-rank-export="copy">Copy image</button>
          <button type="button" data-rank-export="download">Download PNG</button>
        </div>
      </div>
      <div class="campaign-rank-podium">
        ${rows.map((row, index) => `
          <div class="campaign-rank-card campaign-rank-card-${index + 1}">
            <div class="rank-medal rank-medal-${index + 1}" aria-hidden="true">
              <span class="rank-medal-number">${index + 1}</span>
            </div>
            <div class="campaign-rank-copy">
              <strong>${escHtml(row.template)}</strong>
              <div class="campaign-rank-meta">
                <span>${escHtml(row.product)}</span>
                <span>${escHtml(row.market)}</span>
                <span>${fmtNum(row.delivered)} delivered</span>
              </div>
            </div>
            <div class="campaign-rank-metrics">
              <span><small>CTR</small>${fmtPct(row.clickRate)}</span>
              <span><small>CTOR</small>${fmtPct(row.ctor)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function exportCampaignRankImage(rows, title, isWorst, action) {
  const src = renderCampaignRankImage(rows, title, isWorst);
  if (!src) {
    showToast('Unable to export campaign ranking.');
    return;
  }

  const blob = dataUrlToBlob(src);
  const filename = `${title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Campaign Ranking'}.png`;

  if (action === 'download' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
    downloadBlob(blob, filename);
    showToast(action === 'download' ? 'Ranking image downloaded.' : 'Clipboard image copy is unavailable, ranking image downloaded.');
    return;
  }

  navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    .then(() => showToast('Ranking image copied to clipboard.'))
    .catch(() => {
      downloadBlob(blob, filename);
      showToast('Clipboard blocked, ranking image downloaded as PNG.');
    });
}

function renderCampaignRankImage(rows, title, isWorst) {
  try {
    const scale = 2;
    const width = 1180;
    const height = 610;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#172033';
    ctx.font = "800 28px 'DM Sans', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title.toUpperCase(), 46, 36);
    ctx.strokeStyle = isWorst ? '#c08457' : '#dc2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(430, 52);
    ctx.lineTo(width - 46, 52);
    ctx.stroke();

    const slots = [
      { rank: 2, row: rows[1], x: 220, y: 160, h: 330 },
      { rank: 1, row: rows[0], x: 590, y: 112, h: 378 },
      { rank: 3, row: rows[2], x: 960, y: 176, h: 314 },
    ].filter(slot => slot.row);

    slots.forEach(slot => drawCampaignRankImageCard(ctx, slot, isWorst));

    return canvas.toDataURL('image/png', 1);
  } catch (e) {
    console.error('Unable to render campaign ranking image', e);
    return '';
  }
}

function drawCampaignRankImageCard(ctx, slot, isWorst) {
  const { rank, row, x, y, h } = slot;
  const w = 290;
  const cardX = x - w / 2;
  const accent = rank === 1 ? '#dc2626' : rank === 2 ? '#9ca3af' : '#c08457';

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,.12)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, cardX, y, w, h, 14);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexToRgba(accent, rank === 1 ? .65 : .48);
  ctx.lineWidth = rank === 1 ? 3 : 2;
  roundedRect(ctx, cardX, y, w, h, 14);
  ctx.stroke();

  drawRankMedalCanvas(ctx, x, y + 54, rank);

  ctx.fillStyle = '#172033';
  ctx.font = "800 18px 'DM Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  wrapCanvasTextCentered(ctx, shortLabel(row.template, 66), x, y + 118, w - 44, 21, 4);

  ctx.strokeStyle = '#e6e3dd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 26, y + h - 116);
  ctx.lineTo(cardX + w - 26, y + h - 116);
  ctx.stroke();

  const metrics = [
    ['CTR', fmtPct(row.clickRate)],
    ['CTOR', fmtPct(row.ctor)],
    ['Delivered', fmtNum(row.delivered)],
  ];

  metrics.forEach((metric, index) => {
    const yy = y + h - 84 + index * 30;
    ctx.fillStyle = '#6b7280';
    ctx.font = "800 12px 'DM Sans', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(metric[0], cardX + 30, yy);
    ctx.fillStyle = isWorst ? '#c08457' : '#dc2626';
    ctx.font = "800 19px 'DM Sans', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillText(metric[1], cardX + w - 30, yy - 2);
  });
}

function drawRankMedalCanvas(ctx, cx, cy, rank) {
  const gradients = {
    1: ['#fff8bd', '#facc15', '#d97706', '#92400e'],
    2: ['#f8fafc', '#cbd5e1', '#94a3b8', '#64748b'],
    3: ['#fed7aa', '#c08457', '#9a5b32', '#7c2d12'],
  };
  const colors = gradients[rank] || gradients[3];
  const g = ctx.createRadialGradient(cx - 18, cy - 18, 8, cx, cy, 50);
  g.addColorStop(0, colors[0]);
  g.addColorStop(.34, colors[1]);
  g.addColorStop(.74, colors[2]);
  g.addColorStop(1, colors[3]);

  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,0,.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = "800 46px 'DM Sans', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.22)';
  ctx.shadowBlur = 4;
  ctx.fillText(String(rank), cx, cy + 2);
  ctx.restore();
}

function renderCampaignRankFeature(row, title, rank, isWorst) {
  return `
    <div class="campaign-rank-feature ${isWorst ? 'campaign-rank-feature-worst' : 'campaign-rank-feature-best'}">
      <div class="rank-medal rank-medal-${rank}" aria-hidden="true">
        <span class="rank-medal-number">${rank}</span>
      </div>
      <div class="campaign-rank-copy">
        <span class="campaign-rank-kicker">${escHtml(title)}</span>
        <strong>${escHtml(row.template)}</strong>
        <div class="campaign-rank-meta">
          <span>${escHtml(row.product)}</span>
          <span>${escHtml(row.market)}</span>
          <span>${fmtNum(row.delivered)} delivered</span>
        </div>
      </div>
      <div class="campaign-rank-metrics">
        <span><small>CTR</small>${fmtPct(row.clickRate)}</span>
        <span><small>CTOR</small>${fmtPct(row.ctor)}</span>
      </div>
    </div>
  `;
}

function updateBestWorstCampaigns() {
  const rows = withMinimumDelivered(getGroupedPerformance(filteredRecords, ['template', 'product', 'market']))
    .filter(r => typeof r.clickRate === 'number' && isFinite(r.clickRate));
  const sorted = [...rows].sort((a, b) => b.clickRate - a.clickRate);

  renderCampaignRankTable('bestCampaignsTable', 'Best by Click Rate', sorted.slice(0, 10));
  renderCampaignRankTable('worstCampaignsTable', 'Worst by Click Rate', sorted.slice(-10).reverse());
}

function updateRepeatCampaignTracking() {
  const container = document.getElementById('repeatCampaignsTable');
  if (!container) return;

  const byTemplate = {};
  filteredRecords.forEach(r => {
    if (!r.template || !r.date) return;
    const week = getWeekStart(r.date);
    const key = `${r.template}||${r.product}||${r.market}`;
    if (!byTemplate[key]) byTemplate[key] = { template: r.template, product: r.product, market: r.market, weeks: {} };
    if (!byTemplate[key].weeks[week]) byTemplate[key].weeks[week] = [];
    byTemplate[key].weeks[week].push(r);
  });

  const rows = Object.values(byTemplate)
    .map(item => {
      const weeks = Object.keys(item.weeks).sort();
      if (weeks.length < 2) return null;
      const first = aggregate(item.weeks[weeks[0]]);
      const last = aggregate(item.weeks[weeks[weeks.length - 1]]);
      return {
        ...item,
        weeks: weeks.length,
        firstWeek: weeks[0],
        lastWeek: weeks[weeks.length - 1],
        firstClickRate: first.clickRate,
        lastClickRate: last.clickRate,
        delta: typeof first.clickRate === 'number' && typeof last.clickRate === 'number'
          ? last.clickRate - first.clickRate
          : null,
        sent: last.totalSent,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 20);

  container.innerHTML = `
    <table class="top-details-table">
      <thead><tr><th>Campaign</th><th>Product</th><th>Market</th><th class="num">Weeks</th><th>First Week</th><th>Last Week</th><th class="num">First CR</th><th class="num">Last CR</th><th class="num">Delta</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escHtml(r.template)}</td>
            <td>${escHtml(r.product)}</td>
            <td>${escHtml(r.market)}</td>
            <td class="num">${fmtNum(r.weeks)}</td>
            <td>${escHtml(r.firstWeek)}</td>
            <td>${escHtml(r.lastWeek)}</td>
            <td class="num">${fmtPct(r.firstClickRate)}</td>
            <td class="num">${fmtPct(r.lastClickRate)}</td>
            <td class="num">${fmtPct(r.delta)}</td>
          </tr>
        `).join('') || '<tr><td colspan="9">No repeated campaigns in current filters.</td></tr>'}
      </tbody>
    </table>
  `;
}

/* ============================================================
   8. UI — EXTRA INSIGHT CHARTS
   ============================================================ */

const MIN_DELIVERED_FOR_RATE_CHARTS = 50;

let topClickRateChart = null;
let topCtorChart = null;
let sentByMarketChart = null;
let clickRateByMarketChart = null;
let productPerformanceChart = null;
let deliveryRateTrendChart = null;
let efficiencyScoreChart = null;

function getGroupedPerformance(records, groupFields) {
  const grouped = {};

  records.forEach(r => {
    const key = groupFields.map(field => r[field] || '(Unknown)').join('||');

    if (!grouped[key]) {
      grouped[key] = {
        key,
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        openRateWeightedTotal: 0,
        openRateWeight: 0,
        clickRateWeightedTotal: 0,
        clickRateWeight: 0,
        ctorWeightedTotal: 0,
        ctorWeight: 0,
        hasOpens: false,
        hasClicks: false,
        recordCount: 0,
        dates: new Set(),
        sourceNames: new Set(),
      };

      groupFields.forEach(field => {
        grouped[key][field] = r[field] || '(Unknown)';
      });
    }

    grouped[key].sent += r.sent;
    grouped[key].delivered += r.delivered;
    grouped[key].opens += r.opens;
    grouped[key].clicks += r.clicks;
    grouped[key].hasOpens = grouped[key].hasOpens || !!r.hasOpens;
    grouped[key].hasClicks = grouped[key].hasClicks || !!r.hasClicks;
    grouped[key].recordCount += 1;

    if (r.openRate !== null && r.openRate !== undefined && isFinite(r.openRate) && r.delivered > 0) {
      grouped[key].openRateWeightedTotal += r.openRate * r.delivered;
      grouped[key].openRateWeight += r.delivered;
    }

    if (r.clickRate !== null && r.clickRate !== undefined && isFinite(r.clickRate) && r.delivered > 0) {
      grouped[key].clickRateWeightedTotal += r.clickRate * r.delivered;
      grouped[key].clickRateWeight += r.delivered;
    }

    if (r.ctor !== null && r.ctor !== undefined && isFinite(r.ctor) && r.opens > 0) {
      grouped[key].ctorWeightedTotal += r.ctor * r.opens;
      grouped[key].ctorWeight += r.opens;
    }

    if (r.date) grouped[key].dates.add(r.date);
    if (r.sourceFileName) grouped[key].sourceNames.add(r.sourceFileName);
  });

  return Object.values(grouped).map(g => {
    const dates = [...g.dates].sort();
    const sourceNames = [...g.sourceNames].sort();

    return {
      ...g,
      dates,
      sourceNames,
      firstDate: dates[0] || '',
      lastDate: dates[dates.length - 1] || '',
      sourceCount: sourceNames.length,
      openRate: g.openRateWeight ? (g.openRateWeightedTotal / g.openRateWeight) : (g.hasOpens && g.delivered ? (g.opens / g.delivered * 100) : null),
      clickRate: g.clickRateWeight ? (g.clickRateWeightedTotal / g.clickRateWeight) : (g.hasClicks && g.delivered ? (g.clicks / g.delivered * 100) : null),
      ctor: g.ctorWeight ? (g.ctorWeightedTotal / g.ctorWeight) : (g.hasOpens && g.hasClicks && g.opens ? (g.clicks / g.opens * 100) : null),
      deliveryRate: g.sent ? (g.delivered / g.sent * 100) : 0,
      efficiencyScore: calculateEfficiencyScore(g),
    };
  });
}

function calculateEfficiencyScore(g) {
  const openRate = g.openRate ?? (g.openRateWeight ? (g.openRateWeightedTotal / g.openRateWeight) : (g.delivered ? (g.opens / g.delivered * 100) : 0));
  const clickRate = g.clickRate ?? (g.clickRateWeight ? (g.clickRateWeightedTotal / g.clickRateWeight) : (g.delivered ? (g.clicks / g.delivered * 100) : 0));
  const ctor = g.ctor ?? (g.ctorWeight ? (g.ctorWeightedTotal / g.ctorWeight) : (g.opens ? (g.clicks / g.opens * 100) : 0));

  return ((clickRate ?? 0) * 0.5) + ((ctor ?? 0) * 0.3) + ((openRate ?? 0) * 0.2);
}

function withMinimumDelivered(rows) {
  const filtered = rows.filter(r => r.delivered >= MIN_DELIVERED_FOR_RATE_CHARTS);
  return filtered.length ? filtered : rows;
}

function limitTop(rows, metric, count = 10) {
  return [...rows]
    .filter(r => typeof r[metric] === 'number' && isFinite(r[metric]))
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, count);
}

function shortLabel(label, max = 34) {
  const s = String(label || '(Unknown)');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function chartRateValue(n) {
  return typeof n === 'number' && isFinite(n) ? +n.toFixed(2) : null;
}

function renderChartCaption(canvasId, items) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const body = canvas.closest('.chart-body');
  if (!body) return;

  let caption = body.nextElementSibling;
  if (!caption || !caption.classList.contains('chart-caption')) {
    caption = document.createElement('div');
    caption.className = 'chart-caption';
    body.insertAdjacentElement('afterend', caption);
  }

  const visibleItems = items
    .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));

  caption.hidden = !visibleItems.length;
  caption.innerHTML = visibleItems
    .map(item => `
      <span class="chart-caption-item">
        <span class="chart-caption-dot" style="background:${escAttr(item.color)}"></span>
        <span>${escHtml(item.label)}</span>
        <strong>${escHtml(item.format ? item.format(item.value) : fmtPct(item.value))}</strong>
      </span>
    `).join('');
}

function removeChartCaption(canvasId) {
  const canvas = document.getElementById(canvasId);
  const body = canvas?.closest('.chart-body');
  const caption = body?.nextElementSibling;
  if (caption?.classList.contains('chart-caption')) caption.remove();
}

function initChartActions() {
  document.querySelectorAll('.chart-card canvas').forEach(canvas => {
    const card = canvas.closest('.chart-card');
    const header = card?.querySelector('.chart-header');
    if (!card || !header || header.querySelector('.chart-actions')) return;

    const actions = document.createElement('div');
    actions.className = 'chart-actions';
    actions.innerHTML = `
      <button type="button" class="chart-action-btn" data-chart-action="zoom" title="Enlarge chart" aria-label="Enlarge chart">Zoom</button>
      <button type="button" class="chart-action-btn" data-chart-action="copy" title="Copy chart as image" aria-label="Copy chart as image">Copy</button>
    `;

    actions.addEventListener('click', e => {
      const btn = e.target.closest('[data-chart-action]');
      if (!btn) return;

      if (btn.dataset.chartAction === 'zoom') {
        openChartModal(canvas);
      } else if (btn.dataset.chartAction === 'copy') {
        copyChartToClipboard(canvas);
      }
    });

    header.appendChild(actions);
  });
}

function getChartTitle(canvas) {
  return canvas.closest('.chart-card')?.querySelector('.chart-title')?.textContent?.trim() || 'Chart';
}

function getChartSubtitle(canvas) {
  return canvas.closest('.chart-card')?.querySelector('.chart-subtitle')?.textContent?.trim() || '';
}

function getChartFilename(canvas) {
  return `${getChartTitle(canvas).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || 'Chart'}.png`;
}

function getChartImage(canvas, options = {}) {
  try {
    const scale = options.scale || 2;
    const includeTitle = options.includeTitle !== false;
    const title = getChartTitle(canvas);
    const subtitle = getChartSubtitle(canvas);
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const sourceW = Math.round(rect.width || canvas.clientWidth || (canvas.width / pixelRatio) || 800);
    const sourceH = Math.round(rect.height || canvas.clientHeight || (canvas.height / pixelRatio) || 420);
    const titleH = includeTitle ? (subtitle ? 74 : 54) : 0;
    const padding = includeTitle ? 24 : 0;
    const out = document.createElement('canvas');
    out.width = Math.round((sourceW + padding * 2) * scale);
    out.height = Math.round((sourceH + titleH + padding) * scale);

    const ctx = out.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width / scale, out.height / scale);

    if (includeTitle) {
      ctx.fillStyle = '#1c1a17';
      ctx.font = "700 22px 'DM Sans', sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title, padding, 18);

      if (subtitle) {
        ctx.fillStyle = '#8b8378';
        ctx.font = "400 13px 'DM Sans', sans-serif";
        ctx.fillText(subtitle, padding, 45);
      }
    }

    ctx.drawImage(canvas, padding, titleH, sourceW, sourceH);
    return out.toDataURL('image/png', 1);
  } catch (err) {
    console.error('Unable to create chart image', err);
    return '';
  }
}

function getChartBlob(canvas, callback, options = {}) {
  const src = getChartImage(canvas, options);
  if (!src) {
    callback(null);
    return;
  }
  callback(dataUrlToBlob(src));
}

function ensureChartModal() {
  let modal = document.getElementById('chartModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'chartModal';
  modal.className = 'chart-modal';
  modal.innerHTML = `
    <div class="chart-modal-panel" role="dialog" aria-modal="true" aria-labelledby="chartModalTitle">
      <div class="chart-modal-header">
        <div id="chartModalTitle" class="chart-modal-title"></div>
        <button type="button" class="chart-modal-close" aria-label="Close enlarged chart">Close</button>
      </div>
      <div class="chart-modal-body">
        <img alt="">
      </div>
    </div>
  `;

  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('.chart-modal-close')) {
      closeChartModal();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeChartModal();
  });

  document.body.appendChild(modal);
  return modal;
}

function openChartModal(canvas) {
  const src = getChartImage(canvas);
  if (!src) {
    showToast('Unable to enlarge this chart.');
    return;
  }

  const modal = ensureChartModal();
  modal.querySelector('.chart-modal-title').textContent = getChartTitle(canvas);
  const img = modal.querySelector('img');
  img.src = src;
  img.alt = getChartTitle(canvas);
  modal.classList.add('open');
}

function closeChartModal() {
  const modal = document.getElementById('chartModal');
  if (modal) modal.classList.remove('open');
}

function copyChartToClipboard(canvas) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    const src = getChartImage(canvas);
    if (!src) {
      showToast('Unable to copy this chart.');
      return;
    }
    downloadBlob(dataUrlToBlob(src), getChartFilename(canvas));
    showToast('Clipboard is unavailable here, chart downloaded as PNG.');
    return;
  }

  getChartBlob(canvas, blob => {
    if (!blob) {
      showToast('Unable to copy this chart.');
      return;
    }

    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      .then(() => showToast('Chart copied to clipboard.'))
      .catch(() => {
        downloadBlob(blob, getChartFilename(canvas));
        showToast('Clipboard blocked, chart downloaded as PNG.');
      });
  }, { scale: 2, includeTitle: true });
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bin = atob(parts[1] || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const chartValueLabelsPlugin = {
  id: 'chartValueLabels',
  afterDatasetsDraw(chart, args, options) {
    if (!options || !options.display) return;

    const { ctx } = chart;
    ctx.save();
    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.fillStyle = '#1c1a17';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (options.rateOnly && dataset.yAxisID !== 'rate') return;

      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        if (typeof value !== 'number' || !isFinite(value)) return;
        const label = options.suffix === 'pp' ? `${value.toFixed(2)}%` : fmtPct(value);
        ctx.fillText(label, element.x, element.y - 6);
      });
    });

    ctx.restore();
  },
};

const engagementCalloutPlugin = {
  id: 'engagementCallout',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const w = Math.min(178, chartArea.width * 0.34);
    const h = 54;
    const x = chartArea.right - w - 12;
    const y = chartArea.top + 12;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.strokeStyle = 'rgba(220,38,38,.24)';
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = "700 18px 'DM Sans', sans-serif";
    ctx.fillText('UP', x + 10, y + 28);

    ctx.fillStyle = '#172033';
    ctx.font = "700 10px 'DM Sans', sans-serif";
    wrapCanvasText(ctx, 'Smaller, targeted campaigns drive higher engagement.', x + 40, y + 18, w - 52, 12);
    ctx.restore();
  },
};

const campaignGroupValueLabelsPlugin = {
  id: 'campaignGroupValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const placed = [];
    ctx.save();
    ctx.font = "700 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      const textColor = dataset.type === 'line' ? '#6b6660' : '#dc2626';

      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        if (typeof value !== 'number' || !isFinite(value)) return;
        const label = fmtPct(value);
        const labelW = ctx.measureText(label).width + 8;
        const labelH = 14;
        const minY = (chartArea?.top || 0) + 8;
        let y = Math.max(minY, element.y - (dataset.type === 'line' ? 24 : 9));
        let box = {
          left: element.x - labelW / 2,
          right: element.x + labelW / 2,
          top: y - labelH / 2,
          bottom: y + labelH / 2,
        };

        while (placed.some(prev => boxesOverlap(box, prev)) && y - labelH > minY) {
          y -= labelH + 2;
          box = {
            left: element.x - labelW / 2,
            right: element.x + labelW / 2,
            top: y - labelH / 2,
            bottom: y + labelH / 2,
          };
        }

        ctx.fillStyle = 'rgba(255,255,255,.78)';
        roundedRect(ctx, box.left - 2, box.top, labelW + 4, labelH, 4);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(label, element.x, y + 0.5);
        placed.push(box);
      });
    });

    ctx.restore();
  },
};

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
}

function sortNumberDesc(a, b, field) {
  const av = typeof a[field] === 'number' && isFinite(a[field]) ? a[field] : -Infinity;
  const bv = typeof b[field] === 'number' && isFinite(b[field]) ? b[field] : -Infinity;
  return bv - av;
}

function rateBarWidth(value, max) {
  return typeof value === 'number' && isFinite(value) && max > 0
    ? (value / max * 100).toFixed(1)
    : '0.0';
}

function renderTopDetailsTable(containerId, rows, metricKey, metricLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state"><p>No data matching current filters.</p></div>';
    return;
  }

  container.innerHTML = `
    <table class="top-details-table">
      <thead>
        <tr>
          <th>Company</th>
          <th>Product</th>
          <th>Market</th>
          <th class="num">Sent</th>
          <th class="num">Delivered</th>
          <th class="num">Opens</th>
          <th class="num">Clicks</th>
          <th class="num">Open Rate</th>
          <th class="num">Click Rate</th>
          <th class="num">CTOR</th>
          <th class="num">${escHtml(metricLabel)}</th>
          <th>Date Range</th>
          <th class="num">Rows</th>
          <th class="num">Files</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escHtml(r.template)}</td>
            <td>${escHtml(r.product || '(Unknown)')}</td>
            <td>${escHtml(r.market || '(Unknown)')}</td>
            <td class="num">${fmtNum(r.sent)}</td>
            <td class="num">${fmtNum(r.delivered)}</td>
            <td class="num">${fmtNum(r.opens)}</td>
            <td class="num">${fmtNum(r.clicks)}</td>
            <td class="num">${fmtPct(r.openRate)}</td>
            <td class="num">${fmtPct(r.clickRate)}</td>
            <td class="num">${fmtPct(r.ctor)}</td>
            <td class="num">${metricKey === 'efficiencyScore' ? r[metricKey].toFixed(2) : fmtPct(r[metricKey])}</td>
            <td>${escHtml(formatDateRange(r.firstDate, r.lastDate))}</td>
            <td class="num">${fmtNum(r.recordCount)}</td>
            <td class="num" title="${escAttr(r.sourceNames.join(', '))}">${fmtNum(r.sourceCount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderOrUpdateChart(chart, canvasId, config, fullLabels = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return chart;

  const ctx = canvas.getContext('2d');

  if (chart) {
    chart.data = config.data;
    chart.options = config.options;
    chart.$fullLabels = fullLabels;
    chart.update('none');
    return chart;
  }

  const nextChart = new Chart(ctx, config);
  nextChart.$fullLabels = fullLabels;
  return nextChart;
}

function baseBarOptions({ horizontal = false, percent = false, showLegend = false } = {}) {
  const valueAxis = horizontal ? 'x' : 'y';
  const categoryAxis = horizontal ? 'y' : 'x';

  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: showLegend, position: 'top' },
      tooltip: {
        callbacks: {
          title: items => {
            const chart = items[0].chart;
            const idx = items[0].dataIndex;
            return chart.$fullLabels ? chart.$fullLabels[idx] : items[0].label;
          },
          label: ctx => {
            const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
            const rawValue = horizontal ? ctx.parsed.x : ctx.parsed.y;
            return label + (percent ? fmtPct(rawValue) : fmtNum(rawValue));
          },
        },
      },
    },
    scales: {
      [categoryAxis]: {
        grid: { display: false },
        ticks: {
          font: { family: "'DM Sans'", size: 11 },
        },
      },
      [valueAxis]: {
        beginAtZero: true,
        grid: { color: '#e6e3dd' },
        ticks: {
          font: { family: "'IBM Plex Mono'", size: 11 },
          callback: v => percent ? v + '%' : fmtNum(v),
        },
      },
    },
  };
}

function updateTopClickRateChart() {
  const rows = limitTop(
    withMinimumDelivered(getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])),
    'clickRate'
  );

  const fullLabels = rows.map(r => r.template);
  const labels = rows.map(r => shortLabel(r.template));

  topClickRateChart = renderOrUpdateChart(topClickRateChart, 'topClickRateChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Click Rate',
        data: rows.map(r => chartRateValue(r.clickRate)),
        backgroundColor: '#00c8aa',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: baseBarOptions({ horizontal: true, percent: true }),
  }, fullLabels);

  renderTopDetailsTable('topClickRateDetails', rows, 'clickRate', 'Click Rate');
}

function updateTopCtorChart() {
  const rows = limitTop(
    withMinimumDelivered(getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])),
    'ctor'
  );

  const fullLabels = rows.map(r => r.template);
  const labels = rows.map(r => shortLabel(r.template));

  topCtorChart = renderOrUpdateChart(topCtorChart, 'topCtorChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'CTOR',
        data: rows.map(r => chartRateValue(r.ctor)),
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: baseBarOptions({ horizontal: true, percent: true }),
  }, fullLabels);

  renderTopDetailsTable('topCtorDetails', rows, 'ctor', 'CTOR');
}

function updateSentByMarketChart() {
  const rows = getGroupedPerformance(filteredRecords, ['market'])
    .sort((a, b) => b.sent - a.sent);

  sentByMarketChart = renderOrUpdateChart(sentByMarketChart, 'sentByMarketChart', {
    type: 'bar',
    data: {
      labels: rows.map(r => r.market),
      datasets: [{
        label: 'Sent',
        data: rows.map(r => Math.round(r.sent)),
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: baseBarOptions(),
  });
  renderChartCaption('sentByMarketChart', buildTopValueCaption(rows, 'market', 'sent', '#3b82f6', fmtNum));
}

function updateClickRateByMarketChart() {
  const rows = getGroupedPerformance(filteredRecords, ['market'])
    .sort((a, b) => sortNumberDesc(a, b, 'clickRate'));

  clickRateByMarketChart = renderOrUpdateChart(clickRateByMarketChart, 'clickRateByMarketChart', {
    type: 'bar',
    data: {
      labels: rows.map(r => r.market),
      datasets: [{
        label: 'Click Rate',
        data: rows.map(r => chartRateValue(r.clickRate)),
        backgroundColor: '#00c8aa',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: baseBarOptions({ percent: true }),
  });
  renderChartCaption('clickRateByMarketChart', buildTopValueCaption(rows, 'market', 'clickRate', '#00c8aa'));
}

function updateProductPerformanceChart() {
  const rows = getGroupedPerformance(filteredRecords, ['product'])
    .sort((a, b) => sortNumberDesc(a, b, 'sent'));

  productPerformanceChart = renderOrUpdateChart(productPerformanceChart, 'productPerformanceChart', {
    type: 'bar',
    data: {
      labels: rows.map(r => r.product),
      datasets: [
        {
          label: 'Open Rate',
          data: rows.map(r => chartRateValue(r.openRate)),
          backgroundColor: '#f59e0b',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Click Rate',
          data: rows.map(r => chartRateValue(r.clickRate)),
          backgroundColor: '#00c8aa',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'CTOR',
          data: rows.map(r => chartRateValue(r.ctor)),
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: baseBarOptions({ percent: true, showLegend: true }),
  });
  renderChartCaption('productPerformanceChart', buildProductCaption(rows));
}

function updateDeliveryRateTrendChart() {
  const byDate = getGroupedPerformance(filteredRecords, ['date'])
    .filter(r => r.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const labels = byDate.map(r => {
    const parts = String(r.date).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : r.date;
  });

  deliveryRateTrendChart = renderOrUpdateChart(deliveryRateTrendChart, 'deliveryRateTrendChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Delivery Rate',
        data: byDate.map(r => +r.deliveryRate.toFixed(2)),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,.08)',
        tension: .35,
        pointRadius: 3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Delivery Rate: ${fmtPct(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#e6e3dd' },
          ticks: { font: { family: "'IBM Plex Mono'", size: 10 }, maxRotation: 45 },
        },
        y: {
          beginAtZero: false,
          grid: { color: '#e6e3dd' },
          ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 11 } },
        },
      },
    },
  });
  renderChartCaption('deliveryRateTrendChart', buildDeliveryTrendCaption(byDate));
}

function updateEfficiencyScoreChart() {
  const rows = limitTop(
    withMinimumDelivered(getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])),
    'efficiencyScore'
  );

  const fullLabels = rows.map(r => r.template);
  const labels = rows.map(r => shortLabel(r.template));

  efficiencyScoreChart = renderOrUpdateChart(efficiencyScoreChart, 'efficiencyScoreChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Efficiency Score',
        data: rows.map(r => +r.efficiencyScore.toFixed(2)),
        backgroundColor: '#f43f5e',
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: baseBarOptions({ horizontal: true, percent: false }),
  }, fullLabels);

  renderTopDetailsTable('efficiencyScoreDetails', rows, 'efficiencyScore', 'Score');
}

function updateInsightCharts() {
  updateWowChangeChart();
  updateMarketProductHeatmap();
  updateSizePerformanceChart();
  updateChannelSplitChart();
  updateTopOverallCampaignsChart();
  updateBestWorstCampaigns();
  updateRepeatCampaignTracking();
  updateTopClickRateChart();
  updateTopCtorChart();
  updateSentByMarketChart();
  updateClickRateByMarketChart();
  updateProductPerformanceChart();
  updateCampaignGroupPerformanceChart();
  updateDeliveryRateTrendChart();
  updateEfficiencyScoreChart();
}

/* ============================================================
   9. UI — COMPANY COMPARISON TABLE
   ============================================================ */

function updateTable() {
  const grouped = {};

  filteredRecords.forEach(r => {
    const key = `${r.template}||${r.product}||${r.market}`;

    if (!grouped[key]) {
      grouped[key] = {
        template: r.template,
        product: r.product,
        market: r.market,
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        openRateWeightedTotal: 0,
        openRateWeight: 0,
        clickRateWeightedTotal: 0,
        clickRateWeight: 0,
        ctorWeightedTotal: 0,
        ctorWeight: 0,
        hasOpens: false,
        hasClicks: false,
      };
    }

    grouped[key].sent += r.sent;
    grouped[key].delivered += r.delivered;
    grouped[key].opens += r.opens;
    grouped[key].clicks += r.clicks;
    grouped[key].hasOpens = grouped[key].hasOpens || !!r.hasOpens;
    grouped[key].hasClicks = grouped[key].hasClicks || !!r.hasClicks;

    if (r.openRate !== null && r.openRate !== undefined && isFinite(r.openRate) && r.delivered > 0) {
      grouped[key].openRateWeightedTotal += r.openRate * r.delivered;
      grouped[key].openRateWeight += r.delivered;
    }

    if (r.clickRate !== null && r.clickRate !== undefined && isFinite(r.clickRate) && r.delivered > 0) {
      grouped[key].clickRateWeightedTotal += r.clickRate * r.delivered;
      grouped[key].clickRateWeight += r.delivered;
    }

    if (r.ctor !== null && r.ctor !== undefined && isFinite(r.ctor) && r.opens > 0) {
      grouped[key].ctorWeightedTotal += r.ctor * r.opens;
      grouped[key].ctorWeight += r.opens;
    }
  });

  let rows = Object.values(grouped).map(g => ({
    ...g,
    openRate: g.openRateWeight ? (g.openRateWeightedTotal / g.openRateWeight) : (g.hasOpens && g.delivered ? (g.opens / g.delivered * 100) : null),
    clickRate: g.clickRateWeight ? (g.clickRateWeightedTotal / g.clickRateWeight) : (g.hasClicks && g.delivered ? (g.clicks / g.delivered * 100) : null),
    ctor: g.ctorWeight ? (g.ctorWeightedTotal / g.ctorWeight) : (g.hasOpens && g.hasClicks && g.opens ? (g.clicks / g.opens * 100) : null),
  }));

  if (tableSearch) {
    const q = tableSearch.toLowerCase();

    rows = rows.filter(r =>
      r.template.toLowerCase().includes(q) ||
      r.product.toLowerCase().includes(q) ||
      r.market.toLowerCase().includes(q)
    );
  }

  rows.sort((a, b) => {
    let va = a[tableSortCol];
    let vb = b[tableSortCol];

    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();

    if (va < vb) return tableSortDir === 'asc' ? -1 : 1;
    if (va > vb) return tableSortDir === 'asc' ? 1 : -1;

    return 0;
  });

  const maxOR = Math.max(...rows.map(r => r.openRate), 1);
  const maxCR = Math.max(...rows.map(r => r.clickRate), 1);
  const maxCT = Math.max(...rows.map(r => r.ctor), 1);

  const tbody = document.getElementById('tableBody');

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No data matching current filters.</p>
      </div></td></tr>`;

    document.getElementById('tableFooter').textContent = '';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escHtml(r.template)}</td>
      <td><span class="tag tag-${cssClassSafe(r.product)}">${escHtml(r.product)}</span></td>
      <td>${escHtml(r.market)}</td>
      <td class="num">${fmtNum(r.sent)}</td>
      <td class="num">${fmtNum(r.delivered)}</td>
      <td class="num">
        <span class="rate-cell">
          ${fmtPct(r.openRate)}
          <span class="rate-bar"><span class="rate-bar-fill" style="width:${rateBarWidth(r.openRate, maxOR)}%"></span></span>
        </span>
      </td>
      <td class="num">
        <span class="rate-cell">
          ${fmtPct(r.clickRate)}
          <span class="rate-bar"><span class="rate-bar-fill" style="width:${rateBarWidth(r.clickRate, maxCR)}%"></span></span>
        </span>
      </td>
      <td class="num">
        <span class="rate-cell">
          ${fmtPct(r.ctor)}
          <span class="rate-bar"><span class="rate-bar-fill" style="width:${rateBarWidth(r.ctor, maxCT)}%"></span></span>
        </span>
      </td>
    </tr>
  `).join('');

  document.getElementById('tableFooter').textContent =
    `Showing ${rows.length} template${rows.length !== 1 ? 's' : ''}`;

  document.querySelectorAll('.data-table thead th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');

    if (th.dataset.col === tableSortCol) {
      th.classList.add(tableSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/* ============================================================
   10. SIDEBAR — FILTER CONTROLS
   ============================================================ */

function buildFilterOptions() {
  const products = [...new Set(allRecords.map(r => r.product))].sort();
  const markets = [...new Set(allRecords.map(r => r.market))].sort();
  const audiences = [...new Set(allRecords.map(r => inferAudience(r.template)))].sort();
  const templates = [...new Set(allRecords.map(r => r.template))].sort();
  const options = { products, markets, audiences, templates };

  pruneSavedFilters(options);

  buildMultiSelect('productSelect', products, filterState.products);
  buildMultiSelect('marketSelect', markets, filterState.markets);
  buildMultiSelect('audienceSelect', audiences, filterState.audiences);
  buildMultiSelect('templateSelect', templates, filterState.templates);
  saveFilterState();
}

function buildMultiSelect(id, options, selectedSet) {
  const container = document.getElementById(id);
  const dropdown = container.querySelector('.multi-select-dropdown');

  dropdown.innerHTML = options.map(opt => `
    <label class="ms-option">
      <input type="checkbox" value="${escHtml(opt)}"
        ${selectedSet.has(opt) ? 'checked' : ''} />
      ${escHtml(opt)}
    </label>
  `).join('');

  dropdown.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const field = container.dataset.field;
      const checked = [...dropdown.querySelectorAll('input:checked')].map(c => c.value);
      updateFilterField(field, checked);
    });
  });

  updateMultiSelectLabel(container, selectedSet);
}

function updateMultiSelectLabel(container, selectedSet) {
  const label = container.querySelector('.ms-label');
  const field = container.dataset.field;
  const fieldNames = {
    product: 'Products',
    market: 'Markets',
    audience: 'Audiences',
    template: 'Templates',
  };

  if (!selectedSet.size) {
    label.textContent = `All ${fieldNames[field]}`;
  } else if (selectedSet.size === 1) {
    label.textContent = [...selectedSet][0];
  } else {
    label.textContent = `${selectedSet.size} selected`;
  }
}

function updateFilterField(field, values) {
  const fieldMap = {
    product: 'products',
    market: 'markets',
    audience: 'audiences',
    template: 'templates',
  };

  filterState[fieldMap[field]] = new Set(values);

  updateMultiSelectLabel(
    document.querySelector(`.multi-select[data-field="${field}"]`),
    filterState[fieldMap[field]]
  );

  saveFilterState();
  refreshDashboard();
}

function initMultiSelects() {
  document.querySelectorAll('.multi-select').forEach(ms => {
    ms.addEventListener('click', e => {
      e.stopPropagation();
    });

    ms.querySelector('.multi-select-trigger').addEventListener('click', e => {
      e.stopPropagation();

      const isOpen = ms.classList.contains('open');

      document.querySelectorAll('.multi-select.open').forEach(o => {
        o.classList.remove('open');
      });

      if (!isOpen) ms.classList.add('open');
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.multi-select.open').forEach(ms => {
      ms.classList.remove('open');
    });
  });
}

function initMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('mobileSidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !toggle || !overlay) return;

  const setOpen = isOpen => {
    sidebar.classList.toggle('mobile-open', isOpen);
    overlay.classList.toggle('open', isOpen);
    toggle.classList.toggle('sidebar-open', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close filters' : 'Open filters');
  };

  toggle.addEventListener('click', () => {
    setOpen(!sidebar.classList.contains('mobile-open'));
  });

  overlay.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  });
}

let datePicker = null;

function initDatePicker() {
  datePicker = flatpickr('#dateRangePicker', {
    mode: 'range',
    dateFormat: 'Y-m-d',
    allowInput: false,
    locale: {
      firstDayOfWeek: 1,
    },
    onChange: selectedDates => {
      filterState.dateFrom = selectedDates[0] ? formatDate(selectedDates[0]) : null;
      filterState.dateTo = selectedDates[1] ? formatDate(selectedDates[1]) : null;
      saveFilterState();
      refreshDashboard();
    },
  });

  if (filterState.dateFrom || filterState.dateTo) {
    const dates = [filterState.dateFrom, filterState.dateTo].filter(Boolean);
    datePicker.setDate(dates, false);
  }
}

function syncFilterInputs() {
  const sentMinInput = document.getElementById('sentMinInput');
  const sentMaxInput = document.getElementById('sentMaxInput');

  if (sentMinInput) sentMinInput.value = filterState.sentMin !== null ? String(filterState.sentMin) : '';
  if (sentMaxInput) sentMaxInput.value = filterState.sentMax !== null ? String(filterState.sentMax) : '';
}

function resetFilters() {
  filterState = createEmptyFilterState();

  if (datePicker) datePicker.clear();
  localStorage.removeItem(STORAGE_FILTERS_KEY);

  const sentMinInput = document.getElementById('sentMinInput');
  const sentMaxInput = document.getElementById('sentMaxInput');
  if (sentMinInput) sentMinInput.value = '';
  if (sentMaxInput) sentMaxInput.value = '';

  buildFilterOptions();
  refreshDashboard();
}

/* ============================================================
   EXPORT
   ============================================================ */

function getExportRows() {
  return getGroupedPerformance(filteredRecords, ['template', 'product', 'market'])
    .sort((a, b) => b.sent - a.sent);
}

function getExportSummary() {
  return {
    ...aggregate(filteredRecords),
    records: filteredRecords.length,
    companies: getExportRows().length,
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportDoc() {
  const summary = getExportSummary();
  const weeklyRows = getWeeklyComparisonRows(filteredRecords);
  const generatedAt = new Date().toLocaleString();
  const charts = getExportChartImages();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sendout Dashboard Export</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1c1a17; }
        h1 { font-size: 22px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d0ccc5; padding: 6px; text-align: left; }
        th { background: #f4f3f0; }
        .num { text-align: right; }
      </style>
    </head>
    <body>
      <h1>Sendout Analytics Export</h1>
      <p>Generated: ${escHtml(generatedAt)}</p>
      <h2>Summary</h2>
      <table>
        <tr><th>Records</th><td class="num">${fmtNum(summary.records)}</td></tr>
        <tr><th>Companies</th><td class="num">${fmtNum(summary.companies)}</td></tr>
        <tr><th>Total Sent</th><td class="num">${fmtNum(summary.totalSent)}</td></tr>
        <tr><th>Total Delivered</th><td class="num">${fmtNum(summary.totalDelivered)}</td></tr>
        <tr><th>Delivery Rate</th><td class="num">${fmtPct(summary.deliveryRate)}</td></tr>
        <tr><th>Open Rate</th><td class="num">${fmtPct(summary.openRate)}</td></tr>
        <tr><th>Click Rate</th><td class="num">${fmtPct(summary.clickRate)}</td></tr>
        <tr><th>CTOR</th><td class="num">${fmtPct(summary.ctor)}</td></tr>
      </table>
      <h2>Charts</h2>
      ${charts.map(chart => `
        <h3>${escHtml(chart.title)}</h3>
        <p><img src="${chart.src}" style="width: 680px; max-width: 100%; height: auto;" /></p>
      `).join('')}
      <h2>Weekly Comparison</h2>
      <table>
        <thead>
          <tr>
            <th>Week</th><th>Sent</th><th>Delivered</th><th>Delivery Rate</th>
            <th>Open Rate</th><th>Click Rate</th><th>CTOR</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyRows.map(r => `
            <tr>
              <td>${escHtml(r.week)}</td>
              <td class="num">${fmtNum(r.totalSent)}</td>
              <td class="num">${fmtNum(r.totalDelivered)}</td>
              <td class="num">${fmtPct(r.deliveryRate)}</td>
              <td class="num">${fmtPct(r.openRate)}</td>
              <td class="num">${fmtPct(r.clickRate)}</td>
              <td class="num">${fmtPct(r.ctor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;

  downloadBlob(new Blob([html], { type: 'application/msword;charset=utf-8' }), makeExportName('doc'));
  showToast('DOC export created.');
}

function getExportChartImages() {
  return [
    ['funnelChart', 'Conversion Funnel'],
    ['trendChart', 'Daily Performance'],
    ['wowChangeChart', 'Week-over-week Change'],
    ['sizePerformanceChart', 'Volume vs Engagement (By Campaign)'],
    ['channelSplitChart', 'Channel Split'],
    ['topOverallCampaignsChart', 'Top 3 Campaigns by Overall Performance'],
    ['campaignGroupPerformanceChart', 'Performance by Campaign Group'],
    ['topClickRateChart', 'Top 10 Campaigns by Click Rate'],
    ['topCtorChart', 'Top 10 Campaigns by CTOR'],
    ['sentByMarketChart', 'Sent Volume by Market'],
    ['clickRateByMarketChart', 'Click Rate by Market'],
    ['productPerformanceChart', 'Product Performance'],
    ['deliveryRateTrendChart', 'Delivery Rate Over Time'],
    ['efficiencyScoreChart', 'Efficiency Score'],
  ].map(([id, title]) => {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    try {
      return { title, src: getChartImage(canvas, { scale: 2, includeTitle: false }) };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function exportWeeklyDoc() {
  const summary = getExportSummary();
  const weeklyRows = getWeeklyComparisonRows(filteredRecords);
  const charts = getExportChartImages().filter(c =>
    ['Week-over-week Change', 'Daily Performance', 'Delivery Rate Over Time'].includes(c.title)
  );
  exportDocHtml('Weekly Performance Report', summary, weeklyRows, charts);
}

function exportDeepDiveDoc() {
  const summary = getExportSummary();
  const weeklyRows = getWeeklyComparisonRows(filteredRecords);
  const charts = getExportChartImages().filter(c =>
    ['Volume vs Engagement (By Campaign)', 'Channel Split', 'Top 3 Campaigns by Overall Performance', 'Performance by Campaign Group', 'Top 10 Campaigns by Click Rate', 'Top 10 Campaigns by CTOR', 'Sent Volume by Market', 'Click Rate by Market'].includes(c.title)
  );
  exportDocHtml('Campaign Deep Dive Report', summary, weeklyRows, charts);
}

function exportDocHtml(title, summary, weeklyRows, charts) {
  const generatedAt = new Date().toLocaleString();
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>${escHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1c1a17; }
        h1 { font-size: 22px; }
        h2 { margin-top: 22px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #d0ccc5; padding: 6px; text-align: left; }
        th { background: #f4f3f0; }
        .num { text-align: right; }
      </style>
    </head><body>
      <h1>${escHtml(title)}</h1>
      <p>Generated: ${escHtml(generatedAt)}</p>
      <h2>Summary</h2>
      <table>
        <tr><th>Records</th><td class="num">${fmtNum(summary.records)}</td></tr>
        <tr><th>Companies</th><td class="num">${fmtNum(summary.companies)}</td></tr>
        <tr><th>Total Sent</th><td class="num">${fmtNum(summary.totalSent)}</td></tr>
        <tr><th>Total Delivered</th><td class="num">${fmtNum(summary.totalDelivered)}</td></tr>
        <tr><th>Delivery Rate</th><td class="num">${fmtPct(summary.deliveryRate)}</td></tr>
        <tr><th>Open Rate</th><td class="num">${fmtPct(summary.openRate)}</td></tr>
        <tr><th>Click Rate</th><td class="num">${fmtPct(summary.clickRate)}</td></tr>
        <tr><th>CTOR</th><td class="num">${fmtPct(summary.ctor)}</td></tr>
      </table>
      <h2>Charts</h2>
      ${charts.map(chart => `<h3>${escHtml(chart.title)}</h3><p><img src="${chart.src}" style="width: 680px; max-width: 100%; height: auto;" /></p>`).join('')}
      <h2>Weekly Comparison</h2>
      <table>
        <thead><tr><th>Week</th><th>Sent</th><th>Delivered</th><th>Delivery Rate</th><th>Open Rate</th><th>Click Rate</th><th>CTOR</th></tr></thead>
        <tbody>${weeklyRows.map(r => `
          <tr><td>${escHtml(r.week)}</td><td class="num">${fmtNum(r.totalSent)}</td><td class="num">${fmtNum(r.totalDelivered)}</td><td class="num">${fmtPct(r.deliveryRate)}</td><td class="num">${fmtPct(r.openRate)}</td><td class="num">${fmtPct(r.clickRate)}</td><td class="num">${fmtPct(r.ctor)}</td></tr>
        `).join('')}</tbody>
      </table>
    </body></html>
  `;
  downloadBlob(new Blob([html], { type: 'application/msword;charset=utf-8' }), makeExportName('doc'));
  showToast(`${title} created.`);
}

function makeExportName(ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `sendout-dashboard-${stamp}.${ext}`;
}

function textBoxXml(id, x, y, w, h, text, fontSize = 1800, bold = false) {
  const safeLines = String(text ?? '').split('\n').map(line => `
    <a:p><a:r><a:rPr lang="en-US" sz="${fontSize}"${bold ? ' b="1"' : ''}/><a:t>${escapeXml(line)}</a:t></a:r></a:p>
  `).join('');

  return `
    <p:sp>
      <p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
      <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${safeLines}</p:txBody>
    </p:sp>
  `;
}

function slideXml(shapes) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld><p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes}
    </p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
  </p:sld>`;
}

function exportPptx() {
  const summary = getExportSummary();
  const rows = getExportRows().slice(0, 12);
  const topRows = rows.map((r, idx) =>
    `${idx + 1}. ${r.template} | ${r.market} | Sent ${fmtNum(r.sent)} | Click ${fmtPct(r.clickRate)}`
  ).join('\n');

  const slide1 = slideXml([
    textBoxXml(2, 450000, 350000, 8200000, 550000, 'Sendout Analytics Export', 3200, true),
    textBoxXml(3, 450000, 1100000, 4200000, 2200000,
      `Records: ${fmtNum(summary.records)}\nCompanies: ${fmtNum(summary.companies)}\nSent: ${fmtNum(summary.totalSent)}\nDelivered: ${fmtNum(summary.totalDelivered)}`, 1900),
    textBoxXml(4, 5000000, 1100000, 4200000, 2200000,
      `Delivery Rate: ${fmtPct(summary.deliveryRate)}\nOpen Rate: ${fmtPct(summary.openRate)}\nClick Rate: ${fmtPct(summary.clickRate)}\nCTOR: ${fmtPct(summary.ctor)}`, 1900),
  ].join(''));

  const slide2 = slideXml([
    textBoxXml(2, 450000, 350000, 8200000, 500000, 'Top Companies by Sent Volume', 2800, true),
    textBoxXml(3, 450000, 1000000, 8500000, 4200000, topRows || 'No data for current filters.', 1500),
  ].join(''));

  const files = makePptxFiles(slide1, slide2);
  downloadBlob(new Blob([createZip(files)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), makeExportName('pptx'));
  showToast('PPTX export created.');
}

function makePptxFiles(slide1, slide2) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
    <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
    <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
    <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
    <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
    <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  </Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`;
  const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`;
  const slideRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  const master = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>`;
  const masterRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
  const layout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const layoutRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
  const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SendIQ"><a:themeElements><a:clrScheme name="SendIQ"><a:dk1><a:srgbClr val="1C1A17"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="6B6660"/></a:dk2><a:lt2><a:srgbClr val="F4F3F0"/></a:lt2><a:accent1><a:srgbClr val="00C8AA"/></a:accent1><a:accent2><a:srgbClr val="3B82F6"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="F43F5E"/></a:accent4><a:accent5><a:srgbClr val="8B5CF6"/></a:accent5><a:accent6><a:srgbClr val="D0CCC5"/></a:accent6><a:hlink><a:srgbClr val="3B82F6"/></a:hlink><a:folHlink><a:srgbClr val="8B5CF6"/></a:folHlink></a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Default"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

  return [
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['ppt/presentation.xml', presentation],
    ['ppt/_rels/presentation.xml.rels', presRels],
    ['ppt/slides/slide1.xml', slide1],
    ['ppt/slides/slide2.xml', slide2],
    ['ppt/slides/_rels/slide1.xml.rels', slideRel],
    ['ppt/slides/_rels/slide2.xml.rels', slideRel],
    ['ppt/slideMasters/slideMaster1.xml', master],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', masterRel],
    ['ppt/slideLayouts/slideLayout1.xml', layout],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', layoutRel],
    ['ppt/theme/theme1.xml', theme],
  ];
}

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU16(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZip(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  const chunks = [];
  const { time, day } = dosDateTime();
  let offset = 0;

  files.forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const crc = crc32(data);
    const header = [];

    writeU32(header, 0x04034b50);
    writeU16(header, 20);
    writeU16(header, 0);
    writeU16(header, 0);
    writeU16(header, time);
    writeU16(header, day);
    writeU32(header, crc);
    writeU32(header, data.length);
    writeU32(header, data.length);
    writeU16(header, nameBytes.length);
    writeU16(header, 0);
    chunks.push(new Uint8Array(header), nameBytes, data);

    const cdir = [];
    writeU32(cdir, 0x02014b50);
    writeU16(cdir, 20);
    writeU16(cdir, 20);
    writeU16(cdir, 0);
    writeU16(cdir, 0);
    writeU16(cdir, time);
    writeU16(cdir, day);
    writeU32(cdir, crc);
    writeU32(cdir, data.length);
    writeU32(cdir, data.length);
    writeU16(cdir, nameBytes.length);
    writeU16(cdir, 0);
    writeU16(cdir, 0);
    writeU16(cdir, 0);
    writeU16(cdir, 0);
    writeU32(cdir, 0);
    writeU32(cdir, offset);
    central.push(new Uint8Array(cdir), nameBytes);

    offset += header.length + nameBytes.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, centralSize);
  writeU32(end, centralOffset);
  writeU16(end, 0);

  const allParts = [...chunks, ...central, new Uint8Array(end)];
  const total = allParts.reduce((sum, part) => sum + part.length, 0);
  const zip = new Uint8Array(total);
  let pos = 0;
  allParts.forEach(part => {
    zip.set(part, pos);
    pos += part.length;
  });
  return zip;
}

/* ============================================================
   11. IMPORT
   ============================================================ */

function initImport() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener('change', () => {
    handleFiles([...fileInput.files]);
    fileInput.value = '';
  });

  dropZone.addEventListener('click', e => {
    if (
      e.target !== dropZone.querySelector('.btn-upload') &&
      e.target !== fileInput
    ) {
      fileInput.click();
    }
  });
}

function makeFileId(file) {
  return [
    file.name,
    file.size,
    file.lastModified || 0,
  ].join('|');
}

function makeFileMeta(file, recordCount) {
  return {
    id: makeFileId(file),
    name: file.name,
    size: file.size,
    lastModified: file.lastModified || 0,
    importedAt: new Date().toISOString(),
    recordCount,
  };
}

function renderImportedFiles() {
  const container = document.getElementById('importedFiles');
  if (!container) return;

  if (!importedFiles.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = importedFiles.map(file => `
    <div class="imported-file">
      <div>
        <div class="imported-file-name" title="${escAttr(file.name)}">${escHtml(file.name)}</div>
        <div class="imported-file-meta">${fmtNum(file.recordCount || 0)} records</div>
      </div>
      <button class="btn-file-remove" type="button" data-file-id="${escAttr(file.id)}" title="Remove this file">x</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-file-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeImportedFile(btn.dataset.fileId);
    });
  });
}

function removeImportedFile(fileId) {
  const file = importedFiles.find(f => f.id === fileId);
  if (!file) return;

  if (!confirm(`Delete data imported from "${file.name}"?`)) return;

  allRecords = allRecords.filter(r => r.sourceFileId !== fileId);
  importedFiles = importedFiles.filter(f => f.id !== fileId);

  saveAllState();
  buildFilterOptions();
  renderImportedFiles();
  refreshDashboard();
  setImportStatus(`Removed ${file.name}`);
  setLastUpdated();
  showToast(`Removed data from ${file.name}.`);
}

async function handleFiles(files) {
  const dataFiles = files.filter(f => /\.(xlsx|csv)$/i.test(f.name));

  if (!dataFiles.length) {
    showToast('No .xlsx or .csv files found in selection.');
    return;
  }

  if (usingDemoData) {
    allRecords = [];
    usingDemoData = false;
  }

  let totalAdded = 0;
  let importedCount = 0;

  for (const file of dataFiles) {
    const fileId = makeFileId(file);

    if (importedFiles.some(f => f.id === fileId)) {
      showToast(`${file.name} is already imported.`);
      continue;
    }

    setImportStatus(`Parsing ${file.name}…`);

    try {
      const buffer = await file.arrayBuffer();
      const parsedRecords = file.name.toLowerCase().endsWith('.csv')
        ? parseCsvText(await file.text())
        : parseXlsxBuffer(new Uint8Array(buffer));

      const incoming = parsedRecords.map(rec => ({
        ...rec,
        sourceFileId: fileId,
        sourceFileName: file.name,
      }));
      const { merged, added } = mergeRecords(allRecords, incoming);

      allRecords = merged;
      totalAdded += added;
      importedCount += 1;

      importedFiles.push(makeFileMeta(file, added));
    } catch (err) {
      console.error('Error parsing', file.name, err);
      showToast(`Error parsing ${file.name}: ${err.message}`);
    }
  }

  if (!importedCount) {
    renderImportedFiles();
    setImportStatus('No new records imported');
    return;
  }

  localStorage.setItem(STORAGE_DEMO_DISABLED_KEY, '1');
  saveAllState();
  buildFilterOptions();
  renderImportedFiles();
  refreshDashboard();
  setImportStatus(`✓ ${totalAdded} new records imported`);
  setLastUpdated();
  showToast(`Imported ${totalAdded} new records from ${importedCount} file(s).`);
}

/* ============================================================
   MAIN REFRESH
   ============================================================ */

function refreshDashboard() {
  applyFilters();
  updateKPIs();
  updateFunnelChart();
  updateTrendChart();
  updateInsightCharts();
  updateTable();
}

/* ============================================================
   HELPERS
   ============================================================ */

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'k';

  return Math.round(n).toLocaleString();
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(2) + '%';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}

function formatDateRange(firstDate, lastDate) {
  if (!firstDate && !lastDate) return '';
  if (!lastDate || firstDate === lastDate) return firstDate;
  return `${firstDate} - ${lastDate}`;
}

function cssClassSafe(str) {
  return String(str || 'other')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
}

function setImportStatus(msg) {
  const el = document.getElementById('importStatus');
  if (el) el.textContent = msg;
}

function setLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (el) {
    el.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }
}

let toastTimer = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

/* ============================================================
   DEMO DATA
   ============================================================ */

const DEMO_DATA = [
  {
    date: '2026-05-04',
    template: 'CRM / Retention / Cashback EU',
    product: 'Casino',
    market: 'EU',
    sent: 102,
    delivered: 102,
    opens: 36,
    clicks: 1,
    openRate: 35.29,
    clickRate: 0.98,
    ctor: 2.78,
    deliveryRate: 100,
  },
  {
    date: '2026-05-04',
    template: 'CRM / Retention / Cashback LV 50',
    product: 'Casino',
    market: 'LV',
    sent: 2734,
    delivered: 2718,
    opens: 633,
    clicks: 94,
    openRate: 23.29,
    clickRate: 3.46,
    ctor: 14.85,
    deliveryRate: 99.4,
  },
  {
    date: '2026-05-10',
    template: 'VIP / SPORT / LV / TOP LOSERS',
    product: 'Sport',
    market: 'LV',
    sent: 300,
    delivered: 295,
    opens: 80,
    clicks: 22,
    openRate: 27.12,
    clickRate: 7.46,
    ctor: 27.5,
    deliveryRate: 98.3,
  },
  {
    date: '2026-05-15',
    template: 'Weekly Newsletter / Casino / FI',
    product: 'Casino',
    market: 'FI',
    sent: 5000,
    delivered: 4920,
    opens: 890,
    clicks: 130,
    openRate: 18.09,
    clickRate: 2.64,
    ctor: 14.61,
    deliveryRate: 98.4,
  },
  {
    date: '2026-05-20',
    template: 'SMS Promo / Sport / SE',
    product: 'Sport',
    market: 'SE',
    sent: 1200,
    delivered: 1190,
    opens: 0,
    clicks: 88,
    openRate: 0,
    clickRate: 7.39,
    ctor: 0,
    deliveryRate: 99.2,
  },
];

/* ============================================================
   KPI COPY
   ============================================================ */

function copyKpiMetricsTextFallback() {
  const rows = [
    { label: 'Sent',                    id: 'kpiSent' },
    { label: 'Delivered',               id: 'kpiDelivered' },
    { label: 'Unique Opens',            id: 'kpiOpens' },
    { label: 'Unique Clicks',           id: 'kpiClicks' },
    { label: 'Delivery Rate',           id: 'kpiDeliveryRate' },
    { label: 'Open Rate',               id: 'kpiOpenRate' },
    { label: 'CTR (Click Rate)',         id: 'kpiClickRate' },
    { label: 'CTOR (Click-to-Open Rate)', id: 'kpiCtor' },
  ];

  const text = 'Metric\tResult\n' + rows.map(r => {
    const el = document.getElementById(r.id);
    return `${r.label}\t${el ? el.textContent.trim() : '—'}`;
  }).join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Metrics copied to clipboard.'))
      .catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Metrics copied to clipboard.');
  } catch {
    showToast('Copy failed — select and copy manually.');
  }
  document.body.removeChild(ta);
}

function copyKpiMetrics() {
  const rows = getKpiCopyRows();
  const text = buildKpiCopyText(rows);

  const src = renderKpiMetricsImage(rows);
  if (!src) {
    fallbackCopyText(text);
    return;
  }

  const blob = dataUrlToBlob(src);

  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    downloadBlob(blob, 'SendIQ KPI Metrics.png');
    showToast('Clipboard image copy is unavailable, metrics image downloaded as PNG.');
    return;
  }

  navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    .then(() => showToast('Metrics image copied to clipboard.'))
    .catch(() => {
      downloadBlob(blob, 'SendIQ KPI Metrics.png');
      showToast('Clipboard blocked, metrics image downloaded as PNG.');
    });
}

function getKpiCopyRows() {
  return [
    { label: 'Sent', shortLabel: 'Sent', id: 'kpiSent', icon: 'mail' },
    { label: 'Delivered', shortLabel: 'Delivered', id: 'kpiDelivered', icon: 'check' },
    { label: 'Unique Opens', shortLabel: 'Unique Opens', id: 'kpiOpens', icon: 'eye' },
    { label: 'Unique Clicks', shortLabel: 'Unique Clicks', id: 'kpiClicks', icon: 'cursor' },
    { label: 'Delivery Rate', shortLabel: 'Delivery Rate', id: 'kpiDeliveryRate', icon: 'shield' },
    { label: 'Open Rate', shortLabel: 'Open Rate', id: 'kpiOpenRate', icon: 'eye' },
    { label: 'CTR (Click Rate)', shortLabel: 'CTR', note: '(Click Rate)', id: 'kpiClickRate', icon: 'chart' },
    { label: 'CTOR (Click-to-Open Rate)', shortLabel: 'CTOR', note: '(Click-to-Open Rate)', id: 'kpiCtor', icon: 'target' },
  ].map(row => ({
    ...row,
    value: document.getElementById(row.id)?.textContent?.trim() || '-',
  }));
}

function buildKpiCopyText(rows) {
  return 'Metric\tResult\n' + rows.map(r => `${r.label}\t${r.value}`).join('\n');
}

function renderKpiMetricsImage(rows) {
  try {
    const scale = 2;
    const width = 820;
    const headerH = 72;
    const rowH = 66;
    const pad = 28;
    const height = pad + headerH + rows.length * rowH + pad;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,.10)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 12);
    ctx.fill();
    ctx.restore();

    const tableX = pad;
    const tableW = width - pad * 2;
    const tableY = pad;
    const headerGradient = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY);
    headerGradient.addColorStop(0, '#b80000');
    headerGradient.addColorStop(1, '#dc0000');
    ctx.fillStyle = headerGradient;
    roundedRect(ctx, tableX, tableY, tableW, 54, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = "800 18px 'DM Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('METRIC', tableX + 112, tableY + 27);
    ctx.textAlign = 'right';
    ctx.fillText('RESULT', tableX + tableW - 44, tableY + 27);

    const bodyY = tableY + headerH;
    rows.forEach((row, index) => {
      const y = bodyY + index * rowH;

      if (index === 4) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tableX + 18, y - 8);
        ctx.lineTo(tableX + tableW - 18, y - 8);
        ctx.stroke();
      }

      ctx.strokeStyle = '#eee9e3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX + 18, y + rowH - 4);
      ctx.lineTo(tableX + tableW - 18, y + rowH - 4);
      ctx.stroke();

      drawKpiCopyIcon(ctx, row.icon, tableX + 58, y + 29);

      ctx.fillStyle = '#111827';
      ctx.font = "700 18px 'DM Sans', sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.shortLabel, tableX + 104, y + 29);

      if (row.note) {
        const labelW = ctx.measureText(row.shortLabel).width;
        ctx.fillStyle = '#374151';
        ctx.font = "500 12px 'DM Sans', sans-serif";
        ctx.fillText(` ${row.note}`, tableX + 104 + labelW, y + 30);
      }

      ctx.fillStyle = '#c40000';
      ctx.font = "800 24px 'DM Sans', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(row.value, tableX + tableW - 44, y + 29);
    });

    return canvas.toDataURL('image/png', 1);
  } catch (e) {
    console.error('Unable to render KPI image', e);
    return '';
  }
}

function drawKpiCopyIcon(ctx, type, cx, cy) {
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.fillStyle = 'rgba(220,38,38,.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'mail') {
    roundedRect(ctx, cx - 12, cy - 8, 24, 16, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 7);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 12, cy - 7);
    ctx.stroke();
  } else if (type === 'check') {
    roundedRect(ctx, cx - 10, cy - 11, 20, 22, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx - 1, cy + 5);
    ctx.lineTo(cx + 7, cy - 6);
    ctx.stroke();
  } else if (type === 'eye') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'cursor') {
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 12);
    ctx.lineTo(cx + 8, cy + 1);
    ctx.lineTo(cx + 1, cy + 3);
    ctx.lineTo(cx + 6, cy + 12);
    ctx.lineTo(cx + 2, cy + 14);
    ctx.lineTo(cx - 3, cy + 5);
    ctx.lineTo(cx - 9, cy + 10);
    ctx.closePath();
    ctx.stroke();
  } else if (type === 'shield') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 11, cy - 8);
    ctx.lineTo(cx + 9, cy + 7);
    ctx.lineTo(cx, cy + 14);
    ctx.lineTo(cx - 9, cy + 7);
    ctx.lineTo(cx - 11, cy - 8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy);
    ctx.lineTo(cx - 1, cy + 4);
    ctx.lineTo(cx + 6, cy - 6);
    ctx.stroke();
  } else if (type === 'chart') {
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy + 10);
    ctx.lineTo(cx - 11, cy + 2);
    ctx.moveTo(cx - 2, cy + 10);
    ctx.lineTo(cx - 2, cy - 5);
    ctx.moveTo(cx + 7, cy + 10);
    ctx.lineTo(cx + 7, cy - 12);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.moveTo(cx + 18, cy);
    ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx, cy + 18);
    ctx.lineTo(cx, cy + 8);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ============================================================
   12. INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  allRecords = loadRecords();
  importedFiles = loadImportedFiles();
  filterState = loadFilterState();

  if (!allRecords.length && localStorage.getItem(STORAGE_DEMO_DISABLED_KEY) !== '1') {
    allRecords = DEMO_DATA;
    usingDemoData = true;
  }

  initMultiSelects();
  initDatePicker();
  initMobileSidebar();
  initImport();

  document.querySelectorAll('.data-table thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;

      if (tableSortCol === col) {
        tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        tableSortCol = col;
        tableSortDir = 'desc';
      }

      updateTable();
    });
  });

  document.getElementById('tableSearch').addEventListener('input', e => {
    tableSearch = e.target.value.trim();
    updateTable();
  });

  const sentMinInput = document.getElementById('sentMinInput');
  const sentMaxInput = document.getElementById('sentMaxInput');
  const updateSentFilter = () => {
    const minValue = sentMinInput && sentMinInput.value !== '' ? Number(sentMinInput.value) : null;
    const maxValue = sentMaxInput && sentMaxInput.value !== '' ? Number(sentMaxInput.value) : null;

    filterState.sentMin = minValue !== null && !isNaN(minValue) ? minValue : null;
    filterState.sentMax = maxValue !== null && !isNaN(maxValue) ? maxValue : null;
    saveFilterState();
    refreshDashboard();
  };

  if (sentMinInput) sentMinInput.addEventListener('input', updateSentFilter);
  if (sentMaxInput) sentMaxInput.addEventListener('input', updateSentFilter);

  document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

  const exportDocBtn = document.getElementById('exportDocBtn');
  const exportPptxBtn = document.getElementById('exportPptxBtn');
  const exportWeeklyDocBtn = document.getElementById('exportWeeklyDocBtn');
  const exportDeepDiveDocBtn = document.getElementById('exportDeepDiveDocBtn');

  if (exportDocBtn) exportDocBtn.addEventListener('click', exportDoc);
  if (exportPptxBtn) exportPptxBtn.addEventListener('click', exportPptx);
  if (exportWeeklyDocBtn) exportWeeklyDocBtn.addEventListener('click', exportWeeklyDoc);
  if (exportDeepDiveDocBtn) exportDeepDiveDocBtn.addEventListener('click', exportDeepDiveDoc);

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Delete all imported data? This cannot be undone.')) return;

    allRecords = [];
    importedFiles = [];
    usingDemoData = false;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FILES_KEY);
    localStorage.setItem(STORAGE_DEMO_DISABLED_KEY, '1');

    buildFilterOptions();
    renderImportedFiles();
    refreshDashboard();
    setImportStatus('');
    showToast('All data cleared.');
  });

  const copyKpiBtn = document.getElementById('copyKpiBtn');
  if (copyKpiBtn) copyKpiBtn.addEventListener('click', copyKpiMetrics);

  buildFilterOptions();
  syncFilterInputs();
  renderImportedFiles();
  refreshDashboard();
  initChartActions();
  setLastUpdated();

  window.addEventListener('resize', () => {
    clearTimeout(customCanvasResizeTimer);
    customCanvasResizeTimer = setTimeout(() => {
      if (funnelChart) {
        const canvas = document.getElementById('funnelChart');
        if (canvas) drawFunnelCanvas(canvas, funnelChart);
      }
      if (wowChangeChart) {
        const canvas = document.getElementById('wowChangeChart');
        if (canvas) drawWowTableCanvas(canvas, wowChangeChart);
      }
      if (topOverallCampaignsChart) {
        const canvas = document.getElementById('topOverallCampaignsChart');
        if (canvas) drawTopOverallCampaignsCanvas(canvas, topOverallCampaignsChart);
      }
    }, 120);
  });
});
