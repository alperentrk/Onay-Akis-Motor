"use strict";

/**
 * Organizasyon şeması ve izin/vekalet takvimi üzerinde çalışan saf
 * (side-effect'siz) yardımcı fonksiyonlar. Hepsi "referans tarih"
 * parametresi alır — hiçbiri "bugünün tarihi"ni kendisi okumaz, bu da
 * motorun deterministik kalmasını sağlar (case gereksinimi: "aynı girdi
 * her zaman aynı çıktıyı vermeli").
 */

/**
 * Bir kişinin, verilen tarihte geçerli olan yöneticisini bulur.
 * OrganizasyonKaydi tarih aralıklı (versiyonlu) olduğu için, bu fonksiyon
 * her zaman "o tarihte ne biliniyorduysa onu" döndürür — R9 ile yapılan
 * bir düzeltme, o düzeltmenin geçerlilik tarihinden ÖNCEKİ bir referans
 * tarihiyle yapılan sorguları etkilemez (R3 snapshot koruması).
 *
 * @returns {string|null} yönetici kisi_id'si, ya da kayıt bulunamazsa/
 *          kayıtta yönetici eksikse null.
 */
function yoneticisiniBul(kisiId, referansTarih, veri) {
  const kayit = veri.organizasyonKayitlari.find(
    (k) =>
      k.kisi_id === kisiId &&
      referansTarih >= k.gecerlilik_baslangic &&
      (k.gecerlilik_bitis === null || referansTarih <= k.gecerlilik_bitis)
  );
  return kayit ? kayit.yonetici_id : null;
}

/** Bir masraf merkezinin sahibini döndürür (versiyonsuz, sabit — bkz. tasarım dokümanı §1.1). */
function masrafMerkeziSahibiniBul(masrafMerkezi, veri) {
  if (!masrafMerkezi) return null;
  const kayit = veri.masrafMerkeziSahipleri.find((m) => m.masraf_merkezi === masrafMerkezi);
  return kayit ? kayit.kisi_id : null;
}

/** Sabit rollerin (FinansMüdürü, TeknolojiDirektörü, CEO) sahibini döndürür. */
function sabitRolSahibiniBul(rol, veri) {
  return veri.sabitRoller[rol] ?? null;
}

/**
 * Bir kişinin verilen tarihte izinli olup olmadığını, izinliyse vekiline
 * zincirleme olarak (vekilin de izinli olabileceği ihtimaline karşı)
 * bakar. Senaryo 5'teki "Burak izinli → vekili Deniz de izinli → Fatma"
 * zincirlemesi bu fonksiyonla çözülür.
 *
 * @param {number} maxDerinlik Sonsuz döngüye karşı güvenlik sınırı
 *        (gerçek veride olmaması gereken dairesel vekalet ihtimaline karşı).
 * @returns {{ kisiId: string, izinliMi: boolean, zincir: string[] }}
 *          `kisiId`: zincirin sonunda onayı üstlenecek kişi.
 *          `izinliMi`: en az bir devir gerçekleştiyse true.
 *          `zincir`: [orijinal, vekil1, vekil2, ...] — izlenebilirlik için.
 */
function izinZinciriniCoz(kisiId, referansTarih, veri, maxDerinlik = 5) {
  const zincir = [kisiId];
  let mevcut = kisiId;

  for (let i = 0; i < maxDerinlik; i++) {
    const izin = veri.izinKayitlari.find(
      (iz) => iz.kisi_id === mevcut && referansTarih >= iz.baslangic && referansTarih <= iz.bitis
    );
    if (!izin) break;
    mevcut = izin.vekil_kisi_id;
    zincir.push(mevcut);
  }

  return { kisiId: mevcut, izinliMi: zincir.length > 1, zincir };
}

module.exports = {
  yoneticisiniBul,
  masrafMerkeziSahibiniBul,
  sabitRolSahibiniBul,
  izinZinciriniCoz,
};
