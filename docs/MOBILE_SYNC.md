# Mobile Sync

Desktop uygulama, `electron/mobile-sync.cjs` uzerinden Supabase'e veri aktarir.

## Calisma

- Desktop tarafindan `companies`, `monitoring-data` ve `completed-periods` okur.
- Ayni ofise bagli firmalari Supabase `companies` tablosuna upsert eder.
- Donem durumlarini `periods` tablosuna yazar.
- Ozet aktivite kaydi olusturur.

## Gerekli Ortam Degiskenleri

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MOBILE_SYNC_EMAIL`
- `MOBILE_SYNC_PASSWORD`
- `MOBILE_OFFICE_ID`
- `MOBILE_SYNC_AUTO`

`MOBILE_SYNC_AUTO=true` yapilirsa uygulama acilisinda bir kere otomatik senkron denenir.

## UI

Masaustu uygulamada `Ayarlar` ekraninda bulunan `Mobil ile Senkronize Et` butonu manuel senkronu tetikler.
