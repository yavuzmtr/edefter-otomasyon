import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Mail,
  AlertCircle,
  Download,
  Save,
  X
} from 'lucide-react';
import { ElectronService } from '../services/electronService';
import { logService } from '../services/logService';
import { Company } from '../types';

interface ExcelRowData {
  [key: string]: string | number | undefined;
  'Şirket Adı'?: string;
  'Company Name'?: string;
  name?: string;
  'Vergi Numarası'?: string;
  'Vergi No'?: string;
  'Tax Number'?: string;
  taxNumber?: string;
  'T.C. Kimlik Numarası'?: string;
  'TC No'?: string;
  'TC Number'?: string;
  tcNumber?: string;
  'E-posta'?: string;
  'Email'?: string;
  email?: string;
  'Şirket Türü'?: string;
  'Company Type'?: string;
  companyType?: string;
  'Raporlama Dönemi'?: string;
  'Reporting Period'?: string;
  reportingPeriod?: string;
}

interface MonitoringData {
  isUnregistered: boolean;
  companyId: string;
}

export const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [taxTCFilterTerm, setTaxTCFilterTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [filterCompanyType, setFilterCompanyType] = useState<'all' | 'gelir-vergisi' | 'kurumlar-vergisi'>('all');
  const [filterReportingPeriod, setFilterReportingPeriod] = useState<'all' | 'aylık' | '3-aylık'>('all');
  const [selectedCompaniesForBulkEdit, setSelectedCompaniesForBulkEdit] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    companyType: 'kurumlar-vergisi' as const,
    reportingPeriod: 'aylık' as const
  });
  const [newCompany, setNewCompany] = useState({
    name: '',
    taxNumber: '',
    tcNumber: '',
    email: '',
    status: 'active' as const,
    companyType: 'kurumlar-vergisi' as const,
    reportingPeriod: 'aylık' as const
  });

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const result = await ElectronService.loadData('companies', []);
      if (result.success) {
        // Migration: TC Kimlik No varsa otomatik olarak "Gelir Vergisi Mükellefi" olarak işaretle
        const migratedCompanies = (result.data || []).map((company: any) => {
          // TC Kimlik No varsa ve şirket türü belirtilmemişse gelir-vergisi olarak işaretle
          if (company.tcNumber && company.tcNumber.trim() && (!company.companyType || company.companyType === 'kurumlar-vergisi')) {
            return { ...company, companyType: 'gelir-vergisi' };
          }
          // Eğer companyType ve reportingPeriod yoksa default değerleri ata
          return {
            ...company,
            companyType: company.companyType || 'kurumlar-vergisi',
            reportingPeriod: company.reportingPeriod || 'aylık'
          };
        });
        
        // Migration sonrası değişiklik varsa kaydet
        const needsUpdate = (result.data || []).some((company: any) => {
          if (company.tcNumber && company.tcNumber.trim() && company.companyType !== 'gelir-vergisi') return true;
          if (!company.companyType || !company.reportingPeriod) return true;
          return false;
        });
        
        if (needsUpdate) {
          await ElectronService.saveData('companies', migratedCompanies);
          logService.logSystemAction('Şirket Verisi Migration', 'TC Kimlik No\'su olan şirketler Gelir Vergisi Mükellefi olarak işaretlendi', 'info');
        }
        
        setCompanies(migratedCompanies);
      }
    } catch {
      showNotification('error', 'Şirket verileri yüklenirken hata oluştu');
    }
  }, [showNotification]);

  // Sayfa yüklendiğinde şirket verilerini yükle
  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const saveCompanies = async (updatedCompanies: Company[]) => {
    try {
      const result = await ElectronService.saveData('companies', updatedCompanies);
      if (result.success) {
        setCompanies(updatedCompanies);
        showNotification('success', 'Şirket verileri kaydedildi');
      } else {
        showNotification('error', 'Veri kaydedilirken hata oluştu');
      }
    } catch {
      showNotification('error', 'Veri kaydedilirken hata oluştu');
    }
  };

  const filteredCompanies = companies.filter(company => {
    // Arama filtresi
    const matchesSearch = company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email?.toLowerCase().includes(searchTerm.toLowerCase());

    // Vergi/TC No filtresi
    const matchesTaxTC = !taxTCFilterTerm ||
      (company.taxNumber && company.taxNumber.toString().includes(taxTCFilterTerm)) ||
      (company.tcNumber && company.tcNumber.toString().includes(taxTCFilterTerm));

    // Şirket türü filtresi
    const matchesCompanyType = filterCompanyType === 'all' || company.companyType === filterCompanyType;

    // Raporlama dönemi filtresi
    const matchesReportingPeriod = filterReportingPeriod === 'all' || company.reportingPeriod === filterReportingPeriod;

    return matchesSearch && matchesTaxTC && matchesCompanyType && matchesReportingPeriod;
  });

  const downloadExcelTemplate = async () => {
    try {
      // ✅ Profesyonel Excel şablonu - Tüm açıklamalar ve formatlar dahil
      const templateData = [
        // Başlık satırı
        ['Şirket Adı', 'Vergi Numarası', 'T.C. Kimlik Numarası', 'E-posta', 'Şirket Türü', 'Raporlama Dönemi'],
        
        // Boş satır
        ['', '', '', '', '', ''],
        
        // ÖNEMLI NOTLAR
        ['🚨 ÖNEMLİ NOTLAR - Lütfen Dikkatle Okuyunuz:', '', '', '', '', ''],
        
        // Bölüm 1: Sıfır Sorunu
        ['📌 1️⃣ BAŞINDA SIFIR OLAN NUMARA SORUNU:', '', '', '', '', ''],
        ['• Vergi Numarası başında sıfır varsa: \'0721114162 şeklinde yazın', '', '', '', '', ''],
        ['• T.C. Kimlik Numarası başında sıfır varsa: \'01234567890 şeklinde yazın', '', '', '', '', ''],
        ['• Sistem artık başındaki sıfırları otomatik düzeltiyor', '', '', '', '', ''],
        
        ['', '', '', '', '', ''],
        
        // Bölüm 2: Gerekli Alanlar
        ['📌 2️⃣ GEREKLİ ALANLAR:', '', '', '', '', ''],
        ['• Şirket Adı: ZORUNLU (boş bırakmayınız)', '', '', '', '', ''],
        ['• Vergi Numarası VEYA T.C. Kimlik Numarası: ZORUNLU (en az biri dolu olmalı)', '', '', '', '', ''],
        ['• E-posta: ZORUNLU (kullanıcıya başarı/hata bildirimi gönderilecek)', '', '', '', '', ''],
        
        ['', '', '', '', '', ''],
        
        // Bölüm 3: Şirket Türü
        ['📌 3️⃣ ŞİRKET TÜRÜ SEÇENEKLERI:', '', '', '', '', ''],
        ['• gelir-vergisi: Bireysel işletmeci (T.C. Kimlik No olan)', '', '', '', '', ''],
        ['• kurumlar-vergisi: Limited/Anonim şirket (Vergi No olan)', '', '', '', '', ''],
        ['• Eğer T.C. Kimlik No varsa, sistem otomatik "gelir-vergisi" olarak işaretler', '', '', '', '', ''],
        
        ['', '', '', '', '', ''],
        
        // Bölüm 4: Raporlama Dönemi
        ['📌 4️⃣ RAPORLAMA DÖNEMİ SEÇENEKLERİ:', '', '', '', '', ''],
        ['• aylık: Aylık muhasebe raporlaması yapan şirketler', '', '', '', '', ''],
        ['• 3-aylık: Üç aylık (dönemlik) muhasebe raporlaması yapan şirketler', '', '', '', '', ''],
        
        ['', '', '', '', '', ''],
        
        // Bölüm 5: İPUÇLARI
        ['💡 ÖZEL İPUÇLARI:', '', '', '', '', ''],
        ['• Her şirket için en az bir numara (Vergi No veya TC No) gereklidir', '', '', '', '', ''],
        ['• E-posta adresini doğru yazınız, sistem bundan sonuç iletecek', '', '', '', '', ''],
        ['• Şirket adını tam ve açık şekilde yazınız', '', '', '', '', ''],
        
        ['', '', '', '', '', ''],
        ['', '', '', '', '', ''],
        
        // ÖRNEK VERİLER
        ['✅ ÖRNEK VERİLER - Bu satırları silin ve yerine kendi verilerinizi yazınız:', '', '', '', '', ''],
        ['ABC Şirketi Ltd. Şti.', "'1234567890", '', 'info@abcsirketi.com', 'kurumlar-vergisi', 'aylık'],
        ['XYZ Ticaret A.Ş.', "'0987654321", '', 'iletisim@xyzticaret.com', 'kurumlar-vergisi', '3-aylık'],  
        ['DEF İnşaat Ltd.', "'0721114162", '', 'def@insaat.com', 'kurumlar-vergisi', 'aylık'],
        ['Ahmet Yılmaz', '', "'12345678901", 'ahmet.yilmaz@email.com', 'gelir-vergisi', 'aylık'],
        ['Fatma Demir', '', "'01234567890", 'fatma.demir@email.com', 'gelir-vergisi', '3-aylık']
      ];

      // Electron ortamında Excel dosyası oluştur (XLSX formatında)
      const result = await ElectronService.createExcelTemplate(templateData, { isTemplate: true });
      if (result.success) {
        showNotification('success', `✅ Excel şablonu başarıyla oluşturuldu!\n📁 Dosya: sirket-sablonu.xlsx`);
        logService.logManualAction('Excel Şablonu İndirme', `Şablon başarıyla oluşturuldu: ${result.filePath}`, 'success');
      } else {
        showNotification('error', result.error || 'Şablon oluşturulamadı');
        logService.logManualAction('Excel Şablonu İndirme', `Şablon oluşturma hatası: ${result.error}`, 'error');
      }
    } catch (error) {
      showNotification('error', 'Şablon indirilemedi');
      logService.logManualAction('Excel Şablonu İndirme', `Şablon indirme hatası: ${error}`, 'error');
    }
  };

  const checkDuplicateCompany = (companyData: Partial<Company>, excludeId?: string) => {
    return companies.some(company => {
      if (excludeId && company.id === excludeId) return false;
      
      // Vergi numarası kontrolü - sadece dolu ise kontrol et
      if (companyData.taxNumber && company.taxNumber && company.taxNumber === companyData.taxNumber) {
        return true;
      }
      
      // TC numarası kontrolü - sadece dolu ise kontrol et
      if (companyData.tcNumber && company.tcNumber && company.tcNumber === companyData.tcNumber) {
        return true;
      }
      
      return false;
    });
  };

  const handleFileUpload = async () => {
    setLoading(true);
    logService.logManualAction('Excel Dosyası Yükleme', 'Kullanıcı Excel dosyası yükleme işlemi başlattı');
    try {
      const result = await ElectronService.selectExcelFile();
      
      if (result.success && result.data) {
        logService.logManualAction('Excel Verisi Okundu', `${result.data.length} kayıt okundu`);
        const excelCompanies: Company[] = result.data.map((row: ExcelRowData, index: number) => {
          const tcNumber = row['T.C. Kimlik Numarası'] || row['TC No'] || row['TC Number'] || row.tcNumber || '';
          const taxNumber = row['Vergi Numarası'] || row['Vergi No'] || row['Tax Number'] || row.taxNumber || '';
          
          // Şirket türü: Excel'den okunmaya çalış, yoksa TC varsa gelir-vergisi, değilse kurumlar-vergisi
          let companyType: 'gelir-vergisi' | 'kurumlar-vergisi' = 'kurumlar-vergisi';
          const excelCompanyType = row['Şirket Türü'] || row['Company Type'] || row.companyType || '';
          
          if (excelCompanyType && excelCompanyType.trim()) {
            const typeStr = excelCompanyType.toString().toLowerCase().trim();
            if (typeStr === 'gelir-vergisi' || typeStr === 'gelir vergisi' || typeStr === 'income') {
              companyType = 'gelir-vergisi';
            } else if (typeStr === 'kurumlar-vergisi' || typeStr === 'kurumlar vergisi' || typeStr === 'corporate') {
              companyType = 'kurumlar-vergisi';
            } else if (tcNumber && tcNumber.trim()) {
              // Şirket türü belirtilmemişse ama TC var ise gelir-vergisi
              companyType = 'gelir-vergisi';
            }
          } else if (tcNumber && tcNumber.trim()) {
            // TC Kimlik No varsa otomatik olarak "Gelir Vergisi Mükellefi" olarak işaretle
            companyType = 'gelir-vergisi';
          }
          
          // Raporlama dönemi: Excel'den okunmaya çalış, yoksa aylık olarak default ata
          let reportingPeriod: 'aylık' | '3-aylık' = 'aylık';
          const excelReportingPeriod = row['Raporlama Dönemi'] || row['Reporting Period'] || row.reportingPeriod || '';
          
          if (excelReportingPeriod && excelReportingPeriod.trim()) {
            const periodStr = excelReportingPeriod.toString().toLowerCase().trim();
            if (periodStr === '3-aylık' || periodStr === '3 aylık' || periodStr === 'quarterly' || periodStr === '3-monthly') {
              reportingPeriod = '3-aylık';
            } else {
              reportingPeriod = 'aylık';
            }
          }
          
          return {
            id: Date.now().toString() + index,
            name: row['Şirket Adı'] || row['Company Name'] || row.name || '',
            taxNumber: taxNumber,
            tcNumber: tcNumber,
            email: row['E-posta'] || row['Email'] || row.email || '',
            status: 'active' as const,
            companyType,
            reportingPeriod
          };
        }).filter(company => {
          // Şirket adı zorunlu, vergi/tc numarası zorunlu, e-posta isteğe bağlı
          const hasValidId = company.taxNumber?.trim() || company.tcNumber?.trim();
          return company.name && hasValidId;
        });

        // Mükerrer kontrol
        const validCompanies = [];
        const duplicates = [];
        
        for (const company of excelCompanies) {
          if (checkDuplicateCompany(company)) {
            duplicates.push(company.name);
          } else {
            validCompanies.push(company);
          }
        }

        if (validCompanies.length > 0) {
          const updatedCompanies = [...companies, ...validCompanies];
          await saveCompanies(updatedCompanies);
          const gelirVergisiCount = validCompanies.filter(c => c.companyType === 'gelir-vergisi').length;
          const ucAylikCount = validCompanies.filter(c => c.reportingPeriod === '3-aylık').length;
          logService.logCompanyAction('Toplu Şirket Ekleme', `${validCompanies.length} şirket eklendi (${gelirVergisiCount} Gelir Vergisi, ${validCompanies.length - gelirVergisiCount} Kurumlar Vergisi, ${ucAylikCount} 3-Aylık), ${duplicates.length} aynı vergi/TC no atlandı`, 'success');
          
          let message = `✅ ${validCompanies.length} şirket başarıyla yüklendi (başındaki sıfırlar korundu)`;
          if (gelirVergisiCount > 0) {
            message += `. ${gelirVergisiCount} şirket Gelir Vergisi Mükellefi`;
          }
          if (ucAylikCount > 0) {
            message += `. ${ucAylikCount} şirket 3-Aylık raporlama`;
          }
          if (duplicates.length > 0) {
            message += `. ${duplicates.length} aynı vergi/TC no'lu kayıt atlandı`;
          }
          showNotification('success', message);
        } else {
          logService.logCompanyAction('Toplu Şirket Ekleme', 'Hiç geçerli şirket bulunamadı', 'error');
          showNotification('error', duplicates.length > 0 ? 'Tüm kayıtların vergi/TC numaraları zaten sistemde mevcut' : 'Excel dosyasında geçerli şirket verisi bulunamadı');
        }
      } else {
        logService.logManualAction('Excel Dosyası Okuma', 'Excel dosyası okunamadı', 'error');
        showNotification('error', result.error || 'Excel dosyası okunamadı');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logService.logManualAction('Excel Dosyası Yükleme', `Excel dosyası yüklenirken hata oluştu: ${errorMessage}`, 'error');
      showNotification('error', `Excel dosyası yüklenirken hata oluştu: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (newCompany.name && newCompany.email && (newCompany.taxNumber || newCompany.tcNumber)) {
      // Mükerrer kontrol
      if (checkDuplicateCompany(newCompany)) {
        showNotification('error', 'Bu vergi numarası veya TC kimlik numarası zaten kayıtlı');
        return;
      }
      
      // Vergi/TC numarası kontrolü
      if (!newCompany.taxNumber && !newCompany.tcNumber) {
        showNotification('error', 'Vergi numarası veya TC kimlik numarası zorunludur');
        return;
      }

      // TC Kimlik No varsa otomatik olarak "Gelir Vergisi Mükellefi" olarak işaretle
      const companyType = newCompany.tcNumber && newCompany.tcNumber.trim() ? 'gelir-vergisi' : newCompany.companyType;

      const company: Company = {
        id: Date.now().toString(),
        ...newCompany,
        companyType
      };
      
      const updatedCompanies = [...companies, company];
      await saveCompanies(updatedCompanies);
      logService.logCompanyAction('Şirket Ekleme', `${company.name} şirketi eklendi (Tür: ${companyType === 'gelir-vergisi' ? 'Gelir Vergisi' : 'Kurumlar Vergisi'})`);
      setNewCompany({ name: '', taxNumber: '', tcNumber: '', email: '', status: 'active', companyType: 'kurumlar-vergisi', reportingPeriod: 'aylık' });
      setShowAddModal(false);
    } else {
      showNotification('error', 'Şirket adı, e-posta ve vergi/TC numarası zorunludur');
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowEditModal(true);
  };

  const handleUpdateCompany = async () => {
    if (editingCompany && editingCompany.name && editingCompany.email && (editingCompany.taxNumber || editingCompany.tcNumber)) {
      // Mükerrer kontrol (kendi ID'si hariç)
      if (checkDuplicateCompany(editingCompany, editingCompany.id)) {
        showNotification('error', 'Bu vergi numarası veya TC kimlik numarası başka bir şirkette zaten kayıtlı');
        return;
      }
      
      // Vergi/TC numarası kontrolü
      if (!editingCompany.taxNumber && !editingCompany.tcNumber) {
        showNotification('error', 'Vergi numarası veya TC kimlik numarası zorunludur');
        return;
      }

      // TC Kimlik No varsa otomatik olarak "Gelir Vergisi Mükellefi" olarak işaretle
      const companyType = editingCompany.tcNumber && editingCompany.tcNumber.trim() ? 'gelir-vergisi' : editingCompany.companyType;
      const updatedEditingCompany = { ...editingCompany, companyType };

      const updatedCompanies = companies.map(company =>
        company.id === editingCompany.id ? updatedEditingCompany : company
      );
      await saveCompanies(updatedCompanies);
      logService.logCompanyAction('Şirket Güncelleme', `${editingCompany.name} şirketi güncellendi (Tür: ${companyType === 'gelir-vergisi' ? 'Gelir Vergisi' : 'Kurumlar Vergisi'})`);
      
      // E-posta sistemine güncelleme bildir
      try {
        await ElectronService.saveData('companies-updated', Date.now());
      } catch (error) {
        console.warn('E-posta sistemi güncellenemedi:', error);
      }
      
      setShowEditModal(false);
      setEditingCompany(null);
    } else {
      showNotification('error', 'Şirket adı, e-posta ve vergi/TC numarası zorunludur');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm('Bu şirketi silmek istediğinizden emin misiniz?')) {
      const company = companies.find(c => c.id === id);
      const updatedCompanies = companies.filter(company => company.id !== id);
      await saveCompanies(updatedCompanies);
      logService.logCompanyAction('Şirket Silme', `${company?.name || 'Bilinmeyen'} şirketi silindi`);
    }
  };

  const toggleCompanyStatus = async (id: string) => {
    const company = companies.find(c => c.id === id);
    const newStatus: 'active' | 'inactive' = company?.status === 'active' ? 'inactive' : 'active';
    const updatedCompanies = companies.map(company =>
      company.id === id
        ? { ...company, status: newStatus }
        : company
    );
    await saveCompanies(updatedCompanies);
    logService.logCompanyAction('Şirket Durum Değişikliği', `${company?.name} şirketi ${newStatus} yapıldı`);
  };

  const handleSelectCompanyForBulkEdit = (companyId: string) => {
    const newSelected = new Set(selectedCompaniesForBulkEdit);
    if (newSelected.has(companyId)) {
      newSelected.delete(companyId);
    } else {
      newSelected.add(companyId);
    }
    setSelectedCompaniesForBulkEdit(newSelected);
  };

  const handleSelectAllFiltered = () => {
    if (selectedCompaniesForBulkEdit.size === filteredCompanies.length) {
      setSelectedCompaniesForBulkEdit(new Set());
    } else {
      const allIds = new Set(filteredCompanies.map(c => c.id));
      setSelectedCompaniesForBulkEdit(allIds);
    }
  };

  const handleBulkEditApply = async () => {
    if (selectedCompaniesForBulkEdit.size === 0) {
      showNotification('error', 'Lütfen düzenlemek için şirket seçin');
      return;
    }

    const updatedCompanies = companies.map(company => {
      if (selectedCompaniesForBulkEdit.has(company.id)) {
        return {
          ...company,
          companyType: bulkEditData.companyType,
          reportingPeriod: bulkEditData.reportingPeriod
        };
      }
      return company;
    });

    await saveCompanies(updatedCompanies);
    logService.logCompanyAction('Toplu Şirket Güncelleme', `${selectedCompaniesForBulkEdit.size} şirket güncellendi`, 'success');
    showNotification('success', `${selectedCompaniesForBulkEdit.size} şirket başarıyla güncellendi`);
    
    setSelectedCompaniesForBulkEdit(new Set());
    setShowBulkEditModal(false);
  };

  const importUnregisteredCompanies = async () => {
    try {
      setLoading(true);
      logService.logManualAction('Tanımlanmamış Şirket İmport', 'Tanımlanmamış şirketleri içe aktarma başlatıldı');

      // Monitoring verilerinden tanımlanmamış şirketleri al
      const result = await ElectronService.loadData('monitoring-data', []);
      if (!result.success || !result.data) {
        showNotification('error', 'Monitoring verileri yüklenemedi');
        return;
      }

      console.log('📊 Monitoring-data yapısı (ilk item):', result.data[0]);
      console.log('📊 Toplam monitoring verileri:', result.data.length);
      console.log('📊 isUnregistered ile filtrele:', result.data.filter((item: MonitoringData) => item.isUnregistered === true).length);
      console.log('📊 isUnregistered undefined olan veriler:', result.data.filter((item: MonitoringData) => item.isUnregistered === undefined).length);

      // Benzersiz şirket ID'lerini topla (aynı vergi numarasından sadece 1 tane)
      const uniqueCompanyIds = new Set<string>();
      const unregisteredCompanies = result.data
        .filter((item: MonitoringData) => item.isUnregistered === true || item.isUnregistered === undefined)
        .reduce((acc: Company[], curr: MonitoringData) => {
          // Aynı company ID'den sadece bir tane ekle
          if (!uniqueCompanyIds.has(curr.companyId)) {
            uniqueCompanyIds.add(curr.companyId);
            acc.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              name: `Şirket ${curr.companyId}`,
              taxNumber: curr.companyId.length === 10 ? curr.companyId : undefined,
              tcNumber: curr.companyId.length === 11 ? curr.companyId : undefined,
              email: '',
              status: 'active' as const
            });
          }
          return acc;
        }, []);

      if (unregisteredCompanies.length === 0) {
        showNotification('error', 'Tanımlanmamış şirket bulunamadı - Monitoring verilerinde tanımlanmamış şirket yok');
        console.warn('⚠️ İçe aktarılacak tanımlanmamış şirket yok');
        return;
      }

      // Mevcut şirketlerle çakışmayanları ekle
      const existingIds = companies.map(c => c.taxNumber || c.tcNumber);
      const newCompanies = unregisteredCompanies.filter((uc: Company) => 
        !existingIds.includes(uc.taxNumber || uc.tcNumber)
      );

      if (newCompanies.length === 0) {
        showNotification('success', 'Tüm tanımlanmamış şirketler zaten sisteme eklenmiş');
        return;
      }

      const updatedCompanies = [...companies, ...newCompanies];
      await saveCompanies(updatedCompanies);
      
      logService.logCompanyAction('Tanımlanmamış Şirket İmport', `${newCompanies.length} tanımlanmamış şirket sisteme eklendi`, 'success');
      showNotification('success', `${newCompanies.length} tanımlanmamış şirket sisteme eklendi`);
      
    } catch {
      logService.logManualAction('Tanımlanmamış Şirket İmport', 'İmport işlemi başarısız', 'error');
      showNotification('error', 'İmport işlemi sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-4">
      <div className="w-full space-y-6 animate-fade-in">
        {/* Notification */}
        {notification && (
          <div className="fixed top-6 right-6 z-50 animate-slide-down">
            <div className={`p-4 rounded-2xl shadow-2xl border ${
              notification.type === 'success' 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : 'bg-red-100 text-red-800 border-red-200'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                </div>
                <span className="font-medium">{notification.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏢 Şirket Yönetimi</h1>
              <p className="text-gray-600">Müşteri şirket bilgilerini yönetin</p>
            </div>
          </div>
        <div className="flex space-x-3">
          <button
            onClick={downloadExcelTemplate}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Örnek Şablon</span>
          </button>
          <button
            onClick={handleFileUpload}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors cursor-pointer flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>{loading ? 'Yükleniyor...' : 'Excel Yükle'}</span>
          </button>
          <button
            onClick={importUnregisteredCompanies}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Tanımlanmamış İçe Aktar</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Şirket Ekle</span>
          </button>
        </div>
      </div>

      {/* Excel Sıfır Sorunu Uyarısı */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 text-lg mb-2">🚨 BAŞINDA SIFIR OLAN NUMARA SORUNU ÇÖZÜMÜ</h4>
            <div className="bg-white p-4 rounded-lg border border-red-200 mb-4">
              <p className="text-red-800 mb-2">
                <strong>Sorun:</strong> Excel, başında sıfır olan numaraları otomatik siler. Örnek: <code>0721114162</code> → <code>721114162</code>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <h5 className="font-semibold text-red-900 mb-2">✅ ÇÖZÜM 1: Apostrophe Kullanın</h5>
                  <div className="bg-green-100 p-3 rounded border border-green-300">
                    <p className="text-sm text-green-800 mb-1">Excel'de numaranın başına apostrophe (') koyun:</p>
                    <code className="text-green-900 bg-green-200 px-2 py-1 rounded text-sm">'0721114162</code>
                    <p className="text-xs text-green-700 mt-1">Bu şekilde başındaki sıfır korunur!</p>
                  </div>
                </div>
                <div>
                  <h5 className="font-semibold text-red-900 mb-2">✅ ÇÖZÜM 2: Hücre Formatını Değiştirin</h5>
                  <div className="bg-green-100 p-3 rounded border border-green-300">
                    <ol className="text-sm text-green-800 space-y-1">
                      <li>1. Hücreyi sağ tıklayın</li>
                      <li>2. "Hücre Biçimi" seçin</li>
                      <li>3. "Metin" formatını seçin</li>
                      <li>4. Numarayı normal yazın</li>
                    </ol>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                <p className="text-sm text-blue-800">
                  <strong>💡 Not:</strong> Sistem artık Excel'den okuduğu vergileri otomatik düzeltiyor, 
                  ancak yine de yukarıdaki yöntemleri kullanmanızı öneriyoruz.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Excel Template Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <FileSpreadsheet className="w-6 h-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 text-lg mb-2">📋 Excel Şablonu Kullanım Kılavuzu</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-800 mb-3">
                  Şirket bilgilerini toplu olarak yüklemek için aşağıdaki adımları takip edin:
                </p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li><strong>"Örnek Şablon"</strong> butonuna tıklayın</li>
                  <li>İndirilen <strong>Excel dosyasını</strong> açın</li>
                  <li>Örnek verileri silin ve <strong>kendi verilerinizi</strong> girin</li>
                  <li>Dosyayı <strong>kaydedin</strong></li>
                  <li><strong>"Excel Yükle"</strong> butonu ile sisteme yükleyin</li>
                </ol>
              </div>
              <div>
                <p className="text-sm text-blue-800 mb-3">
                  <strong>📊 Şablonda bulunan sütunlar:</strong>
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li><span className="inline-block w-4 h-4 bg-red-500 rounded-full mr-2"></span><strong>Şirket Adı:</strong> Şirketin tam unvanı (zorunlu)</li>
                  <li><span className="inline-block w-4 h-4 bg-orange-500 rounded-full mr-2"></span><strong>Vergi Numarası:</strong> 10 haneli vergi numarası</li>
                  <li><span className="inline-block w-4 h-4 bg-yellow-500 rounded-full mr-2"></span><strong>T.C. Kimlik Numarası:</strong> 11 haneli TC kimlik numarası</li>
                  <li><span className="inline-block w-4 h-4 bg-red-500 rounded-full mr-2"></span><strong>E-posta:</strong> İletişim e-posta adresi (zorunlu)</li>
                  <li><span className="inline-block w-4 h-4 bg-purple-500 rounded-full mr-2"></span><strong>Şirket Türü:</strong> gelir-vergisi veya kurumlar-vergisi (isteğe bağlı)</li>
                  <li><span className="inline-block w-4 h-4 bg-indigo-500 rounded-full mr-2"></span><strong>Raporlama Dönemi:</strong> aylık veya 3-aylık (isteğe bağlı)</li>
                </ul>
                <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                  <p className="text-xs text-blue-900">
                    <strong>💡 İpucu:</strong> Her şirket için Vergi Numarası veya T.C. Kimlik Numarası'ndan birini doldurmanız yeterlidir.
                  </p>
                  <p className="text-xs text-blue-900 mt-1">
                    <strong>📧 Not:</strong> Şirket Türü boşsa: TC var ise gelir-vergisi, yoksa kurumlar-vergisi atanır.
                  </p>
                  <p className="text-xs text-blue-900 mt-1">
                    <strong>⏱️ Dönem:</strong> Raporlama Dönemi boşsa otomatik olarak "aylık" atanır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        {/* Arama */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Şirket adı, vergi no veya TC no ile arayın..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Toplam: {filteredCompanies.length} / {companies.length}</span>
          </div>
        </div>

        {/* Filtreler */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Şirket Türü</label>
            <select
              value={filterCompanyType}
              onChange={(e) => setFilterCompanyType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Tümü</option>
              <option value="kurumlar-vergisi">🏢 Kurumlar Vergisi Mükellefi</option>
              <option value="gelir-vergisi">💰 Gelir Vergisi Mükellefi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Raporlama Dönemi</label>
            <select
              value={filterReportingPeriod}
              onChange={(e) => setFilterReportingPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Tümü</option>
              <option value="aylık">📅 Aylık</option>
              <option value="3-aylık">📊 3 Aylık</option>
            </select>
          </div>

          <div className="flex items-end">
            {selectedCompaniesForBulkEdit.size > 0 && (
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {selectedCompaniesForBulkEdit.size} Seçili Düzenle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedCompaniesForBulkEdit.size === filteredCompanies.length && filteredCompanies.length > 0}
                    onChange={handleSelectAllFiltered}
                    className="rounded cursor-pointer w-5 h-5"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Şirket Bilgileri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vergi/TC No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Türü / Dönem
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-2 w-12"></th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Şirket adı..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                  />
                </th>
                <th className="px-6 py-2">
                  <input
                    type="text"
                    placeholder="Vergi/TC No..."
                    value={taxTCFilterTerm}
                    onChange={(e) => setTaxTCFilterTerm(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                  />
                </th>
                <th className="px-6 py-2">
                  <div className="flex gap-1">
                    <select
                      value={filterCompanyType}
                      onChange={(e) => setFilterCompanyType(e.target.value as any)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">Tür: Tümü</option>
                      <option value="gelir-vergisi">💰 Gelir</option>
                      <option value="kurumlar-vergisi">🏢 Kurum</option>
                    </select>
                    <select
                      value={filterReportingPeriod}
                      onChange={(e) => setFilterReportingPeriod(e.target.value as any)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="all">Dönem: Tümü</option>
                      <option value="aylık">📅 Aylık</option>
                      <option value="3-aylık">📊 3-Aylık</option>
                    </select>
                  </div>
                </th>
                <th className="px-6 py-2"></th>
                <th className="px-6 py-2"></th>
                <th className="px-6 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className={`hover:bg-gray-50 transition-colors ${selectedCompaniesForBulkEdit.has(company.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedCompaniesForBulkEdit.has(company.id)}
                      onChange={() => handleSelectCompanyForBulkEdit(company.id)}
                      className="rounded cursor-pointer w-5 h-5"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{company.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{company.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span>{company.tcNumber || company.taxNumber || '-'}</span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                        {company.tcNumber ? 'TC' : company.taxNumber ? 'VN' : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                        {company.companyType === 'gelir-vergisi' ? '💰 Gelir Vergisi' : '🏢 Kurumlar Vergisi'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                        {company.reportingPeriod === '3-aylık' ? '📊 3 Aylık' : '📅 Aylık'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleCompanyStatus(company.id)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        company.status === 'active'
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {company.status === 'active' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Pasif
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditCompany(company)}
                        className="text-primary-600 hover:text-primary-900 p-1 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(company.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Yeni Şirket Ekle</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Adı *</label>
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Şirket adını girin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Numarası</label>
                <input
                  type="text"
                  value={newCompany.taxNumber}
                  onChange={(e) => setNewCompany({ ...newCompany, taxNumber: e.target.value.trim() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="10 haneli vergi numarası"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik No</label>
                <input
                  type="text"
                  value={newCompany.tcNumber}
                  onChange={(e) => {
                    let value = e.target.value.trim();
                    // TC numarası 11 hane olmalı, başında sıfır varsa koru
                    if (/^\d+$/.test(value) && value.length <= 11) {
                      setNewCompany({ ...newCompany, tcNumber: value });
                    } else if (!value) {
                      setNewCompany({ ...newCompany, tcNumber: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="11 haneli TC kimlik numarası (ör: 12345678901)"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta *</label>
                <input
                  type="email"
                  value={newCompany.email}
                  onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="E-posta adresini girin"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Türü</label>
                  <select
                    value={newCompany.companyType}
                    onChange={(e) => setNewCompany({ ...newCompany, companyType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="kurumlar-vergisi">🏢 Kurumlar Vergisi Mükellefi</option>
                    <option value="gelir-vergisi">💰 Gelir Vergisi Mükellefi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raporlama Dönemi</label>
                  <select
                    value={newCompany.reportingPeriod}
                    onChange={(e) => setNewCompany({ ...newCompany, reportingPeriod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="aylık">📅 Aylık</option>
                    <option value="3-aylık">📊 3 Aylık</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleAddCompany}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Şirket Düzenle</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Adı *</label>
                <input
                  type="text"
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Şirket adını girin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Numarası</label>
                <input
                  type="text"
                  value={editingCompany.taxNumber || ''}
                  onChange={(e) => setEditingCompany({ ...editingCompany, taxNumber: e.target.value.trim() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="10 haneli vergi numarası"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik No</label>
                <input
                  type="text"
                  value={editingCompany.tcNumber || ''}
                  onChange={(e) => {
                    let value = e.target.value.trim();
                    // TC numarası 11 hane olmalı, başında sıfır varsa koru
                    if (/^\d+$/.test(value) && value.length <= 11) {
                      setEditingCompany({ ...editingCompany, tcNumber: value });
                    } else if (!value) {
                      setEditingCompany({ ...editingCompany, tcNumber: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="11 haneli TC kimlik numarası (ör: 12345678901)"
                  maxLength={11}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta *</label>
                <input
                  type="email"
                  value={editingCompany.email}
                  onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="E-posta adresini girin"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Türü</label>
                  <select
                    value={editingCompany.companyType || 'kurumlar-vergisi'}
                    onChange={(e) => setEditingCompany({ ...editingCompany, companyType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="kurumlar-vergisi">🏢 Kurumlar Vergisi Mükellefi</option>
                    <option value="gelir-vergisi">💰 Gelir Vergisi Mükellefi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raporlama Dönemi</label>
                  <select
                    value={editingCompany.reportingPeriod || 'aylık'}
                    onChange={(e) => setEditingCompany({ ...editingCompany, reportingPeriod: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="aylık">📅 Aylık</option>
                    <option value="3-aylık">📊 3 Aylık</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCompany(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>İptal</span>
              </button>
              <button
                onClick={handleUpdateCompany}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🔄 Toplu Düzenleme ({selectedCompaniesForBulkEdit.size} Şirket)
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                Aşağıda seçilen {selectedCompaniesForBulkEdit.size} şirketin şirket türü ve raporlama dönemini değiştireceksiniz.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Şirket Türü</label>
                <select
                  value={bulkEditData.companyType}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, companyType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="kurumlar-vergisi">🏢 Kurumlar Vergisi Mükellefi</option>
                  <option value="gelir-vergisi">💰 Gelir Vergisi Mükellefi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Raporlama Dönemi</label>
                <select
                  value={bulkEditData.reportingPeriod}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, reportingPeriod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="aylık">📅 Aylık</option>
                  <option value="3-aylık">📊 3 Aylık</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowBulkEditModal(false);
                  setSelectedCompaniesForBulkEdit(new Set());
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>İptal</span>
              </button>
              <button
                onClick={handleBulkEditApply}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Uygula</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

