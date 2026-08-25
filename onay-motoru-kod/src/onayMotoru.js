"use strict";

const { aktifKuralSetiniBul, temelRolListesiniOlustur } = require("./kuralYardimci");
const {
  yoneticisiniBul,
  masrafMerkeziSahibiniBul,
  sabitRolSahibiniBul,
  izinZinciriniCoz,
} = require("./orgYardimci");

/**
 * Rolü, verilen referans tarihinde kişiye çözer (henüz R6/R7/R5
 * uygulanmamış "ham" atama).
 */
function rolSahibiniBul(rol, talep, referansTarih, veri) {
  switch (rol) {
    case "Yönetici":
      return yoneticisiniBul(talep.talep_sahibi_id, referansTarih, veri);
    case "MasrafMerkeziSahibi":
      return masrafMerkeziSahibiniBul(talep.masraf_merkezi, veri);
    default:
      return sabitRolSahibiniBul(rol, veri);
  }
}

/**
 * ÇEKİRDEK FONKSİYON — bir talep için onay zincirini hesaplar.
 *
 * Girdi: talep + kural seti + organizasyon + izin takvimi (case §5-C).
 * Çıktı: sıralı onay adımları (kim, hangi sırada, hangi gerekçeyle).
 *
 * Deterministik: aynı `talep` ve aynı `veri` her zaman aynı çıktıyı
 * verir — motor `Date.now()` gibi hiçbir yan etkiye bakmaz, tüm zaman
 * bilgisi `talep.gonderim_tarihi` üzerinden gelir.
 *
 * Uygulanan kurallar ve sıra:
 *   1. R3   — kural seti VE org referans tarihi, gönderim anına kilitlenir.
 *   2. R1   — tutar/kategori/masraf merkezine göre temel rol listesi.
 *   3. Rol → kişi çözümü (Yönetici/MasrafMerkeziSahibi hesaplanır,
 *             FinansMüdürü/TeknolojiDirektörü/CEO sabit).
 *   4. R7   — atanan kişi talep sahibiyse, kendi yöneticisine devredilir
 *             (rol çakışması vekaleti).
 *   5. R5   — atanan kişi (devredilmiş olsa bile) izinliyse vekiline
 *             zincirleme olarak devredilir.
 *   6. R6   — aynı kişi zincirde birden fazla adımda çıkabilir, adımlar
 *             asla birleştirilmez (her adım ayrı bir onaydır).
 *
 * @param {object} talep { id, talep_sahibi_id, tutar, kategori,
 *        masraf_merkezi, gonderim_tarihi (YYYY-MM-DD), orijinal_talep_id? }
 * @param {object} veri  src/veri.js şemasına uygun referans veri.
 * @returns {{
 *   talep_id: string,
 *   kural_seti_id: string,
 *   org_referans_tarihi: string,
 *   adimlar: Array<{ sira_no: number, rol: string, atanan_kisi_id: string|null,
 *                     atama_nedeni: 'Normal'|'RolCakismasiVekalet'|'IzinKaynakliVekalet',
 *                     notlar: string[] }>,
 *   genelNotlar: string[]
 * }}
 */
function onayZinciriOlustur(talep, veri) {
  if (!talep.gonderim_tarihi) {
    throw new Error("Talep henüz gönderilmemiş (Taslak durumunda); onay zinciri hesaplanamaz.");
  }

  // 1. R3 — kilitleme
  const kuralSeti = aktifKuralSetiniBul(talep.gonderim_tarihi, veri.kuralSetleri);
  if (!kuralSeti) {
    throw new Error(`${talep.gonderim_tarihi} tarihinde aktif bir kural seti bulunamadı.`);
  }
  const orgReferansTarihi = talep.gonderim_tarihi;

  // 2. Temel rol listesi
  const { roller, notlar: genelNotlar } = temelRolListesiniOlustur(talep, kuralSeti);

  const adimlar = [];
  let sira = 1;

  for (const rol of roller) {
    const notlar = [];
    let atananKisiId = rolSahibiniBul(rol, talep, orgReferansTarihi, veri);
    let atamaNedeni = "Normal";

    if (atananKisiId === null) {
      notlar.push(
        `"${rol}" rolü için ${orgReferansTarihi} tarihinde organizasyon verisinde bir sahip bulunamadı.`
      );
    } else {
      // 4. R7 — kendi talebini onaylayamama
      if (atananKisiId === talep.talep_sahibi_id) {
        const devredilenYonetici = yoneticisiniBul(atananKisiId, orgReferansTarihi, veri);
        notlar.push(
          `"${rol}" rolünün sahibi (${atananKisiId}) aynı zamanda talep sahibi; R7 gereği kendi yöneticisine devredildi.`
        );
        atananKisiId = devredilenYonetici;
        atamaNedeni = "RolCakismasiVekalet";
        if (atananKisiId === null) {
          notlar.push("Devredilecek bir yönetici bulunamadı.");
        }
      }

      // 5. R5 — izin/vekalet (devredilmiş kişi için de tekrar kontrol edilir)
      if (atananKisiId !== null) {
        const izinSonucu = izinZinciriniCoz(atananKisiId, orgReferansTarihi, veri);
        if (izinSonucu.izinliMi) {
          notlar.push(
            `İzin zinciri: ${izinSonucu.zincir.join(" → ")} (${orgReferansTarihi} tarihinde).`
          );
          atananKisiId = izinSonucu.kisiId;
          if (atamaNedeni === "Normal") atamaNedeni = "IzinKaynakliVekalet";
        }
      }
    }

    adimlar.push({ sira_no: sira++, rol, atanan_kisi_id: atananKisiId, atama_nedeni: atamaNedeni, notlar });
  }

  return {
    talep_id: talep.id,
    kural_seti_id: kuralSeti.id,
    org_referans_tarihi: orgReferansTarihi,
    adimlar,
    genelNotlar,
  };
}

module.exports = { onayZinciriOlustur };
