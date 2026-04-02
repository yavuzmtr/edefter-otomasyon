# E-Defter Otomasyon Satin Alma ve Lisanslama Sureci (Tam Dokuman)

Bu dokuman, musteri satin alma talebinden lisans aktif edilmesine kadar olan tum adimlari aciklar.

## 1) Satin Alma Talebi (Web Formu)

Musteri su formu doldurur:

- https://edefterotomasyon.com.tr/purchase-form.html

Form doldurulunca:
- Sana talep maili gelir.
- Musteriye otomatik bir mail gider (odeme bilgileri).

## 2) Odeme

Musteri odemeyi yapar ve dekontu sana mail ile gonderir.
Alternatif: Form uzerinden dekont yukleyebilir.

## 3) Full Kurulum Linki Gonderimi

Odeme onaylandiktan sonra musteriye full kurulum linki gonderilir.

Ornek link (kod otomatik girer):

```
https://edefterotomasyon.com.tr/full-download-portal-7f3a9c.html?code=Bilgehan-2026
```

Musteri linke tiklar ve kurulum dosyasini indirir.

## 4) Kurulum ve Cihaz Kimligi

Musteri kurulumdan sonra programi acinca cihaz kimligi ekranda gorunur.
Musteri bu cihaz kimligini sana iletir.

## 5) Lisans Talebi (GitHub Issue)

Sen GitHub’da yeni bir issue acarsin ve asagidaki bilgileri girersin:

```
### Musteri / Firma
ABC Muhasebe

### Musteri E-posta
musteri@firma.com

### Cihaz Kimligi
AFF3CD3B481DC6B98E0D708206C3E3900D2B10CA303D2648703A41F11080757D
```

Issue’ya su iki etiketi ekle:
- license-request
- approve

## 6) Otomatik Lisans Uretimi ve Mail

`approve` etiketi eklenince sistem otomatik calisir:
- Lisans dosyasi uretilir
- Musteriye e-posta ile gonderilir
- Issue’ya “Lisans gonderildi” yorumu dusulur
- Issue “fulfilled” etiketi alir

## 7) Lisansin Musteri Tarafindan Uygulanmasi

Musteri mailde gelen lisans dosyasini su klasore kopyalar:

```
%APPDATA%\edefter-automation
```

Program lisansli sekilde calisir.

## 8) Kisa Ozet (Tek Cumle)

Form -> Odeme -> Full Kurulum -> Cihaz Kimligi -> Issue + Approve -> Lisans Mail -> Aktivasyon

## 9) Hazir Mail Sablonlari

Odeme Bilgisi (Form Sonrasi Otomatik Mail):
Merhaba {{Musteri/Firma}},
Satin alma talebiniz alinmistir. Odeme bilgileri:
Alici: Yavuz Mercimek
IBAN: TR95 0020 5000 0101 8288 4000 08
Odeme sonrasi bu e-postaya dekont gonderebilirsiniz.

Odeme Onay Maili:
Merhaba {{Musteri/Firma}},
Odeminiz ulasmistir. Lisansiniz hazirlaniyor. Cihaz kimligi paylastiysaniz surec hemen baslayacak.

Lisans Teslim Maili:
Merhaba {{Musteri/Firma}},
Lisans dosyaniz ektedir. Lutfen su klasore kopyalayin:
%APPDATA%\\edefter-automation
Sonra uygulamayi yeniden baslatin.
