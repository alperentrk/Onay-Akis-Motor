# Onay Akışı Motoru — Kod

Satın alma talebi onay zincirini hesaplayan çekirdek motor (case study, Bölüm 5-C).
Bağımlılık yok — yalnızca Node.js 18+ (built-in `node:test` kullanılıyor).

## Çalıştırma

```bash
npm start        # 6 senaryoyu terminale yazdırır
npm test         # tüm testleri çalıştırır (16 assertion, 6 senaryo)
```

## Yapı

```
src/
  veri.js           referans veri (organizasyon, izin, kural setleri — case §3)
  orgYardimci.js     yönetici/masraf merkezi sahibi/izin zinciri çözümü
  kuralYardimci.js   aktif kural seti seçimi + tutar/kategoriye göre rol listesi
  onayMotoru.js      ÇEKİRDEK: onayZinciriOlustur(talep, veri)
  eskalasyon.js      R4 iş günü / eskalasyon hesaplama (tamamlayıcı modül)
  index.js           public API
cli.js               terminal çıktısı (6 senaryo)
test/senaryolar.test.js
sql/
  schema.sql         MSSQL DDL (tasarım dokümanı §1 veri modeli)
  seed.sql           case verisiyle birebir örnek INSERT'ler
```

## Tasarım kararları

Bu kod, ayrı teslim edilen **Tasarım Dokümanı** ve **Kararlar ve Varsayımlar
Tablosu**'ndaki kararların doğrudan uygulamasıdır — gerekçeler burada tekrar
edilmez. Özet:

- **Deterministik çekirdek**: `onayZinciriOlustur(talep, veri)` hiçbir yan
  etkiye (saat, veritabanı) bakmaz; tüm zaman bilgisi `talep.gonderim_tarihi`
  üzerinden gelir (R3 — kural seti ve org referans tarihi gönderim anında
  kilitlenir).
- **R6 — çoklu rol**: aynı kişi zincirde birden fazla adımda çıkabilir,
  adımlar asla birleştirilmez.
- **R7 — kendi talebini onaylayamama**: atanan kişi talep sahibiyse, o adım
  kişinin kendi yöneticisine devredilir (`RolCakismasiVekalet`).
- **R5 — izin/vekalet**: atanan kişi (devredilmiş olsa bile) izinliyse,
  vekiline zincirleme olarak devredilir (vekilin de izinli olma ihtimaline
  karşı — bkz. Senaryo 5).
- **R8 — yeniden gönderim**: motor seviyesinde herhangi bir özel işlem
  yoktur; reddedilen bir talebin düzenlenmesi basitçe yeni bir `talep`
  nesnesiyle motoru tekrar çağırmaktır (bağımsız yeni talep — R3 devre dışı).
- **Eskalasyon (R4)** ayrı bir modülde (`eskalasyon.js`) tutulur çünkü
  zamana bağlıdır (bir "kontrol tarihi" ister); çekirdek zincir hesaplama
  fonksiyonunu zaman bilgisine bağımlı hâle getirmez.
