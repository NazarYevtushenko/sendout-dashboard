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
  if (record.channel) return record.channel;
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

let filterState = {
  dateFrom: null,
  dateTo: null,
  products: new Set(),
  markets: new Set(),
  templates: new Set(),
  sentMin: null,
  sentMax: null,
};

let tableSortCol = 'sent';
let tableSortDir = 'desc';
let tableSearch = '';

/* ============================================================
   4. DATA PIPELINE
   ============================================================ */

function applyFilters() {
  filteredRecords = allRecords.filter(r => {
    if (filterState.dateFrom && r.date < filterState.dateFrom) return false;
    if (filterState.dateTo && r.date > filterState.dateTo) return false;

    if (filterState.products.size && !filterState.products.has(r.product)) return false;
    if (filterState.markets.size && !filterState.markets.has(r.market)) return false;
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
    deliveryRate,
    openRate,
    clickRate,
    ctor,
  } = aggregate(filteredRecords);

  setText('kpiSent', fmtNum(totalSent));
  setText('kpiDelivered', fmtNum(totalDelivered));
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

function updateFunnelChart() {
  const { totalSent, totalDelivered, totalOpens, totalClicks } = aggregate(filteredRecords);

  const labels = ['Sent', 'Delivered', 'Opened', 'Clicked'];
  const data = [totalSent, totalDelivered, totalOpens, totalClicks];
  const colors = ['#3b82f6', '#00c8aa', '#f59e0b', '#f43f5e'];

  const ctx = document.getElementById('funnelChart').getContext('2d');

  if (funnelChart) {
    funnelChart.data.datasets[0].data = data;
    funnelChart.update('none');
    return;
  }

  funnelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmtNum(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#e6e3dd' },
          ticks: {
            font: { family: "'IBM Plex Mono'", size: 11 },
            callback: v => fmtNum(v),
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "'DM Sans'", size: 12 } },
        },
      },
    },
  });
}

/* ============================================================
   7. UI — TREND CHART
   ============================================================ */

let trendChart = null;
let weeklyComparisonChart = null;

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

  const labels = dates.map(d => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  });

  const ctx = document.getElementById('trendChart').getContext('2d');

  if (trendChart) {
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = openRates;
    trendChart.data.datasets[1].data = clickRates;
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

function updateWeeklyComparisonChart() {
  const rows = getWeeklyComparisonRows(filteredRecords);
  const canvas = document.getElementById('weeklyComparisonChart');
  if (!canvas) return;

  const labels = rows.map(r => `Week ${r.week}`);
  const ctx = canvas.getContext('2d');
  const data = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Sent',
        data: rows.map(r => Math.round(r.totalSent)),
        backgroundColor: 'rgba(59,130,246,.35)',
        borderColor: '#3b82f6',
        yAxisID: 'volume',
      },
      {
        type: 'bar',
        label: 'Delivered',
        data: rows.map(r => Math.round(r.totalDelivered)),
        backgroundColor: 'rgba(0,200,170,.35)',
        borderColor: '#00c8aa',
        yAxisID: 'volume',
      },
      {
        type: 'line',
        label: 'Delivery Rate',
        data: rows.map(r => chartRateValue(r.deliveryRate)),
        borderColor: '#3b82f6',
        tension: .3,
        yAxisID: 'rate',
      },
      {
        type: 'line',
        label: 'Open Rate',
        data: rows.map(r => chartRateValue(r.openRate)),
        borderColor: '#f59e0b',
        tension: .3,
        yAxisID: 'rate',
      },
      {
        type: 'line',
        label: 'Click Rate',
        data: rows.map(r => chartRateValue(r.clickRate)),
        borderColor: '#00c8aa',
        tension: .3,
        yAxisID: 'rate',
      },
      {
        type: 'line',
        label: 'CTOR',
        data: rows.map(r => chartRateValue(r.ctor)),
        borderColor: '#8b5cf6',
        tension: .3,
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
          label: ctx => {
            const value = ctx.dataset.yAxisID === 'rate' ? fmtPct(ctx.parsed.y) : fmtNum(ctx.parsed.y);
            return ` ${ctx.dataset.label}: ${value}`;
          },
        },
      },
    },
    scales: {
      volume: {
        beginAtZero: true,
        position: 'left',
        grid: { color: '#e6e3dd' },
        ticks: { callback: v => fmtNum(v), font: { family: "'IBM Plex Mono'", size: 10 } },
      },
      rate: {
        beginAtZero: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: "'IBM Plex Mono'", size: 10 }, maxRotation: 35 },
      },
    },
  };

  if (weeklyComparisonChart) {
    weeklyComparisonChart.data = data;
    weeklyComparisonChart.options = options;
    weeklyComparisonChart.update('none');
    return;
  }

  weeklyComparisonChart = new Chart(ctx, { type: 'bar', data, options });
}

function updateWowChangeChart() {
  const rows = getWeeklyComparisonRows(filteredRecords);
  const canvas = document.getElementById('wowChangeChart');
  if (!canvas) return;

  const changeRows = rows.slice(1).map((row, idx) => {
    const prev = rows[idx];
    const pctChange = (current, previous) => previous ? ((current - previous) / previous * 100) : null;
    const delta = (current, previous) =>
      typeof current === 'number' && typeof previous === 'number' ? current - previous : null;

    return {
      week: row.week,
      sent: pctChange(row.totalSent, prev.totalSent),
      delivered: pctChange(row.totalDelivered, prev.totalDelivered),
      deliveryRate: delta(row.deliveryRate, prev.deliveryRate),
      openRate: delta(row.openRate, prev.openRate),
      clickRate: delta(row.clickRate, prev.clickRate),
      ctor: delta(row.ctor, prev.ctor),
    };
  });

  const labels = changeRows.map(r => `Week ${r.week}`);
  const data = {
    labels,
    datasets: [
      { label: 'Sent %', data: changeRows.map(r => chartRateValue(r.sent)), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.12)', tension: .25 },
      { label: 'Delivered %', data: changeRows.map(r => chartRateValue(r.delivered)), borderColor: '#00c8aa', backgroundColor: 'rgba(0,200,170,.12)', tension: .25 },
      { label: 'Delivery Rate pp', data: changeRows.map(r => chartRateValue(r.deliveryRate)), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.08)', tension: .25 },
      { label: 'Open Rate pp', data: changeRows.map(r => chartRateValue(r.openRate)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.08)', tension: .25 },
      { label: 'Click Rate pp', data: changeRows.map(r => chartRateValue(r.clickRate)), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,.08)', tension: .25 },
      { label: 'CTOR pp', data: changeRows.map(r => chartRateValue(r.ctor)), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.08)', tension: .25 },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { font: { family: "'DM Sans'", size: 10 }, boxWidth: 10, usePointStyle: true } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'IBM Plex Mono'", size: 10 }, maxRotation: 35 } },
      y: { grid: { color: '#e6e3dd' }, ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 10 } } },
    },
  };

  if (wowChangeChart) {
    wowChangeChart.data = data;
    wowChangeChart.options = options;
    wowChangeChart.update('none');
    return;
  }

  wowChangeChart = new Chart(canvas.getContext('2d'), { type: 'line', data, options });
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
    .filter(r => r.sent > 0 && typeof r.clickRate === 'number')
    .slice(0, 300);
  const productColors = { Casino: '#8b5cf6', Sport: '#3b82f6', Poker: '#f59e0b', APP: '#00c8aa' };

  const data = {
    datasets: [{
      label: 'Campaigns',
      data: rows.map(r => ({
        x: r.sent,
        y: chartRateValue(r.clickRate),
        r: Math.max(4, Math.min(18, Math.sqrt(r.delivered || r.sent) / 6)),
        template: r.template,
        product: r.product,
        market: r.market,
        delivered: r.delivered,
      })),
      backgroundColor: rows.map(r => productColors[r.product] || '#6b6660'),
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => items[0].raw.template,
          label: ctx => [
            `Sent: ${fmtNum(ctx.raw.x)}`,
            `Delivered: ${fmtNum(ctx.raw.delivered)}`,
            `Click Rate: ${fmtPct(ctx.raw.y)}`,
            `Product/Market: ${ctx.raw.product} / ${ctx.raw.market}`,
          ],
        },
      },
    },
    scales: {
      x: { beginAtZero: true, title: { display: true, text: 'Sent' }, ticks: { callback: v => fmtNum(v), font: { family: "'IBM Plex Mono'", size: 10 } }, grid: { color: '#e6e3dd' } },
      y: { beginAtZero: true, title: { display: true, text: 'Click Rate %' }, ticks: { callback: v => v + '%', font: { family: "'IBM Plex Mono'", size: 10 } }, grid: { color: '#e6e3dd' } },
    },
  };

  if (sizePerformanceChart) {
    sizePerformanceChart.data = data;
    sizePerformanceChart.options = options;
    sizePerformanceChart.update('none');
    return;
  }

  sizePerformanceChart = new Chart(canvas.getContext('2d'), { type: 'bubble', data, options });
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

  container.innerHTML = `
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
  updateBestWorstCampaigns();
  updateRepeatCampaignTracking();
  updateTopClickRateChart();
  updateTopCtorChart();
  updateSentByMarketChart();
  updateClickRateByMarketChart();
  updateProductPerformanceChart();
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
  const templates = [...new Set(allRecords.map(r => r.template))].sort();

  buildMultiSelect('productSelect', products, filterState.products);
  buildMultiSelect('marketSelect', markets, filterState.markets);
  buildMultiSelect('templateSelect', templates, filterState.templates);
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
    template: 'templates',
  };

  filterState[fieldMap[field]] = new Set(values);

  updateMultiSelectLabel(
    document.querySelector(`.multi-select[data-field="${field}"]`),
    filterState[fieldMap[field]]
  );

  refreshDashboard();
}

function initMultiSelects() {
  document.querySelectorAll('.multi-select').forEach(ms => {
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

let datePicker = null;

function initDatePicker() {
  datePicker = flatpickr('#dateRangePicker', {
    mode: 'range',
    dateFormat: 'Y-m-d',
    allowInput: false,
    onChange: selectedDates => {
      filterState.dateFrom = selectedDates[0] ? formatDate(selectedDates[0]) : null;
      filterState.dateTo = selectedDates[1] ? formatDate(selectedDates[1]) : null;
      refreshDashboard();
    },
  });
}

function resetFilters() {
  filterState = {
    dateFrom: null,
    dateTo: null,
    products: new Set(),
    markets: new Set(),
    templates: new Set(),
    sentMin: null,
    sentMax: null,
  };

  if (datePicker) datePicker.clear();

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
    ['weeklyComparisonChart', 'Weekly KPI Comparison'],
    ['wowChangeChart', 'Week-over-week Change'],
    ['sizePerformanceChart', 'Campaign Size vs Performance'],
    ['channelSplitChart', 'Channel Split'],
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
      return { title, src: canvas.toDataURL('image/png') };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function exportWeeklyDoc() {
  const summary = getExportSummary();
  const weeklyRows = getWeeklyComparisonRows(filteredRecords);
  const charts = getExportChartImages().filter(c =>
    ['Weekly KPI Comparison', 'Week-over-week Change', 'Daily Performance', 'Delivery Rate Over Time'].includes(c.title)
  );
  exportDocHtml('Weekly Performance Report', summary, weeklyRows, charts);
}

function exportDeepDiveDoc() {
  const summary = getExportSummary();
  const weeklyRows = getWeeklyComparisonRows(filteredRecords);
  const charts = getExportChartImages().filter(c =>
    ['Campaign Size vs Performance', 'Channel Split', 'Top 10 Campaigns by Click Rate', 'Top 10 Campaigns by CTOR', 'Sent Volume by Market', 'Click Rate by Market'].includes(c.title)
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
  updateWeeklyComparisonChart();
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
   12. INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  allRecords = loadRecords();
  importedFiles = loadImportedFiles();

  if (!allRecords.length && localStorage.getItem(STORAGE_DEMO_DISABLED_KEY) !== '1') {
    allRecords = DEMO_DATA;
    usingDemoData = true;
  }

  initMultiSelects();
  initDatePicker();
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

  buildFilterOptions();
  renderImportedFiles();
  refreshDashboard();
  setLastUpdated();
});
