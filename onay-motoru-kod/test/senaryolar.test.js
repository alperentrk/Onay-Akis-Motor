"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const veri = require("../src/veri");
const { onayZinciriOlustur } = require("../src/onayMotoru");
const { gecenIsGunuSayisi, adimDurumunuDegerlendir } = require("../src/eskalasyon");

/** Test okunabilirliği için: zinciri [ [rol, kisi, neden], ... ] biçimine indirger. */
function ozet(sonuc) {
  return sonuc.adimlar.map((a) => [a.rol, a.atanan_kisi_id, a.atama_nedeni]);
}

describe("Senaryo 1 — Ayşe, 8.000 TL, Kırtasiye, 5 Mart", () => {
  const talep = {
    id: "T1",
    talep_sahibi_id: "ayse",
    tutar: 8000,
    kategori: "Kırtasiye",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-05",
  };

  test("v1 kural seti uygulanır (5 Mart < 15 Mart)", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.equal(sonuc.kural_seti_id, "v1");
  });

  test("tutar 10.000 altında → tek adım: talep sahibinin yöneticisi (Burak)", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.deepEqual(ozet(sonuc), [["Yönetici", "burak", "Normal"]]);
  });
});

describe("Senaryo 2 — Ayşe, 45.000 TL, IT-OPS, 12 Mart", () => {
  const talep = {
    id: "T2",
    talep_sahibi_id: "ayse",
    tutar: 45000,
    kategori: "Donanım",
    masraf_merkezi: "IT-OPS",
    gonderim_tarihi: "2026-03-12",
  };

  test("Burak izinli (10-20 Mart) → hem Yönetici hem MasrafMerkeziSahibi rolü Deniz'e (vekil) düşer", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.deepEqual(ozet(sonuc), [
      ["Yönetici", "deniz", "IzinKaynakliVekalet"],
      ["MasrafMerkeziSahibi", "deniz", "IzinKaynakliVekalet"],
      ["FinansMüdürü", "fatma", "Normal"],
    ]);
  });

  test("Deniz henüz izinli değil (kendi izni 15 Mart'ta başlıyor) → zincir onda durur, Fatma'ya gitmez", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.equal(sonuc.adimlar[0].atanan_kisi_id, "deniz");
  });
});

describe("Senaryo 3 — Burak, 60.000 TL, IT-OPS, 12 Mart (rol çakışması)", () => {
  const talep = {
    id: "T3",
    talep_sahibi_id: "burak",
    tutar: 60000,
    kategori: "Donanım",
    masraf_merkezi: "IT-OPS",
    gonderim_tarihi: "2026-03-12",
  };

  test("Deniz zincirde iki kez çıkar: normal Yönetici + R7 devri MasrafMerkeziSahibi", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.deepEqual(ozet(sonuc), [
      ["Yönetici", "deniz", "Normal"],
      ["MasrafMerkeziSahibi", "deniz", "RolCakismasiVekalet"],
      ["FinansMüdürü", "fatma", "Normal"],
    ]);
  });

  test("R6: aynı kişi (Deniz) için iki ayrı adım üretilir, birleştirilmez", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    const denizAdimlari = sonuc.adimlar.filter((a) => a.atanan_kisi_id === "deniz");
    assert.equal(denizAdimlari.length, 2);
  });
});

describe("Senaryo 4 — Can, 120.000 TL, Danışmanlık, 13 Mart (18 Mart'ta hâlâ akışta)", () => {
  const talep = {
    id: "T4",
    talep_sahibi_id: "can",
    tutar: 120000,
    kategori: "Danışmanlık",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-13",
  };

  test("masraf merkezi atanmamış → MasrafMerkeziSahibi adımı zincire hiç dahil edilmez", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.ok(!sonuc.adimlar.some((a) => a.rol === "MasrafMerkeziSahibi"));
    assert.ok(sonuc.genelNotlar.length > 0);
  });

  test("tutar > 100.000 (v1) → CEO zincire dahil; Danışmanlık zaten FinansMüdürü'nü gerektiriyor", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.deepEqual(ozet(sonuc), [
      ["Yönetici", "fatma", "Normal"],
      ["FinansMüdürü", "fatma", "Normal"],
      ["CEO", "elif", "Normal"],
    ]);
  });

  test("R3: 18 Mart'ta 'bugün' olsa v2 aktif olurdu, ama talep hâlâ v1'e kilitli kalır", () => {
    const sonuc = onayZinciriOlustur(talep, veri);
    assert.equal(sonuc.kural_seti_id, "v1");
  });

  test("R4 sınırı: 13→18 Mart arası tam 3 iş günü geçmiştir, henüz eşiği AŞMAMIŞTIR (hâlâ Bekliyor)", () => {
    // 13 Mart 2026 Cuma. 14-15 hafta sonu. 16,17,18 = 3 iş günü.
    const gecen = gecenIsGunuSayisi("2026-03-13", "2026-03-18");
    assert.equal(gecen, 3);

    const durum = adimDurumunuDegerlendir(
      { atanan_kisi_id: "fatma", adim_baslangic_tarihi: "2026-03-13" },
      "2026-03-18",
      veri
    );
    assert.equal(durum.durum, "Bekliyor");
  });

  test("R4: bir iş günü daha geçerse (19 Mart) eşik aşılır, eskalasyon tetiklenir (Fatma'nın yöneticisi Elif'e)", () => {
    const durum = adimDurumunuDegerlendir(
      { atanan_kisi_id: "fatma", adim_baslangic_tarihi: "2026-03-13" },
      "2026-03-19",
      veri
    );
    assert.equal(durum.durum, "EskaleEdildi");
    assert.equal(durum.yeniAtananKisiId, "elif");
  });
});

describe("Senaryo 5 — Ayşe, 14.000 TL, Yazılım Lisansı: 13 Mart gönderildi, 14 Mart reddedildi, 16 Mart yeniden gönderildi", () => {
  const orijinal = {
    id: "T5-orig",
    talep_sahibi_id: "ayse",
    tutar: 14000,
    kategori: "Yazılım Lisansı",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-13",
  };
  const yeniden = {
    id: "T5-yeni",
    orijinal_talep_id: "T5-orig",
    talep_sahibi_id: "ayse",
    tutar: 14000,
    kategori: "Yazılım Lisansı",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-16",
  };

  test("R8/R3: orijinal talep v1'e, yeniden gönderim v2'ye bağlanır (bağımsız yeni talep)", () => {
    const sonucOrijinal = onayZinciriOlustur(orijinal, veri);
    const sonucYeni = onayZinciriOlustur(yeniden, veri);
    assert.equal(sonucOrijinal.kural_seti_id, "v1");
    assert.equal(sonucYeni.kural_seti_id, "v2");
  });

  test("v2 + Yazılım Lisansı → TeknolojiDirektörü zincire zorunlu eklenir", () => {
    const sonuc = onayZinciriOlustur(yeniden, veri);
    assert.ok(sonuc.adimlar.some((a) => a.rol === "TeknolojiDirektörü"));
  });

  test("çift izin çakışması (Burak 10-20, Deniz 15-25) → her iki rol de zincirleme olarak Fatma'ya düşer", () => {
    const sonuc = onayZinciriOlustur(yeniden, veri);
    assert.deepEqual(ozet(sonuc), [
      ["Yönetici", "fatma", "IzinKaynakliVekalet"],
      ["TeknolojiDirektörü", "fatma", "IzinKaynakliVekalet"],
    ]);
  });
});

describe("Senaryo 6 — Deniz'in yöneticisi 20 Mart'ta düzeltiliyor (R9 vs R3)", () => {
  const eskiKayitla = {
    id: "T6-eski",
    talep_sahibi_id: "deniz",
    tutar: 5000,
    kategori: "Ofis Malzemesi",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-18", // düzeltmeden (20 Mart) önce kilitlenir
  };
  const yeniKayitla = {
    id: "T6-yeni",
    talep_sahibi_id: "deniz",
    tutar: 5000,
    kategori: "Ofis Malzemesi",
    masraf_merkezi: null,
    gonderim_tarihi: "2026-03-21", // düzeltmeden sonra
  };

  test("R3: 18 Mart'ta kilitlenen talep, 20 Mart'taki İK düzeltmesinden ETKİLENMEZ — yönetici bulunamaz", () => {
    const sonuc = onayZinciriOlustur(eskiKayitla, veri);
    assert.equal(sonuc.adimlar[0].atanan_kisi_id, null);
    assert.ok(sonuc.adimlar[0].notlar.length > 0);
  });

  test("R9: düzeltmeden SONRA gönderilen yeni bir talep doğru yöneticiyi (Elif) bulur", () => {
    const sonuc = onayZinciriOlustur(yeniKayitla, veri);
    assert.deepEqual(ozet(sonuc), [["Yönetici", "elif", "Normal"]]);
  });
});
