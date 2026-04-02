# Purchase Mailer (Cloudflare Worker)

Bu worker, satin alma formu gonderildiginde:
- Musteriye otomatik odeme maili gonderir.
- Sana bildirim maili gonderir.
- Ardindan tesekkur sayfasina yonlendirir.

## 1) Worker olustur

Cloudflare Dashboard > Workers & Pages > Create Worker
Isim onerisi: `purchase-mailer`

## 2) Kodu ekle

`workers/purchase-mailer.js` icerigini Worker editore yapistir.

## 3) Secrets / Vars

Worker > Settings > Variables

Required secrets:
- `BREVO_API_KEY` (Brevo API key)

Required vars:
- `FROM_EMAIL` = `satis@edefterotomasyon.com.tr`
- `ADMIN_EMAIL` = `yavuzmercimek@gmail.com`

Optional vars:
- `FROM_NAME` = `E-Defter Otomasyon`
- `ADMIN_NAME` = `E-Defter Otomasyon`
- `THANK_YOU_URL` = `https://edefterotomasyon.com.tr/purchase-thanks.html`
- `PAYMENT_NAME` = `Yavuz Mercimek`
- `PAYMENT_IBAN` = `TR95 0020 5000 0101 8288 4000 08`

## 4) Form action guncelle

`website/purchase-form.html` icinde form action:

```
https://purchase-mailer.edefterotomasyon.workers.dev/submit
```

Worker URL farkliysa bu linki yeni URL ile degistir.

## 5) Test

1. Formu doldur, gonder.
2. Musteriye odeme maili gitmeli.
3. Sana bildirim maili gelmeli.
4. Tesekkur sayfasina yonlenmeli.
