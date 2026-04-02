# Online Lisans Akisi (Ucretsiz)

Bu dokuman, lisanslari sen bilgisayarda degilken otomatik uretip e-posta ile gonderen ucretsiz yapinin kurulumunu anlatir.

## 1) GitHub Secrets (zorunlu)

Repo > Settings > Secrets and variables > Actions > New repository secret:

- `BREVO_SMTP_USER` = Brevo SMTP login (ornegin: a6b41e001@smtp-brevo.com)
- `BREVO_SMTP_KEY` = Brevo SMTP key
- `BREVO_FROM` = Gonderen adres (ornek: satis@edefterotomasyon.com.tr)
- `LICENSE_PRIVATE_KEY_PEM` = Lisans private key PEM icerigi

Not: Private key'i `.license-keys/license-private.pem` dosyasindan alabilirsin.

## 2) Web Formu (Satin Alma Talebi)

Musteri web formunu doldurur. Ilk otomatik e-posta odeme adimini ister.

Form: `https://edefterotomasyon.com.tr/purchase-form.html`

Bu form talebi mail olarak iletir, odeme onayi sonrasi full kurulum linki ve cihaz kimligi adimi baslatilir.

## 3) Lisans Talebi (Issue) Akisi

Lisans talebi icin GitHub'da "Lisans Talebi" issue formu vardir.

Akis:
1. Müşteri form doldurur.
2. GitHub'da `license-request` etiketli issue olusur.
3. Odeme alinca issue'ya `approve` etiketi eklenir.
4. GitHub Action otomatik calisir, lisansi uretir ve mail atar.
5. Issue'ya "Lisans gonderildi" yorumu dusulur.

## 4) Google Forms -> GitHub Issue (Ucretsiz)

Google Forms yanitlarini GitHub Issue acmaya baglamak icin Apps Script kullanabilirsin.

Ornek Apps Script (Google Forms > Extensions > Apps Script):

```
function onFormSubmit(e) {
  var data = e.namedValues;
  var company = data["Musteri / Firma"][0];
  var email = data["Musteri E-posta"][0];
  var hardware = data["Cihaz Kimligi"][0];
  var expires = data["Bitis Tarihi (opsiyonel)"][0] || "";
  var key = data["Lisans Kodu (opsiyonel)"][0] || "";

  var body = "### Musteri / Firma\n" + company + "\n\n" +
             "### Musteri E-posta\n" + email + "\n\n" +
             "### Cihaz Kimligi\n" + hardware + "\n\n" +
             "### Bitis Tarihi\n" + expires + "\n\n" +
             "### Lisans Kodu\n" + key + "\n";

  var payload = {
    title: "Lisans Talebi - " + company,
    body: body,
    labels: ["license-request"]
  };

  var token = "GITHUB_TOKENIN"; // GitHub Personal Access Token (repo issue yetkisi)
  var url = "https://api.github.com/repos/yavuzmtr/edefter-otomasyon/issues";
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { "Authorization": "token " + token }
  };
  UrlFetchApp.fetch(url, options);
}
```

Not: Apps Script icin GitHub token'ini guvenli sakla.

## 5) Test

1. Issue ac.
2. Issue'ya `approve` etiketi koy.
3. Actions > "License Approval" icinde islem tamamlandigini kontrol et.
4. Müşteriye mail gonderildigini dogrula.

## 6) Tam Satis Senaryosu (Adim Adim)

Bu bolum, sahadaki gercek akisi tek sayfada ozetler.

1. Musteri web sitesinden "Satin Alma Talebi" formunu doldurur.
2. Sistem, musterinin e-postasina otomatik "Talebiniz alindi + odeme bilgileri" maili gonderir.
3. Musteri IBAN uzerinden odeme yapar, aciklamaya firma adini yazar.
4. Sen odemeyi gorunce GitHub'daki ilgili issue'ya `approve` etiketi eklersin.
5. GitHub Action otomatik calisir, lisans dosyasini uretir ve musterinin e-postasina gonderir.
6. Musteri lisans dosyasini `%APPDATA%\\edefter-automation` dizinine kopyalar.
7. Musteri programi kapatip yeniden acarak aktivasyonu tamamlar.
8. Gerekirse destek verilir; aksi halde sistem aktif kullanima baslar.
