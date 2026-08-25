# Onay Akışı Motoru — Case Study Teslimi

Satın alma talebi onay süreci için konfigüre edilebilir bir onay motoru
case study'sinin teslimidir.

| Teslimat | Konum |
|---|---|
| Case dokümanı (orijinal) | [`Study-Case-Onay-Akisi-Motoru.docx`](Study-Case-Onay-Akisi-Motoru.docx) |
| A. Tasarım dokümanı | [`tasarim-dokumani_1.docx`](tasarim-dokumani_1.docx) |
| B. Kararlar ve Varsayımlar tablosu | [`Kararlar ve Varsayımlar Tablosu.docx`](Kararlar%20ve%20Varsayımlar%20Tablosu.docx) |
| C. Kod — çekirdek + testler | [`onay-motoru-kod/`](onay-motoru-kod/) (aşağıda) |
| AI kullanımı açıklaması | [`AI Kullanımı.docx`](AI%20Kullanımı.docx) |

---

## Kod — çalıştırma

Satın alma talebi onay zincirini hesaplayan çekirdek motor (case study, Bölüm 5-C).
Bağımlılık yok — yalnızca Node.js 18+ (built-in `node:test` kullanılıyor).

```bash
cd onay-motoru-kod
npm start        # 6 senaryoyu terminale yazdırır
npm test         # tüm testleri çalıştırır (16 assertion, 6 senaryo)
```
