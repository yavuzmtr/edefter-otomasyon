# WhatsApp Business API Kurulum (Meta + Gateway)

Bu rehber ile web paneldeki WhatsApp alanini `wa.me` yerine resmi Meta API ile calistirirsin.

## 1) Meta tarafi

1. Meta Developers'da bir app olustur.
2. Uygulamaya `WhatsApp` urununu ekle.
3. `Phone Number ID` ve `Access Token` al.
4. Bir `Verify Token` belirle (kendin yazacaksin).
5. Test alici numaralarini Meta panelinden ekle.

## 2) Gateway deploy (Render)

Bu repo icinde `render.yaml` hazir.

1. Render hesabinda `New + > Blueprint` sec.
2. Bu GitHub reposunu bagla.
3. `edefter-wa-gateway` servisini deploy et.
4. Render env alaninda su gizli degiskenleri doldur:
   - `WA_GATEWAY_KEY`
   - `WA_PHONE_NUMBER_ID`
   - `WA_ACCESS_TOKEN`
   - `WA_VERIFY_TOKEN`
5. Deploy sonrasi servis URL'i al (ornek: `https://edefter-wa-gateway.onrender.com`).
6. `/health` endpointini ac ve `ok: true` oldugunu kontrol et.

## 3) Meta webhook baglama

Meta WhatsApp ayarinda webhook URL:

`https://<senin-gateway-domainin>/webhook`

Verify token:

`WA_VERIFY_TOKEN` ile ayni olmalı.

## 4) Web panel ayari

Panel: `https://edefterotomasyon.com.tr/marketing-studio-web-7f3a9c.html`

WhatsApp kartinda:
1. Mode: `Meta API (gateway)`
2. Gateway URL: `https://<senin-gateway-domainin>`
3. API Key: `WA_GATEWAY_KEY`
4. `Gateway Test` tikla
5. Musteri ekle ve mesaj gonder

## 5) Lokal test (opsiyonel)

1. `scripts/whatsapp-business.env.example` dosyasini `.env` olarak kopyala.
2. Degiskenleri doldur.
3. Calistir:
   - `npm run wa:gateway`
4. Test:
   - `http://127.0.0.1:3939/health`

## Notlar

- Web panel token saklamaz, token sadece gatewayde kalir.
- `WA_ALLOWED_ORIGIN` degeri site domainin olmali.
- Meta template gonderimi icin template onayi zorunludur.
