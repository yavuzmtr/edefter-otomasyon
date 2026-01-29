# Tam Otomatik Pazarlama Botu

Bu modül `E-Defter Otomasyon Sistemi` için otomatik pazarlama akışlarını yönetir. GPT destekli içerik üretiminden çıkış, sosyal medya, blog, e-posta ve chatbot kanalına gönderime kadar komple bir pipeline sunar.

## Özellikler

- **İçerik motoru**: Günlük, haftalık tema bazlı metin, başlık ve CTA oluşturur.
- **Şablon adaptörleri**: Instagram, LinkedIn, WordPress blog, Mailchimp e-posta, chatbot bildirimleri için aynı içeriği yeniden kullanır.
- **Zamanlayıcı**: Cron tabanlı job'lar 08:30 ve 18:00 paylaşımları; yeni release tetiklemeleri.
- **Analytics feedback**: Gönderim sonrası basit metric hesaplayarak düşük performanslı içeriği yeniden üretir.
- **Lead capture**: Chatbot veya e-posta ile gelen takip taleplerini loglar.

## Kurulum

```bash
cd marketing-automation
npm install
npm run start
```

`start` komutu cron tabanlı işleyişi başlatır. Loglar `logs/marketing.log` içine yazılır.

## Yapı

```
marketing-automation/
├── src/
│   ├── bot.ts           # Orkestrasyon
│   ├── scheduler.ts     # Cron + görev zinciri
│   ├── services/
│   │   ├── contentGenerator.ts
│   │   ├── analytics.ts
│   │   ├── leadService.ts
│   │   ├── channels/     # Platform adaptörleri
│   │   └── notifications.ts
│   └── config/index.ts  # Çevresel ayarlar
├── tests/               # Basit kurulum testleri
├── package.json
└── tsconfig.json
```

## İlerleme
- Her paylaşım sonrası Slack/webhook ile sonuç raporlanır.
- Düşük performans algılanırsa içerik istenir ve yeniden yayınlanır.
- Yeni demo sürümü yayınlandığında otomatik hatırlatma tetiklenir.

İstersen sırayla modülleri yazabilirim; önce içerik üretici + scheduler, sonra kanal adaptörleri ve analytics.<br>
Hazır olduğunda senkron adımları teker teker paylaşırım.
