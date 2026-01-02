// Wrapper to fix Vite/Rollup export bug
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Calendar, Building, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { Company } from '../types';

// Test verileri oluşturma fonksiyonu
const createSampleData = async () => {
  console.log('🆕 Örnek veri oluşturuluyor...');
  
  // Örnek şirketler
  const sampleCompanies: Company[] = [
    {
      id: 'sample-1',
      name: 'ABC Ticaret Ltd. Şti.',
      taxNumber: '1234567890',
      tcNumber: '',
      email: 'info@abcticaret.com',
      status: 'active',
      companyType: 'kurumlar-vergisi',
      reportingPeriod: 'aylık'
    },
    {
      id: 'sample-2',  
      name: 'XYZ İnşaat A.Ş.',
      taxNumber: '0987654321',
      tcNumber: '',
      email: 'iletisim@xyzinsaat.com',
      status: 'active',
      companyType: 'kurumlar-vergisi',
      reportingPeriod: '3-aylık'
    },
    {
      id: 'sample-3',
      name: 'Ahmet Yılmaz',
      taxNumber: '',
      tcNumber: '12345678901',
      email: 'ahmet.yilmaz@email.com',
      status: 'active',
      companyType: 'gelir-vergisi',
      reportingPeriod: 'aylık'
    }
  ];

  // Örnek monitoring verileri (bazı aylar tamamlanmış olarak)
  const sampleMonitoring = [
    { companyId: '1234567890', year: 2024, month: 11, status: 'complete' },
    { companyId: '1234567890', year: 2024, month: 10, status: 'complete' },
    { companyId: '0987654321', year: 2024, month: 9, status: 'complete' },
    { companyId: '0987654321', year: 2024, month: 6, status: 'complete' },
    { companyId: '12345678901', year: 2024, month: 11, status: 'complete' },
    { companyId: '12345678901', year: 2024, month: 10, status: 'complete' }
  ];

  // Verileri kaydet
  await ElectronService.saveData('companies', sampleCompanies);
  await ElectronService.saveData('monitoring-data', sampleMonitoring);
  
  console.log('✅ Örnek veriler kaydedildi');
};

interface DeadlineEntry {
  month: number;
  monthName: string;
  year: number;
  hasFile: boolean;
}

interface DeadlineInfo {
  month: number;
  monthName: string;
  deadlineDate: Date;
  deadlineStr: string;
  remainingDays: number;
  status: 'completed' | 'due-soon' | 'overdue' | 'pending';
}

interface CompanyDeadline {
  id: string;
  compTaxId: string;
  name: string;
  companyType: 'gelir-vergisi' | 'kurumlar-vergisi';
  reportingPeriod: 'aylık' | '3-aylık';
  uploadedMonths: DeadlineEntry[];
  displayPeriod: string; // 3 aylık için "Temmuz-Ağustos-Eylül 2025", aylık için "Ağustos 2025"
  nextDeadline: DeadlineInfo | null;
  allUpcoming: DeadlineInfo[];
}

interface Stats {
  totalCompanies: number;
  completedToday: number;
  dueSoon: number;
  overdue: number;
}

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Resmi tatil günleri (Türkiye 2024-2026)
const TURKISH_HOLIDAYS = [
  '2024-01-01', '2024-04-23', '2024-05-01', '2024-07-15', '2024-08-30', '2024-10-29',
  '2025-01-01', '2025-04-23', '2025-05-01', '2025-07-15', '2025-08-30', '2025-10-29',
  '2024-04-10', '2024-04-11', '2024-04-12', '2025-03-30', '2025-03-31', '2025-04-01',
  '2024-06-16', '2024-06-17', '2024-06-18', '2024-06-19', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09',
];

const MONTHLY_DEADLINES = {
  'gelir-vergisi': {
    1: [5, 10], 2: [6, 10], 3: [7, 10], 4: [8, 10], 5: [9, 10], 6: [10, 10],
    7: [11, 10], 8: [12, 10], 9: [1, 10, 1], 10: [2, 10, 1], 11: [3, 10, 1], 12: [4, 10, 1]
  },
  'kurumlar-vergisi': {
    1: [5, 14], 2: [6, 14], 3: [7, 14], 4: [8, 14], 5: [9, 14], 6: [10, 14],
    7: [11, 14], 8: [12, 14], 9: [1, 14, 1], 10: [2, 14, 1], 11: [3, 14, 1], 12: [5, 14, 1]
  }
};

const QUARTERLY_DEADLINES = {
  'gelir-vergisi': {
    '01-03': [6, 10], '04-06': [9, 10], '07-09': [12, 10], '10-12': [4, 10, 1]
  },
  'kurumlar-vergisi': {
    '01-03': [6, 14], '04-06': [9, 14], '07-09': [12, 14], '10-12': [5, 14, 1]
  }
};

function isHolidayOrWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  const dateStr = date.toISOString().split('T')[0];
  return TURKISH_HOLIDAYS.includes(dateStr);
}

function getNextWorkDay(date: Date): Date {
  const nextDate = new Date(date);
  while (isHolidayOrWeekend(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
}

function getDeadlineDate(
  uploadedMonth: number,
  uploadedYear: number,
  companyType: 'gelir-vergisi' | 'kurumlar-vergisi',
  reportingPeriod: 'aylık' | '3-aylık'
): Date | null {
  let deadline: (number | string)[] | undefined;

  if (reportingPeriod === 'aylık') {
    deadline = MONTHLY_DEADLINES[companyType][uploadedMonth as keyof typeof MONTHLY_DEADLINES['gelir-vergisi']];
  } else {
    let quarter = '';
    if (uploadedMonth >= 1 && uploadedMonth <= 3) quarter = '01-03';
    else if (uploadedMonth >= 4 && uploadedMonth <= 6) quarter = '04-06';
    else if (uploadedMonth >= 7 && uploadedMonth <= 9) quarter = '07-09';
    else if (uploadedMonth >= 10 && uploadedMonth <= 12) quarter = '10-12';
    deadline = QUARTERLY_DEADLINES[companyType][quarter as keyof typeof QUARTERLY_DEADLINES['gelir-vergisi']];
  }

  if (!deadline) return null;

  // Başlangıç yılı: yüklenen dönemin yılı
  let year = uploadedYear;
  const month = deadline[0] as number;
  const day = deadline[1] as number;
  
  // Eğer kural 3. elemanı (isNextYear) içeriyorsa yıla 1 ekle
  const isNextYear = deadline.length > 2 ? (deadline[2] as number) : 0;
  if (isNextYear) {
    year += 1;
  }

  // Hedef tarihini oluştur (hatalı atlama kontrol edilmeden)
  let date = new Date(year, month - 1, day);

  // Tatil veya hafta sonu ise bir sonraki iş gününe kaydır
  date = getNextWorkDay(date);

  return date;
}

const EDefterTrackerWrapper: React.FC = () => {
  const [trackers, setTrackers] = useState<CompanyDeadline[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCompanies: 0, completedToday: 0, dueSoon: 0, overdue: 0 });
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'due-soon' | 'overdue' | 'pending'>('all');
  const [selectedCompanyType, setSelectedCompanyType] = useState<'all' | 'gelir-vergisi' | 'kurumlar-vergisi'>('all');
  const [ignoredCompanies, setIgnoredCompanies] = useState<Set<string>>(new Set());
  const [completedPeriods, setCompletedPeriods] = useState<Map<string, Set<string>>>(new Map()); // Key: compTaxId, Value: Set of "YYYY-MM"

  useEffect(() => {
    // İlk yüklemede veri yoksa otomatik olarak örnek veri oluştur
    const initializeData = async () => {
      try {
        const companiesResult = await ElectronService.loadData('companies', []);
        if (!companiesResult.success || !companiesResult.data || companiesResult.data.length === 0) {
          console.log('📝 İlk kullanım: Örnek veri oluşturuluyor...');
          await createSampleData();
        }
      } catch (error) {
        console.warn('İlk veri kontrolü sırasında hata:', error);
      }
    };

    initializeData();
    loadDeadlineData();
    const interval = setInterval(loadDeadlineData, 5 * 60 * 1000);
    
    if ((window as any).electronAPI?.onTriggerScan) {
      (window as any).electronAPI.onTriggerScan(() => {
        // E-Defter takip verileri yenileniyor
        loadDeadlineData();
      });
    }

    // Otomatik tamamlandı olayını dinle
    if ((window as any).electronAPI?.onPeriodMarkedCompleted) {
      (window as any).electronAPI.onPeriodMarkedCompleted((data: { compTaxId: string; companyName: string; period: string }) => {
        // Tamamlanan dönem işaretlendi
        // Tamamlanan dönem listesini güncelle
        setCompletedPeriods(prev => {
          const newCompleted = new Map(prev);
          if (!newCompleted.has(data.compTaxId)) {
            newCompleted.set(data.compTaxId, new Set());
          }
          newCompleted.get(data.compTaxId)!.add(data.period);
          return newCompleted;
        });
        // Verileri yenile (listeden otomatik kaldırılsın)
        loadDeadlineData();
      });
    }

    return () => {
      clearInterval(interval);
      if ((window as any).electronAPI?.removeAllListeners) {
        (window as any).electronAPI.removeAllListeners('trigger-scan');
        (window as any).electronAPI.removeAllListeners('period-marked-completed');
      }
    };
  }, []);

  const loadDeadlineData = async () => {
    try {
      setLoading(true);
      console.log('🔄 EDefterTracker: Veri yükleme başlıyor...');
      
      const companiesResult = await ElectronService.loadData('companies', []);
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      const ignoredResult = await ElectronService.loadData('ignored-companies', []);
      const completedResult = await ElectronService.loadData('completed-periods', {});

      console.log('📊 EDefterTracker Yükleme Sonuçları:', {
        companiesSuccess: companiesResult.success,
        companiesCount: companiesResult?.data?.length || 0,
        monitoringSuccess: monitoringResult.success,
        monitoringCount: monitoringResult?.data?.length || 0,
        ignoredSuccess: ignoredResult.success,
        completedSuccess: completedResult.success
      });

      if (!companiesResult.success || !companiesResult.data) {
        console.error('❌ EDefterTracker: Şirket verisi yüklenemedi');
        console.log('🆕 Örnek veri oluşturmayı deniyor...');
        await createSampleData();
        
        // Tekrar yükle
        const retryCompanies = await ElectronService.loadData('companies', []);
        const retryMonitoring = await ElectronService.loadData('monitoring-data', []);
        
        if (!retryCompanies.success || !retryCompanies.data) {
          throw new Error('Şirket yükleme hatası');
        }
        
        // Retry verilerini kullan
        companiesResult.data = retryCompanies.data;
        monitoringResult.data = retryMonitoring.data;
      }

      const companies: Company[] = companiesResult.data.filter((c: Company) => c.status === 'active');
      const monitoringData = Array.isArray(monitoringResult.data) ? monitoringResult.data : [];
      const ignoredList = Array.isArray(ignoredResult.data) ? ignoredResult.data : [];
      const completedData = completedResult.data || {};
      
      console.log('📋 EDefterTracker İşleme Hazırlık:', {
        totalCompanies: companiesResult.data.length,
        activeCompanies: companies.length,
        monitoringRecords: monitoringData.length,
        ignoredCompanies: ignoredList.length,
        completedData: Object.keys(completedData).length
      });
      
      // Tamamlanan dönemleri Map'e çevir
      const completedMap = new Map<string, Set<string>>();
      for (const [taxId, periods] of Object.entries(completedData)) {
        completedMap.set(taxId, new Set(periods as string[]));
      }
      setCompletedPeriods(completedMap);
      
      const ignoredSet = new Set<string>(ignoredList as string[]);
      
      setIgnoredCompanies(ignoredSet);
      const today = new Date();
      const newTrackers: CompanyDeadline[] = [];

      for (const company of companies) {
        const companyType = (company.companyType || 'kurumlar-vergisi') as 'gelir-vergisi' | 'kurumlar-vergisi';
        const reportingPeriod = (company.reportingPeriod || 'aylık') as 'aylık' | '3-aylık';
        const compId = company.tcNumber || company.taxNumber;

        // Yoksayılan şirketleri atla - company.id veya compId ile kontrol et
        if (!compId || ignoredSet.has(compId) || ignoredSet.has(company.id)) continue;

        const allUploads: Array<{ month: number; year: number }> = [];
        for (const record of monitoringData) {
          if (record.companyId === compId && record.status === 'complete') {
            allUploads.push({ month: record.month, year: record.year });
          }
        }

        if (allUploads.length === 0) continue;

        const lastUpload = allUploads.sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))[0];
        if (!lastUpload) continue;

        // Gösterilecek yüklemeleri belirle:
        // - 3 aylık: son 3 yükleme (3 eleman)
        // - Aylık: sadece en son dönem (1 eleman)
        const uploadedMonths: DeadlineEntry[] = allUploads
          .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month))
          .slice(0, reportingPeriod === '3-aylık' ? 3 : 1)
          .map(m => ({
            month: m.month,
            monthName: MONTH_NAMES[m.month - 1],
            year: m.year,
            hasFile: true
          }));

        // İlk boş (yüklenmemiş) dönemi bul
        let nextUploadMonth = lastUpload.month;
        let nextUploadYear = lastUpload.year;

        // İlerletme mekanizması: Sonraki döneme git
        const moveToNextPeriod = () => {
          if (reportingPeriod === 'aylık') {
            nextUploadMonth += 1;
            if (nextUploadMonth > 12) {
              nextUploadMonth = 1;
              nextUploadYear += 1;
            }
          } else {
            // 3-aylık: Bir sonraki çeyrek
            if (nextUploadMonth >= 1 && nextUploadMonth <= 3) {
              nextUploadMonth = 4;
            } else if (nextUploadMonth >= 4 && nextUploadMonth <= 6) {
              nextUploadMonth = 7;
            } else if (nextUploadMonth >= 7 && nextUploadMonth <= 9) {
              nextUploadMonth = 10;
            } else if (nextUploadMonth >= 10 && nextUploadMonth <= 12) {
              nextUploadMonth = 1;
              nextUploadYear += 1;
            }
          }
        };

        // Yükleme kontrolü: Dönem listesinde var mı?
        const isPeriodUploaded = (checkMonth: number, checkYear: number): boolean => {
          if (reportingPeriod === 'aylık') {
            // Aylık: Tam eşleşme
            return allUploads.some(u => u.month === checkMonth && u.year === checkYear);
          } else {
            // 3-aylık: Çeyrekteki herhangi bir ay yüklenmişse say
            let quarterMonths: number[] = [];
            if (checkMonth >= 1 && checkMonth <= 3) quarterMonths = [1, 2, 3];
            else if (checkMonth >= 4 && checkMonth <= 6) quarterMonths = [4, 5, 6];
            else if (checkMonth >= 7 && checkMonth <= 9) quarterMonths = [7, 8, 9];
            else if (checkMonth >= 10 && checkMonth <= 12) quarterMonths = [10, 11, 12];
            
            return quarterMonths.some(m => allUploads.some(u => u.month === m && u.year === checkYear));
          }
        };

        // While döngüsü: İlk boş dönemi bul (maksimum 36 ay ara kontrol et)
        let loopCount = 0;
        while (loopCount < 36) {
          moveToNextPeriod();
          if (!isPeriodUploaded(nextUploadMonth, nextUploadYear)) {
            break;
          }
          loopCount++;
        }

        const deadlineDate = getDeadlineDate(nextUploadMonth, nextUploadYear, companyType, reportingPeriod);
        if (!deadlineDate) continue;

        const remainingDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status: DeadlineInfo['status'] = 'pending';
        
        if (remainingDays < 0) {
          status = 'overdue';
        } else if (remainingDays <= 3 && remainingDays >= 0) {
          status = 'due-soon';
        } else {
          status = 'pending';
        }

        const deadline: DeadlineInfo = {
          month: deadlineDate.getMonth() + 1,
          monthName: MONTH_NAMES[deadlineDate.getMonth()],
          deadlineDate,
          deadlineStr: `${deadlineDate.getDate().toString().padStart(2, '0')}.${(deadlineDate.getMonth() + 1).toString().padStart(2, '0')}.${deadlineDate.getFullYear()}`,
          remainingDays,
          status
        };

        // Dönem gösterimini oluştur (yüklenecek dönem)
        let displayPeriod = '';
        if (reportingPeriod === 'aylık') {
          // Aylık: "Nisan 2025"
          displayPeriod = `${MONTH_NAMES[nextUploadMonth - 1]} ${nextUploadYear}`;
        } else {
          // 3 aylık: "Nisan-Mayıs-Haziran 2025"
          let months: number[] = [];
          if (nextUploadMonth >= 1 && nextUploadMonth <= 3) months = [1, 2, 3];
          else if (nextUploadMonth >= 4 && nextUploadMonth <= 6) months = [4, 5, 6];
          else if (nextUploadMonth >= 7 && nextUploadMonth <= 9) months = [7, 8, 9];
          else if (nextUploadMonth >= 10 && nextUploadMonth <= 12) months = [10, 11, 12];
          
          const monthNames = months.map(m => MONTH_NAMES[m - 1]).join('-');
          displayPeriod = `${monthNames} ${nextUploadYear}`;
        }

        newTrackers.push({
          id: company.id,
          compTaxId: compId,
          name: company.name,
          companyType,
          reportingPeriod,
          uploadedMonths,
          displayPeriod,
          nextDeadline: deadline,
          allUpcoming: [deadline]
        });
      }

      console.log('📈 EDefterTracker Sonuçları:', {
        newTrackersCount: newTrackers.length,
        trackers: newTrackers.slice(0, 3).map(t => ({ name: t.name, period: t.displayPeriod, deadline: t.nextDeadline?.deadlineStr }))
      });

      setTrackers(newTrackers);
      
      // Tamamlanan dönem sayısını hesapla
      let completedCount = 0;
      completedMap.forEach((periods) => {
        completedCount += periods.size;
      });
      
      const dueSoon = newTrackers.filter(t => t.nextDeadline && t.nextDeadline.remainingDays <= 3 && t.nextDeadline.remainingDays >= 0).length;
      const overdue = newTrackers.filter(t => t.nextDeadline && t.nextDeadline.remainingDays < 0).length;
      
      const finalStats = {
        totalCompanies: newTrackers.length,
        completedToday: completedCount,
        dueSoon,
        overdue
      };
      
      console.log('📊 EDefterTracker İstatistikler:', finalStats);
      
      setStats(finalStats);
    } catch (error) {
      console.error('❌ E-Defter takip hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTrackers = () => {
    let filtered = [...trackers];
    
    if (filterStatus === 'completed') {
      // Tamamlanan dönemleri göster (şu an boş, gelecekte historik veri gösterebilir)
      return [];
    }
    
    // Tamamlanan dönemleri hariç tut
    filtered = filtered.filter(t => {
      if (!t.nextDeadline) return true;
      const periodKey = `${t.nextDeadline.deadlineDate.getFullYear()}-${String(t.nextDeadline.month).padStart(2, '0')}`;
      const isCompleted = completedPeriods.get(t.compTaxId)?.has(periodKey);
      return !isCompleted;
    });
    
    // Status filtreleme
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.nextDeadline && t.nextDeadline.status === filterStatus);
    }
    
    // Şirket türü filtreleme
    if (selectedCompanyType !== 'all') {
      filtered = filtered.filter(t => t.companyType === selectedCompanyType);
    }
    
    return filtered.sort((a, b) => (a.nextDeadline?.remainingDays ?? 999) - (b.nextDeadline?.remainingDays ?? 999));
  };

  const handleIgnoreCompany = async (compTaxId: string) => {
    const newIgnored = new Set(ignoredCompanies);
    newIgnored.add(compTaxId);
    setIgnoredCompanies(newIgnored);
    await ElectronService.saveData('ignored-companies', Array.from(newIgnored));
    loadDeadlineData();
  };

  const handleCompleted = async (compTaxId: string, period: { month: number; year: number }) => {
    const periodKey = `${period.year}-${String(period.month).padStart(2, '0')}`;
    const newCompleted = new Map(completedPeriods);
    
    if (!newCompleted.has(compTaxId)) {
      newCompleted.set(compTaxId, new Set());
    }
    
    const companyPeriods = newCompleted.get(compTaxId)!;
    if (companyPeriods.has(periodKey)) {
      companyPeriods.delete(periodKey);
    } else {
      companyPeriods.add(periodKey);
    }
    
    setCompletedPeriods(newCompleted);
    // Tamamlanan dönemleri kaydet
    const completedMap: { [key: string]: string[] } = {};
    newCompleted.forEach((periods, taxId) => {
      completedMap[taxId] = Array.from(periods);
    });
    await ElectronService.saveData('completed-periods', completedMap);
  };

  const filteredData = getFilteredTrackers();

  console.log('🎯 EDefterTracker Render:', {
    trackersLength: trackers.length,
    filteredDataLength: filteredData.length,
    stats: stats,
    loading: loading,
    filterStatus: filterStatus
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-800">E-Defter Berat Yükleme Takip</h1>
        </div>
        <button
          onClick={loadDeadlineData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
        <button
          onClick={async () => {
            await createSampleData();
            await loadDeadlineData();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          <Building className="w-5 h-5" />
          Örnek Veri Oluştur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium mb-1">Takip Edilen Şirket</p>
              <p className="text-3xl font-bold text-blue-900">{stats.totalCompanies}</p>
            </div>
            <Building className="w-10 h-10 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium mb-1">Tamamlandı</p>
              <p className="text-3xl font-bold text-green-900">{stats.completedToday}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl border border-yellow-200 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-600 text-sm font-medium mb-1">Yaklaşan (3 Gün)</p>
              <p className="text-3xl font-bold text-yellow-900">{stats.dueSoon}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-medium mb-1">Gecikmiş</p>
              <p className="text-3xl font-bold text-red-900">{stats.overdue}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
        <span className="text-sm font-semibold text-gray-700">🔍 Filtrele:</span>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Durum:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tümü</option>
            <option value="completed">✅ Tamamlandı ({stats.completedToday})</option>
            <option value="pending">🗓️ Zamanında</option>
            <option value="due-soon">⏰ Yaklaşıyor ({stats.dueSoon})</option>
            <option value="overdue">🚨 Gecikmiş ({stats.overdue})</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Şirket Türü:</label>
          <select
            value={selectedCompanyType}
            onChange={(e) => setSelectedCompanyType(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tümü</option>
            <option value="gelir-vergisi">💰 Gelir Vergisi Mükellefi</option>
            <option value="kurumlar-vergisi">🏢 Kurumlar Vergisi Mükellefi</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Şirket Adı</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Türü / Dönem</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Son Yüklenen</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Yüklenecek Dönem</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Yükleme Son Tarihi</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">Kalan Gün</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Durum</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="space-y-4">
                    <Clock className="w-16 h-16 mx-auto text-gray-300" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Kayıt Bulunamadı</h3>
                      <p className="text-gray-500 mb-4">
                        {trackers.length === 0 
                          ? 'Henüz şirket verisi yok. Lütfen "Örnek Veri Oluştur" butonuna tıklayın.'
                          : 'Seçili filtrelerinize uygun kayıt bulunamadı.'
                        }
                      </p>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>Toplam Şirket: {stats.totalCompanies}</p>
                        <p>Takip Edilen: {trackers.length}</p>
                        <p>Filtrelenmiş: {filteredData.length}</p>
                        <p>Filtre Durumu: {filterStatus}</p>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((tracker) =>
                tracker.nextDeadline ? (
                  <tr
                    key={tracker.id}
                    className={`hover:bg-gray-50 transition ${
                      tracker.nextDeadline.status === 'overdue'
                        ? 'bg-red-50'
                        : tracker.nextDeadline.status === 'due-soon'
                          ? 'bg-yellow-50'
                          : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{tracker.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium w-fit">
                          {tracker.companyType === 'gelir-vergisi' ? '💰 Gelir Vergisi' : '🏢 Kurumlar Vergisi'}
                        </span>
                        <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium w-fit">
                          {tracker.reportingPeriod === 'aylık' ? '📅 Aylık' : '📊 3 Aylık'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-2">
                        {tracker.uploadedMonths.map((m, idx) => (
                          <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                            {m.monthName} {m.year}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block bg-green-100 text-green-800 px-3 py-2 rounded-lg text-xs font-bold">
                        {tracker.displayPeriod}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{tracker.nextDeadline.deadlineStr}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm ${
                          tracker.nextDeadline.remainingDays < 0
                            ? 'bg-red-100 text-red-700'
                            : tracker.nextDeadline.remainingDays <= 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {Math.abs(tracker.nextDeadline.remainingDays)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full font-semibold text-xs ${
                          tracker.nextDeadline.status === 'overdue'
                            ? 'bg-red-100 text-red-800'
                            : tracker.nextDeadline.status === 'due-soon'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {tracker.nextDeadline.status === 'overdue'
                          ? '🚨 Gecikmişş'
                          : tracker.nextDeadline.status === 'due-soon'
                            ? '⏰ Süresi Yaklaşıyor'
                            : '🗓️ Yüklenmesi Bekleniyor'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      {tracker.nextDeadline && (
                        <>
                          <button
                            onClick={() => handleCompleted(tracker.compTaxId, {
                              month: tracker.nextDeadline!.month,
                              year: tracker.nextDeadline!.deadlineDate.getFullYear()
                            })}
                            className={`px-3 py-1 font-semibold text-xs rounded transition ${
                              completedPeriods.get(tracker.compTaxId)?.has(
                                `${tracker.nextDeadline!.deadlineDate.getFullYear()}-${String(tracker.nextDeadline!.month).padStart(2, '0')}`
                              )
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-blue-300 hover:bg-blue-400 text-gray-800'
                            }`}
                            title={
                              completedPeriods.get(tracker.compTaxId)?.has(
                                `${tracker.nextDeadline!.deadlineDate.getFullYear()}-${String(tracker.nextDeadline!.month).padStart(2, '0')}`
                              )
                                ? 'Tamamlandı olarak işaretle'
                                : 'Tamamlandı olarak işaretle'
                            }
                          >
                            {completedPeriods.get(tracker.compTaxId)?.has(
                              `${tracker.nextDeadline!.deadlineDate.getFullYear()}-${String(tracker.nextDeadline!.month).padStart(2, '0')}`
                            )
                              ? '✓ Tamamlandı'
                              : '○ Tamamla'}
                          </button>
                          <button
                            onClick={() => handleIgnoreCompany(tracker.compTaxId)}
                            className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold text-xs rounded transition"
                            title="Bu uyarıyı yoksay"
                          >
                            Yoksay
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ) : null
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EDefterTrackerWrapper;
