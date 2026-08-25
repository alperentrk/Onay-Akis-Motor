"use strict";

/**
 * Statik referans veri.
 *
 * Bu dosya, case dokümanındaki "3. Veri" bölümündeki organizasyon şemasını,
 * masraf merkezi sahiplerini, izin/vekalet kayıtlarını ve v1/v2 kural
 * setlerini birebir temsil eder. Gerçek bir sistemde bu veri MSSQL
 * tablolarından (bkz. sql/schema.sql) gelir; motor bu iç yapıya bağımlı
 * değildir (bkz. tasarım dokümanı §4 "Motorun Sorumluluk Sınırı").
 *
 * Tarihler her yerde 'YYYY-MM-DD' string formatında tutulur; bu format
 * lexicographic (sözlük) sırayla kronolojik sırayla aynı olduğu için
 * karşılaştırmalar doğrudan string operatörleriyle (<=, >=) yapılabilir,
 * saat dilimi belirsizliği doğurmaz.
 */

const kisiler = [
  { id: "ayse", isim: "Ayşe", unvan: "Uzman", departman: "IT" },
  { id: "burak", isim: "Burak", unvan: "Müdür", departman: "IT" },
  { id: "deniz", isim: "Deniz", unvan: "Direktör", departman: "Teknoloji" },
  { id: "can", isim: "Can", unvan: "Uzman", departman: "Finans" },
  { id: "fatma", isim: "Fatma", unvan: "Müdür", departman: "Finans" },
  { id: "elif", isim: "Elif", unvan: "CEO", departman: null },
];

/**
 * OrganizasyonKaydi — tarih aralıklı (versiyonlu), R9/R3 çatışmasının
 * çözümü. `bitis: null` = hâlâ geçerli (açık uçlu).
 *
 * NOT (Senaryo 6 için kasıtlı kurgu): case metni Deniz'in yöneticisinin
 * "yanlış girildiğini" söylüyor ama hangi değerin yanlış olduğunu
 * belirtmiyor. R9'u somut ve test edilebilir kılmak için burada Deniz'in
 * yönetici kaydını bilerek iki parçaya böldüm: 19 Mart'a kadar (dahil)
 * hatalı/eksik (yonetici_id: null), 20 Mart'tan itibaren düzeltilmiş
 * (yonetici_id: 'elif'). Bu kurgu yalnızca Deniz'in KENDİ yöneticisi
 * sorgulandığında devreye giriyor — diğer 5 senaryoda hiçbir talep bu
 * alanı sorgulamadığı için onları etkilemiyor.
 */
const organizasyonKayitlari = [
  { kisi_id: "ayse", yonetici_id: "burak", gecerlilik_baslangic: "2026-01-01", gecerlilik_bitis: null },
  { kisi_id: "burak", yonetici_id: "deniz", gecerlilik_baslangic: "2026-01-01", gecerlilik_bitis: null },
  { kisi_id: "fatma", yonetici_id: "elif", gecerlilik_baslangic: "2026-01-01", gecerlilik_bitis: null },
  { kisi_id: "can", yonetici_id: "fatma", gecerlilik_baslangic: "2026-01-01", gecerlilik_bitis: null },
  { kisi_id: "deniz", yonetici_id: null, gecerlilik_baslangic: "2026-01-01", gecerlilik_bitis: "2026-03-19" },
  { kisi_id: "deniz", yonetici_id: "elif", gecerlilik_baslangic: "2026-03-20", gecerlilik_bitis: null },
];

const masrafMerkeziSahipleri = [
  { masraf_merkezi: "IT-OPS", kisi_id: "burak" },
  { masraf_merkezi: "PROJE-X", kisi_id: "deniz" },
];

/** Sabit roller — organizasyon içinde tekil kişiye eşlenen roller. */
const sabitRoller = {
  FinansMüdürü: "fatma",
  TeknolojiDirektörü: "deniz",
  CEO: "elif",
};

const izinKayitlari = [
  { kisi_id: "burak", baslangic: "2026-03-10", bitis: "2026-03-20", vekil_kisi_id: "deniz" },
  { kisi_id: "deniz", baslangic: "2026-03-15", bitis: "2026-03-25", vekil_kisi_id: "fatma" },
];

/**
 * KuralSeti + KuralSatiri.
 *
 * `esikler: [b1, b2]` sınır kuralı (Kararlar tablosu — "Sınır Değeri
 * Belirsizlikleri"): tutar < b1 → 1. bant; b1 <= tutar <= b2 → 2. bant
 * (her iki sınır da bu bantta); tutar > b2 → 3. bant.
 *
 * `kategoriKurallari`, tutardan bağımsız olarak zincire zorunlu bir rol
 * ekler (rol zaten zincirde varsa tekrar eklenmez).
 */
const kuralSetleri = [
  {
    id: "v1",
    versiyon_adi: "v1",
    gecerlilik_baslangic: "2026-01-01",
    gecerlilik_bitis: "2026-03-14",
    esikler: [10000, 100000],
    bantlar: [
      ["Yönetici"],
      ["Yönetici", "MasrafMerkeziSahibi", "FinansMüdürü"],
      ["Yönetici", "MasrafMerkeziSahibi", "FinansMüdürü", "CEO"],
    ],
    kategoriKurallari: [{ kategori: "Danışmanlık", zorunluRol: "FinansMüdürü" }],
  },
  {
    id: "v2",
    versiyon_adi: "v2",
    gecerlilik_baslangic: "2026-03-15",
    gecerlilik_bitis: null,
    esikler: [15000, 150000],
    bantlar: [
      ["Yönetici"],
      ["Yönetici", "MasrafMerkeziSahibi", "FinansMüdürü"],
      ["Yönetici", "MasrafMerkeziSahibi", "FinansMüdürü", "CEO"],
    ],
    kategoriKurallari: [
      { kategori: "Danışmanlık", zorunluRol: "FinansMüdürü" },
      { kategori: "Yazılım Lisansı", zorunluRol: "TeknolojiDirektörü" },
    ],
  },
];

module.exports = {
  kisiler,
  organizasyonKayitlari,
  masrafMerkeziSahipleri,
  sabitRoller,
  izinKayitlari,
  kuralSetleri,
};
