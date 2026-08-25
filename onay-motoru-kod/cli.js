#!/usr/bin/env node
"use strict";

const { veri, onayZinciriOlustur } = require("./src/index");

const isimSoz = Object.fromEntries(veri.kisiler.map((k) => [k.id, k.isim]));
const isim = (id) => (id === null ? "— (bulunamadı)" : isimSoz[id] ?? id);

function zinciriYazdir(baslik, talep) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(baslik);
  console.log("=".repeat(70));
  console.log(
    `Talep: ${isim(talep.talep_sahibi_id)} · ${talep.tutar.toLocaleString("tr-TR")} TL · ${talep.kategori}` +
      (talep.masraf_merkezi ? ` · ${talep.masraf_merkezi}` : "") +
      ` · gönderim: ${talep.gonderim_tarihi}`
  );

  let sonuc;
  try {
    sonuc = onayZinciriOlustur(talep, veri);
  } catch (err) {
    console.log(`  HATA: ${err.message}`);
    return;
  }

  console.log(`Uygulanan kural seti: ${sonuc.kural_seti_id} (org referans tarihi: ${sonuc.org_referans_tarihi})`);
  if (sonuc.genelNotlar.length) {
    sonuc.genelNotlar.forEach((n) => console.log(`  [not] ${n}`));
  }
  console.log("Onay zinciri:");
  sonuc.adimlar.forEach((adim) => {
    console.log(`  ${adim.sira_no}. ${adim.rol.padEnd(20)} → ${isim(adim.atanan_kisi_id).padEnd(8)} [${adim.atama_nedeni}]`);
    adim.notlar.forEach((n) => console.log(`       - ${n}`));
  });
}

console.log("ONAY AKIŞI MOTORU — 6 senaryo çalıştırılıyor\n(kaynak: Study-Case-Onay-Akisi-Motoru.docx §4)");

// Senaryo 1
zinciriYazdir("Senaryo 1 — Ayşe, 8.000 TL, Kırtasiye, 5 Mart", {
  id: "T1",
  talep_sahibi_id: "ayse",
  tutar: 8000,
  kategori: "Kırtasiye",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-05",
});

// Senaryo 2
zinciriYazdir("Senaryo 2 — Ayşe, 45.000 TL, IT-OPS, 12 Mart", {
  id: "T2",
  talep_sahibi_id: "ayse",
  tutar: 45000,
  kategori: "Donanım",
  masraf_merkezi: "IT-OPS",
  gonderim_tarihi: "2026-03-12",
});

// Senaryo 3
zinciriYazdir("Senaryo 3 — Burak, 60.000 TL, IT-OPS, 12 Mart", {
  id: "T3",
  talep_sahibi_id: "burak",
  tutar: 60000,
  kategori: "Donanım",
  masraf_merkezi: "IT-OPS",
  gonderim_tarihi: "2026-03-12",
});

// Senaryo 4
zinciriYazdir("Senaryo 4 — Can, 120.000 TL, Danışmanlık, 13 Mart'ta gönderildi (18 Mart'ta hâlâ akışta)", {
  id: "T4",
  talep_sahibi_id: "can",
  tutar: 120000,
  kategori: "Danışmanlık",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-13",
});

// Senaryo 5 — orijinal + yeniden gönderim
zinciriYazdir("Senaryo 5a — Ayşe, 14.000 TL, Yazılım Lisansı, 13 Mart (orijinal, sonra reddedildi)", {
  id: "T5-orig",
  talep_sahibi_id: "ayse",
  tutar: 14000,
  kategori: "Yazılım Lisansı",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-13",
});
zinciriYazdir("Senaryo 5b — aynı talep, 16 Mart'ta yeniden gönderildi (R8: bağımsız yeni talep)", {
  id: "T5-yeni",
  orijinal_talep_id: "T5-orig",
  talep_sahibi_id: "ayse",
  tutar: 14000,
  kategori: "Yazılım Lisansı",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-16",
});

// Senaryo 6 — R9 vs R3
zinciriYazdir("Senaryo 6a — Deniz, 5.000 TL, Ofis Malzemesi, 18 Mart'ta gönderildi (İK düzeltmesinden ÖNCE kilitlendi)", {
  id: "T6-eski",
  talep_sahibi_id: "deniz",
  tutar: 5000,
  kategori: "Ofis Malzemesi",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-18",
});
zinciriYazdir("Senaryo 6b — aynı içerikte, düzeltmeden SONRA (21 Mart) gönderilen yeni bir talep", {
  id: "T6-yeni",
  talep_sahibi_id: "deniz",
  tutar: 5000,
  kategori: "Ofis Malzemesi",
  masraf_merkezi: null,
  gonderim_tarihi: "2026-03-21",
});

console.log(`\n${"=".repeat(70)}`);
console.log("Detaylı gerekçeler için Kararlar ve Varsayımlar Tablosu'na bakınız.");
