"use strict";

/**
 * Kural seti seçimi ve tutar/kategoriye göre temel rol listesinin
 * (henüz kişiye çözülmemiş) çıkarılması.
 */

/**
 * Verilen tarihte aktif olan kural setini bulur (tarih aralıklı,
 * versiyonlu — tasarım dokümanı §3, kural 1).
 */
function aktifKuralSetiniBul(referansTarih, kuralSetleri) {
  return (
    kuralSetleri.find(
      (ks) =>
        referansTarih >= ks.gecerlilik_baslangic &&
        (ks.gecerlilik_bitis === null || referansTarih <= ks.gecerlilik_bitis)
    ) || null
  );
}

/**
 * Tutar bandını ve kategori zorunluluklarını uygulayarak, henüz kişiye
 * çözülmemiş sıralı rol listesini üretir.
 *
 * Sınır kuralı: tutar < esikler[0] → 1. bant; esikler[0] <= tutar <=
 * esikler[1] → 2. bant (her iki sınır da bu bantta); tutar > esikler[1]
 * → 3. bant. (Kararlar tablosu — "Sınır Değeri Belirsizlikleri")
 *
 * @returns {{ roller: string[], notlar: string[] }}
 *          `roller`: MasrafMerkeziSahibi rolü, talebe masraf merkezi
 *          atanmamışsa listeden tamamen çıkarılır (bkz. Senaryo 4) —
 *          bu "atlanan bir adım" değil, "bu talebe uygulanmayan bir rol"
 *          anlamına gelir; bant tanımının kendisi zaten bazı rolleri hiç
 *          içermiyor olabilir, aynı mantık.
 */
function temelRolListesiniOlustur(talep, kuralSeti) {
  const [b1, b2] = kuralSeti.esikler;
  let roller;
  if (talep.tutar < b1) roller = [...kuralSeti.bantlar[0]];
  else if (talep.tutar <= b2) roller = [...kuralSeti.bantlar[1]];
  else roller = [...kuralSeti.bantlar[2]];

  for (const kural of kuralSeti.kategoriKurallari) {
    if (talep.kategori === kural.kategori && !roller.includes(kural.zorunluRol)) {
      const ceoIndex = roller.indexOf("CEO");
      if (ceoIndex === -1) roller.push(kural.zorunluRol);
      else roller.splice(ceoIndex, 0, kural.zorunluRol);
    }
  }

  const notlar = [];
  if (roller.includes("MasrafMerkeziSahibi") && !talep.masraf_merkezi) {
    roller = roller.filter((r) => r !== "MasrafMerkeziSahibi");
    notlar.push(
      "MasrafMerkeziSahibi rolü, talebe masraf merkezi atanmadığı için zincire dahil edilmedi."
    );
  }

  return { roller, notlar };
}

module.exports = { aktifKuralSetiniBul, temelRolListesiniOlustur };
