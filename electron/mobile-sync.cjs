const DEFAULT_CONFIG = {
  baseUrl: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  email: process.env.MOBILE_SYNC_EMAIL || '',
  password: process.env.MOBILE_SYNC_PASSWORD || '',
  officeId: process.env.MOBILE_OFFICE_ID || '',
  autoSync: String(process.env.MOBILE_SYNC_AUTO || '').toLowerCase() === 'true',
};

let isRegistered = false;
let lastSyncState = {
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastSummary: null,
};

function getFetch() {
  if (typeof fetch === 'function') {
    return fetch;
  }
  throw new Error('Fetch API bulunamadi.');
}

function normalizePeriodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function normalizeQuarterStart(month) {
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 4;
  if (month >= 7 && month <= 9) return 7;
  return 10;
}

function normalizeReportingPeriod(value) {
  const textValue = String(value || '').toLowerCase().replace(/\s+/g, '');
  if (textValue.includes('3') || textValue.includes('uc') || textValue.includes('quarter')) {
    return '3-aylik';
  }
  return 'aylik';
}

function parsePeriodKey(period) {
  const [year, month] = String(period).split('-').map((value) => Number(value));
  if (!year || !month) {
    throw new Error(`Gecersiz period anahtari: ${period}`);
  }
  return { year, month };
}

function comparePeriod(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function nextPeriod(year, month, reportingPeriod) {
  const step = reportingPeriod === '3-aylik' ? 3 : 1;
  let nextMonth = month + step;
  let nextYear = year;

  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }

  if (reportingPeriod === '3-aylik') {
    nextMonth = normalizeQuarterStart(nextMonth);
  }

  return { year: nextYear, month: nextMonth };
}

function getCompanyTaxNo(company) {
  return String(
    company?.taxNumber ||
    company?.tax_no ||
    company?.tcNumber ||
    company?.vkn ||
    company?.tckn ||
    ''
  ).trim();
}

function getCompanyName(company) {
  return String(company?.name || company?.companyName || 'Bilinmeyen Firma').trim();
}

function getCompanySourceId(company) {
  return String(company?.id || company?.source_company_id || getCompanyTaxNo(company) || getCompanyName(company));
}

function isActiveCompany(company) {
  return String(company?.status || 'active').toLowerCase() !== 'inactive';
}

function companyMatchesRecord(company, record) {
  const taxNo = getCompanyTaxNo(company).toLowerCase();
  const sourceId = getCompanySourceId(company).toLowerCase();
  const companyName = getCompanyName(company).toLowerCase();
  const candidateValues = [
    record?.companyId,
    record?.company_id,
    record?.companyTaxNo,
    record?.company_tax_no,
    record?.taxNo,
    record?.tax_no,
    record?.companyName,
    record?.company_name,
    record?.name,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return candidateValues.includes(sourceId) || candidateValues.includes(taxNo) || candidateValues.includes(companyName);
}

function extractRecordPeriod(record) {
  if (record?.period) {
    const text = String(record.period).trim();
    if (/^\d{4}-\d{2}$/.test(text)) {
      return text;
    }
  }

  const year = Number(record?.year);
  const month = Number(record?.month);
  if (year && month) {
    return normalizePeriodKey(year, month);
  }

  return null;
}

function extractRecordStatus(record) {
  return String(record?.status || record?.state || record?.level || record?.result || 'missing').toLowerCase();
}

function extractRecordUploadedAt(record) {
  return record?.uploadedAt || record?.uploaded_at || record?.updatedAt || record?.updated_at || null;
}

function collectCompanyPeriods(company, monitoringData, completedPeriods) {
  const matchedRecords = (Array.isArray(monitoringData) ? monitoringData : []).filter((record) => companyMatchesRecord(company, record));
  const periodMap = new Map();
  const reportingPeriod = normalizeReportingPeriod(company?.reportingPeriod || company?.reporting_period);

  for (const record of matchedRecords) {
    const periodKey = extractRecordPeriod(record);
    if (!periodKey) {
      continue;
    }

    periodMap.set(periodKey, {
      period: periodKey,
      status: extractRecordStatus(record),
      uploaded_at: extractRecordUploadedAt(record),
      source_status: extractRecordStatus(record),
      source_updated_at: extractRecordUploadedAt(record),
    });
  }

  const completedKeys = [];
  const companyTaxNo = getCompanyTaxNo(company);
  const companySourceId = getCompanySourceId(company);
  for (const key of [companyTaxNo, companySourceId, getCompanyName(company)]) {
    const value = completedPeriods[key];
    if (Array.isArray(value)) {
      completedKeys.push(...value);
    }
  }

  for (const key of completedKeys) {
    const normalized = String(key || '').trim();
    if (!normalized) {
      continue;
    }
    if (!periodMap.has(normalized)) {
      periodMap.set(normalized, {
        period: normalized,
        status: 'uploaded',
        uploaded_at: null,
        source_status: 'uploaded',
        source_updated_at: null,
      });
    }
  }

  const today = new Date();
  const currentPeriod = reportingPeriod === '3-aylik'
    ? normalizePeriodKey(today.getFullYear(), normalizeQuarterStart(today.getMonth() + 1))
    : normalizePeriodKey(today.getFullYear(), today.getMonth() + 1);

  if (periodMap.size === 0) {
    periodMap.set(currentPeriod, {
      period: currentPeriod,
      status: 'missing',
      uploaded_at: null,
      source_status: 'missing',
      source_updated_at: null,
    });
  }

  const sortedExisting = Array.from(periodMap.keys())
    .map(parsePeriodKey)
    .sort(comparePeriod);

  const expected = [];
  let cursor = { ...sortedExisting[0] };
  while (comparePeriod(cursor, parsePeriodKey(currentPeriod)) <= 0) {
    expected.push(normalizePeriodKey(cursor.year, cursor.month));
    cursor = nextPeriod(cursor.year, cursor.month, reportingPeriod);
  }

  return expected.map((period) => periodMap.get(period) || {
    period,
    status: 'missing',
    uploaded_at: null,
    source_status: 'missing',
    source_updated_at: null,
  });
}

async function supabaseAuth(config) {
  const fetchFn = getFetch();
  const response = await fetchFn(`${config.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase girisi basarisiz: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Supabase access token alinmadi.');
  }

  return {
    accessToken: data.access_token,
    userId: data.user?.id || null,
  };
}

async function supabaseRequest(config, accessToken, path, options = {}) {
  const fetchFn = getFetch();
  const response = await fetchFn(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase istegi basarisiz: ${response.status} ${body}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadOfficeContext(config, accessToken, userId) {
  const profile = await supabaseRequest(
    config,
    accessToken,
    `/rest/v1/users?select=id,office_id,full_name&id=eq.${encodeURIComponent(userId)}`,
    { method: 'GET', headers: { Prefer: 'return=representation' } }
  );

  if (!Array.isArray(profile) || profile.length === 0) {
    throw new Error('Kullanici profili bulunamadi. users tablosunda kayit olmali.');
  }

  const officeId = profile[0].office_id;
  if (config.officeId && config.officeId !== officeId) {
    throw new Error('MOBILE_OFFICE_ID ile kullanici ofisi eslesmiyor.');
  }

  return { officeId, profile: profile[0] };
}

function buildCompanyPayloads(store, officeId) {
  const companies = store.get('companies', []);
  if (!Array.isArray(companies)) {
    return [];
  }

  return companies
    .filter(isActiveCompany)
    .map((company) => {
      const taxNo = getCompanyTaxNo(company);
      if (!taxNo) {
        return null;
      }

      return {
        office_id: officeId,
        source_company_id: getCompanySourceId(company),
        name: getCompanyName(company),
        tax_no: taxNo,
        tax_id_type: company?.tcNumber ? 'tckn' : 'vkn',
        company_type: company?.companyType || company?.company_type || 'kurumlar-vergisi',
        reporting_period: normalizeReportingPeriod(company?.reportingPeriod || company?.reporting_period),
        email: company?.email || null,
        status: String(company?.status || 'active').toLowerCase(),
      };
    })
    .filter(Boolean);
}

function buildPeriodPayloads(store, companyPayloads, companyRows) {
  const monitoringData = store.get('monitoring-data', []);
  const completedPeriods = store.get('completed-periods', {}) || {};
  const payloads = [];

  for (const company of companyPayloads) {
    const companyRow = companyRows.find((row) => String(row.source_company_id) === String(company.source_company_id))
      || companyRows.find((row) => String(row.tax_no) === String(company.tax_no));
    if (!companyRow) {
      continue;
    }

    const periods = collectCompanyPeriods(company, monitoringData, completedPeriods);
    for (const period of periods) {
      payloads.push({
        company_id: companyRow.id,
        period: period.period,
        status: period.status === 'uploaded' || period.status === 'approved' ? 'uploaded' : period.status === 'error' ? 'error' : 'missing',
        uploaded_at: period.uploaded_at,
        source_status: period.source_status,
        source_updated_at: period.source_updated_at,
      });
    }
  }

  return payloads;
}

async function syncDesktopData(store, config, logToFile) {
  if (!config.baseUrl || !config.anonKey || !config.email || !config.password) {
    throw new Error('Supabase senkronu icin URL, anon key, email ve sifre gerekli.');
  }

  lastSyncState.running = true;
  lastSyncState.lastRunAt = new Date().toISOString();
  lastSyncState.lastError = null;

  try {
    const { accessToken, userId } = await supabaseAuth(config);
    if (!userId) {
      throw new Error('Supabase kullanici kimligi alinamadi.');
    }

    const { officeId, profile } = await loadOfficeContext(config, accessToken, userId);
    const companyPayloads = buildCompanyPayloads(store, officeId);

    if (companyPayloads.length > 0) {
      await supabaseRequest(
        config,
        accessToken,
        '/rest/v1/companies?on_conflict=office_id,tax_no',
        {
          method: 'POST',
          body: JSON.stringify(companyPayloads),
        }
      );
    }

    const companyRows = await supabaseRequest(
      config,
      accessToken,
      `/rest/v1/companies?select=id,source_company_id,tax_no,reporting_period&office_id=eq.${encodeURIComponent(officeId)}`,
      { method: 'GET' }
    );

    const periodPayloads = buildPeriodPayloads(store, companyPayloads, Array.isArray(companyRows) ? companyRows : []);

    if (periodPayloads.length > 0) {
      const uniquePeriods = Array.from(
        new Map(periodPayloads.map((item) => [`${item.company_id}:${item.period}`, item])).values()
      );
      await supabaseRequest(
        config,
        accessToken,
        '/rest/v1/periods?on_conflict=company_id,period',
        {
          method: 'POST',
          body: JSON.stringify(uniquePeriods),
        }
      );
    }

    const activities = [];
    for (const company of companyPayloads) {
      const companyRow = (Array.isArray(companyRows) ? companyRows : []).find((row) => String(row.source_company_id) === String(company.source_company_id))
        || (Array.isArray(companyRows) ? companyRows : []).find((row) => String(row.tax_no) === String(company.tax_no));
      if (!companyRow) {
        continue;
      }

      const periodCount = periodPayloads.filter((item) => String(item.company_id) === String(companyRow.id)).length;
      activities.push({
        office_id: officeId,
        company_id: companyRow.id,
        period: periodPayloads.find((item) => String(item.company_id) === String(companyRow.id))?.period || null,
        action: `desktop_sync:${periodCount}_periods`,
      });
    }

    if (activities.length > 0) {
      await supabaseRequest(
        config,
        accessToken,
        '/rest/v1/activities',
        {
          method: 'POST',
          body: JSON.stringify(activities),
        }
      );
    }

    const summary = {
      officeId,
      userId,
      profileName: profile?.full_name || null,
      companiesSynced: companyPayloads.length,
      periodsSynced: periodPayloads.length,
      activitiesSynced: activities.length,
      skippedCompanies: Math.max(0, (store.get('companies', []) || []).length - companyPayloads.length),
    };

    lastSyncState.running = false;
    lastSyncState.lastSuccessAt = new Date().toISOString();
    lastSyncState.lastSummary = summary;

    if (logToFile) {
      logToFile('success', 'Mobile Sync', 'Masaustu verisi Supabase ile esitlendi', JSON.stringify(summary));
    }

    return { success: true, data: summary };
  } catch (error) {
    lastSyncState.running = false;
    lastSyncState.lastError = error?.message || String(error);

    if (logToFile) {
      logToFile('error', 'Mobile Sync', 'Senkron hatasi', lastSyncState.lastError);
    }

    return { success: false, error: lastSyncState.lastError };
  }
}

function registerMobileSync({ ipcMain, store, logToFile }) {
  if (isRegistered) {
    return;
  }

  isRegistered = true;

  ipcMain.handle('mobile-sync-status', async () => ({
    success: true,
    data: { ...lastSyncState },
  }));

  ipcMain.handle('mobile-sync-now', async () => {
    try {
      const config = { ...DEFAULT_CONFIG };
      return await syncDesktopData(store, config, logToFile);
    } catch (error) {
      const message = error?.message || String(error);
      lastSyncState.lastError = message;
      return { success: false, error: message };
    }
  });

  if (DEFAULT_CONFIG.autoSync) {
    setTimeout(() => {
      syncDesktopData(store, { ...DEFAULT_CONFIG }, logToFile).catch(() => {});
    }, 3000);
  }
}

module.exports = {
  registerMobileSync,
};
