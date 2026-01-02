import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Calendar, Building, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { Company } from '../types';

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
  // 2024
  '2024-01-01', // Yılbaşı
  '2024-04-23', // Ulusal Egemenlik Günü
  '2024-05-01', // Emek Günü
  '2024-07-15', // Demokrasi ve Milli Birlik Günü
  '2024-08-30', // Zafer Günü
  '2024-10-29', // Cumhuriyet Bayramı
  // 2025
  '2025-01-01', // Yılbaşı
  '2025-04-23', // Ulusal Egemenlik Günü
  '2025-05-01', // Emek Günü
  '2025-07-15', // Demokrasi ve Milli Birlik Günü
  '2025-08-30', // Zafer Günü
  '2025-10-29', // Cumhuriyet Bayramı
  // Ramazan Bayramı (Şeker Bayramı) - 3 gün
  '2024-04-10', '2024-04-11', '2024-04-12',
  '2025-03-30', '2025-03-31', '2025-04-01',
  // Kurban Bayramı - 4 gün
  '2024-06-16', '2024-06-17', '2024-06-18', '2024-06-19',
  '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09',
];

const MONTHLY_DEADLINES = {
  'gelir-vergisi': {
    1: [5, 10],    // Ocak -> 10 Mayıs
    2: [6, 10],    // Şubat -> 10 Haziran
    3: [7, 10],    // Mart -> 10 Temmuz
    4: [8, 10],    // Nisan -> 10 Ağustos
    5: [9, 10],    // Mayıs -> 10 Eylül
    6: [10, 10],   // Haziran -> 10 Ekim
    7: [11, 10],   // Temmuz -> 10 Kasım
    8: [12, 10],   // Ağustos -> 10 Aralık
    9: [1, 10, 1], // Eylül -> 10 Ocak (Ertesi Yıl)
    10: [2, 10, 1], // Ekim -> 10 Şubat (Ertesi Yıl)
    11: [3, 10, 1], // Kasım -> 10 Mart (Ertesi Yıl)
    12: [4, 10, 1]  // Aralık -> 10 Nisan (Ertesi Yıl)
  },
  'kurumlar-vergisi': {
    1: [5, 14],    // Ocak -> 14 Mayıs
    2: [6, 14],    // Şubat -> 14 Haziran
    3: [7, 14],    // Mart -> 14 Temmuz
    4: [8, 14],    // Nisan -> 14 Ağustos
    5: [9, 14],    // Mayıs -> 14 Eylül
    6: [10, 14],   // Haziran -> 14 Ekim
    7: [11, 14],   // Temmuz -> 14 Kasım
    8: [12, 14],   // Ağustos -> 14 Aralık
    9: [1, 14, 1], // Eylül -> 14 Ocak (Ertesi Yıl)
    10: [2, 14, 1], // Ekim -> 14 Şubat (Ertesi Yıl)
    11: [3, 14, 1], // Kasım -> 14 Mart (Ertesi Yıl)
    12: [5, 14, 1]  // Aralık -> 14 Mayıs (Ertesi Yıl)
  }
};

const QUARTERLY_DEADLINES = {
  'gelir-vergisi': {
    '01-03': [6, 10],   // Ocak-Şubat-Mart -> 10 Haziran
    '04-06': [9, 10],   // Nisan-Mayıs-Haziran -> 10 Eylül
    '07-09': [12, 10],  // Temmuz-Ağustos-Eylül -> 10 Aralık
    '10-12': [4, 10, 1] // Ekim-Kasım-Aralık -> 10 Nisan (Ertesi Yıl)
  },
  'kurumlar-vergisi': {
    '01-03': [6, 14],   // Ocak-Şubat-Mart -> 14 Haziran
    '04-06': [9, 14],   // Nisan-Mayıs-Haziran -> 14 Eylül
    '07-09': [12, 14],  // Temmuz-Ağustos-Eylül -> 14 Aralık
    '10-12': [5, 14, 1] // Ekim-Kasım-Aralık -> 14 Mayıs (Ertesi Yıl)
  }
};

function isHolidayOrWeekend(date: Date): boolean {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.warn('⚠️ Geçersiz date nesnesi:', date);
      return false;
    }
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return true; // Pazar veya Cumartesi
    
    const dateStr = date.toISOString().split('T')[0];
    if (!dateStr || typeof dateStr !== 'string') {
      console.warn('⚠️ Geçersiz dateStr:', dateStr);
      return false;
    }
    
    return TURKISH_HOLIDAYS.includes(dateStr);
  } catch (error) {
    console.error('❌ isHolidayOrWeekend hatası:', error, 'date:', date);
    return false;
  }
}

function getNextWorkDay(date: Date): Date {
  try {
    if (!date || !(date instanceof Date)) {
      console.warn('⚠️ getNextWorkDay: Geçersiz date');
      return new Date();
    }
    
    const nextDate = new Date(date);
    let loopCount = 0;
    
    while (isHolidayOrWeekend(nextDate) && loopCount < 365) {
      nextDate.setDate(nextDate.getDate() + 1);
      loopCount++;
    }
    
    return nextDate;
  } catch (error) {
    console.error('❌ getNextWorkDay hatası:', error);
    return new Date(date);
  }
}

function getDeadlineDate(
  uploadedMonth: number,
  uploadedYear: number,
  companyType: 'gelir-vergisi' | 'kurumlar-vergisi',
  reportingPeriod: 'aylık' | '3-aylık'
): Date | null {
  try {
    let deadline: (number | string)[] | undefined;

    if (reportingPeriod === 'aylık') {
      deadline = MONTHLY_DEADLINES[companyType]?.[uploadedMonth as keyof typeof MONTHLY_DEADLINES['gelir-vergisi']];
    } else {
      let quarter = '';
      if (uploadedMonth >= 1 && uploadedMonth <= 3) quarter = '01-03';
      else if (uploadedMonth >= 4 && uploadedMonth <= 6) quarter = '04-06';
      else if (uploadedMonth >= 7 && uploadedMonth <= 9) quarter = '07-09';
      else if (uploadedMonth >= 10 && uploadedMonth <= 12) quarter = '10-12';
      deadline = QUARTERLY_DEADLINES[companyType]?.[quarter as keyof typeof QUARTERLY_DEADLINES['gelir-vergisi']];
    }

    if (!deadline || !Array.isArray(deadline) || deadline.length < 2) {
      console.warn('⚠️ Geçersiz deadline:', { uploadedMonth, uploadedYear, companyType, reportingPeriod, deadline });
      return null;
    }

    // Başlangıç yılı: yüklenen dönemin yılı
    let year = uploadedYear;
    const month = deadline[0] as number;
    const day = deadline[1] as number;
    
    // Eğer kural 3. elemanı (isNextYear) içeriyorsa yıla 1 ekle
    const isNextYear = deadline.length > 2 ? (deadline[2] as number) : 0;
    if (isNextYear) {
      year += 1;
    }

    // Hedef tarihini oluştur
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      console.warn('⚠️ Geçersiz tarih parametreleri:', { year, month, day });
      return null;
    }

    let date = new Date(year, month - 1, day);

    // Geçersiz tarih kontrolü
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Geçersiz date nesnesi:', { year, month, day });
      return null;
    }

    // Tatil veya hafta sonu ise bir sonraki iş gününe kaydır
    date = getNextWorkDay(date);

    return date;
  } catch (error) {
    console.error('❌ getDeadlineDate hatası:', error, { uploadedMonth, uploadedYear, companyType, reportingPeriod });
    return null;
  }
}

const EDefterDeadlineTracker: React.FC = () => {
  const [trackers, setTrackers] = useState<CompanyDeadline[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCompanies: 0, completedToday: 0, dueSoon: 0, overdue: 0 });
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'due-soon' | 'overdue' | 'pending'>('all');
  const [selectedCompanyType, setSelectedCompanyType] = useState<'all' | 'gelir-vergisi' | 'kurumlar-vergisi'>('all');
  const [ignoredCompanies, setIgnoredCompanies] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDeadlineData();
    const interval = setInterval(loadDeadlineData, 5 * 60 * 1000);
    
    if ((window as any).electronAPI?.onTriggerScan) {
      (window as any).electronAPI.onTriggerScan(() => {
        console.log('🔄 E-Defter takip verileri yenileniyor...');
        loadDeadlineData();
      });
    }

    return () => {
      clearInterval(interval);
      if ((window as any).electronAPI?.removeAllListeners) {
        (window as any).electronAPI.removeAllListeners('trigger-scan');
      }
    };
  }, []);

  const loadDeadlineData = async () => {
    try {
      setLoading(true);
      const companiesResult = await ElectronService.loadData('companies', []);
      const monitoringResult = await ElectronService.loadData('monitoring-data', []);
      const ignoredResult = await ElectronService.loadData('ignored-companies', []);

      console.log('📊 Veri Yükleme Sonuçları:', {
        companiesSuccess: companiesResult.success,
        companiesType: typeof companiesResult.data,
        monitoringType: typeof monitoringResult.data,
        ignoredType: typeof ignoredResult.data,
        companiesIsArray: Array.isArray(companiesResult.data),
        monitoringIsArray: Array.isArray(monitoringResult.data),
        ignoredIsArray: Array.isArray(ignoredResult.data)
      });

      if (!companiesResult.success || !companiesResult.data) throw new Error('Şirket yükleme hatası');

      const companies: Company[] = (Array.isArray(companiesResult.data) ? companiesResult.data : []).filter((c: Company) => c?.status === 'active');
      const monitoringData = (Array.isArray(monitoringResult.data) ? monitoringResult.data : []);
      const ignoredList = (Array.isArray(ignoredResult.data) ? ignoredResult.data : []);
      // Güvenli Set oluşturma - sadece string değerler al
      const safeIgnoredList = ignoredList.filter(item => typeof item === 'string') as string[];
      const ignoredSet = new Set<string>(safeIgnoredList);

      console.log('✅ İşlenen Veriler:', {
        companiesCount: companies.length,
        monitoringCount: monitoringData.length,
        monitoringFirst3: monitoringData.slice(0, 3),
        ignoredCount: ignoredList.length
      });
      
      setIgnoredCompanies(ignoredSet);
      const today = new Date();
      const newTrackers: CompanyDeadline[] = [];

      console.log('🔄 Şirket döngüsü başlıyor...');
      for (const company of companies) {
        const companyType = (company.companyType || 'kurumlar-vergisi') as 'gelir-vergisi' | 'kurumlar-vergisi';
        const reportingPeriod = (company.reportingPeriod || 'aylık') as 'aylık' | '3-aylık';
        const compId = company.tcNumber || company.taxNumber;

        if (!compId || ignoredSet.has(compId) || ignoredSet.has(company.id)) continue;

        // Yüklenen e-defterleri bul - companyId eşleştir
        const allUploads: Array<{ month: number; year: number }> = [];
        if (Array.isArray(monitoringData) && monitoringData.length > 0) {
          console.log(`🔍 ${company.name} için kayıtlar arıyoruz. CompID: ${compId}`);
          for (const record of monitoringData) {
            if (record && typeof record === 'object') {
              // companyId'yi kontrol et (direct olarak kaydediliyor)
              const recordCompId = record.companyId;
              
              console.log(`  📋 Record kontrol: ID=${recordCompId}, Status=${record.status}, Y/A=${record.year}/${record.month}`);
              
              // Eşleşme kontrol et (Exact match)
              if (recordCompId === compId && record.status === 'complete') {
                allUploads.push({ month: record.month, year: record.year });
                console.log(`    ✅ EŞLEŞTİ: ${recordCompId} === ${compId}`);
              }
            }
          }
          console.log(`  📊 ${company.name} için bulunan yüklemeler: ${allUploads.length}`);
        }

        if (allUploads.length === 0) continue;

        // Son yüklenen tarihi bul
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

        // Deadline'ı hesapla (yüklenecek dönem için)
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

      setTrackers(newTrackers);
      
      const dueSoon = newTrackers.filter(t => t.nextDeadline && t.nextDeadline.remainingDays <= 3 && t.nextDeadline.remainingDays >= 0).length;
      const overdue = newTrackers.filter(t => t.nextDeadline && t.nextDeadline.remainingDays < 0).length;
      
      setStats({
        totalCompanies: newTrackers.length,
        completedToday: 0,
        dueSoon,
        overdue
      });
    } catch (error) {
      console.error('❌ E-Defter takip hatası:', error);
      console.error('❌ Hata Detayları:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack'
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTrackers = () => {
    let filtered = [...trackers];
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.nextDeadline && t.nextDeadline.status === filterStatus);
    }
    
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

  const filteredData = getFilteredTrackers();

  return (
    <div className="space-y-6">
      {/* Başlık */}
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
      </div>

      {/* İstatistik Kartları */}
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

      {/* Filtreler */}
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
            <option value="pending">Zamanında</option>
            <option value="due-soon">Yaklaşıyor</option>
            <option value="overdue">Gecikmiş</option>
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

      {/* Tablo */}
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
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Kayıt bulunmamaktadır</p>
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
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleIgnoreCompany(tracker.compTaxId)}
                        className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold text-xs rounded transition"
                        title="Bu uyarıyı yoksay"
                      >
                        Yoksay
                      </button>
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

export default EDefterDeadlineTracker;
export { EDefterDeadlineTracker };
