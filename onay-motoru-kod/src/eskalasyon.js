"use strict";

const { yoneticisiniBul } = require("./orgYardimci");

/**
 * R4 — Eskalasyon (bonus/tamamlayıcı modül).
 *
 * onayMotoru.js'deki `onayZinciriOlustur`, tek bir referans tarihte
 * ("gönderim anı") sabit bir zincir hesaplar — bu, case'in 5-C
 * bölümünün istediği çekirdek çıktıdır. Eskalasyon ise doğası gereği
 * ZAMANLA ilerleyen bir durumdur (bir adımın ne zaman "bekliyor"
 * durumuna geçtiğini ve "bugün"ün ne olduğunu bilmek gerekir) — bu
 * modül o dinamiği ayrı, saf fonksiyonlarla modelleyip motorun
 * kendisini "hangi gün olduğunu bilen" bir şeye dönüştürmeden R4'ü
 * test edilebilir kılar (bkz. tasarım dokümanı §4: motor bir
 * zamanlayıcı/cron altyapısı içermez, sadece "3 iş günü geçti mi"
 * sorusuna cevap verir).
 */

const HAFTA_SONU_GUNLERI = new Set([0, 6]); // Pazar=0, Cumartesi=6 (UTC)

function isGunuMu(tarihStr) {
  const gun = new Date(`${tarihStr}T00:00:00Z`).getUTCDay();
  return !HAFTA_SONU_GUNLERI.has(gun);
}

/**
 * `baslangic` (hariç) ile `bitis` (dahil) arasında kaç iş günü
 * geçtiğini sayar. Resmi tatil takvimi kapsam dışıdır (bkz. Kararlar
 * ve Varsayımlar tablosu / tasarım dokümanının kapsam sınırı notları).
 */
function gecenIsGunuSayisi(baslangicStr, bitisStr) {
  let sayac = 0;
  const gun = new Date(`${baslangicStr}T00:00:00Z`);
  const bitis = new Date(`${bitisStr}T00:00:00Z`);

  while (gun < bitis) {
    gun.setUTCDate(gun.getUTCDate() + 1);
    const gunStr = gun.toISOString().slice(0, 10);
    if (isGunuMu(gunStr)) sayac++;
  }
  return sayac;
}

const ESKALASYON_ESIGI_IS_GUNU = 3;

/**
 * Bir adımın, verilen "kontrol tarihi" itibarıyla eskale edilip
 * edilmeyeceğini belirler.
 *
 * Kararlar tablosu kararları:
 *  - Eskalasyon orijinal onaycıyı DEĞİŞTİRİR (paralel eklemez).
 *  - Eskalasyon zinciri, mevcut atanan kişinin kendi yöneticisine gider.
 *  - Zincirin tepesi (yöneticisi olmayan / CEO) 3 iş günü daha cevap
 *    vermezse talep otomatik REDDEDİLİR.
 *
 * @param {object} adim { atanan_kisi_id, adim_baslangic_tarihi }
 * @param {string} kontrolTarihi 'YYYY-MM-DD' — "bugün" (dışarıdan verilir).
 * @param {object} veri
 * @returns {{ durum: 'Bekliyor'|'EskaleEdildi'|'OtomatikReddedildi',
 *             gecenIsGunu: number, yeniAtananKisiId: string|null }}
 */
function adimDurumunuDegerlendir(adim, kontrolTarihi, veri) {
  const gecen = gecenIsGunuSayisi(adim.adim_baslangic_tarihi, kontrolTarihi);

  if (gecen <= ESKALASYON_ESIGI_IS_GUNU) {
    return { durum: "Bekliyor", gecenIsGunu: gecen, yeniAtananKisiId: adim.atanan_kisi_id };
  }

  const ustYonetici = yoneticisiniBul(adim.atanan_kisi_id, kontrolTarihi, veri);
  if (ustYonetici === null) {
    // Zincirin tepesi (CEO) de eşiği aştı → otomatik red.
    return { durum: "OtomatikReddedildi", gecenIsGunu: gecen, yeniAtananKisiId: null };
  }

  return { durum: "EskaleEdildi", gecenIsGunu: gecen, yeniAtananKisiId: ustYonetici };
}

module.exports = { isGunuMu, gecenIsGunuSayisi, adimDurumunuDegerlendir, ESKALASYON_ESIGI_IS_GUNU };
