/* ============================================================================
   ONAY AKIŞI MOTORU — MSSQL VERİTABANI ŞEMASI
   ----------------------------------------------------------------------------
   Bu şema, tasarim-dokumani.docx §1'deki veri modelini birebir uygular.
   Hedef platform: Microsoft SQL Server 2019+ (JSON fonksiyonları için).

   Sıra: referans veri → kural motoru → talep & onay akışı → denetim.
   Motorun kendisi (src/*.js) bu şemadan tamamen bağımsız çalışır — bkz.
   tasarım dokümanı §4 "Motorun Sorumluluk Sınırı": motor saf bir
   fonksiyondur, veri buraya nereden geldiğinden (bu şema, bir CSV, ya da
   elle kurulmuş bir JS objesi) haberdar değildir.
   ============================================================================ */

IF DB_ID(N'OnayAkisiMotoru') IS NULL
BEGIN
    PRINT 'Bu script''i çalıştırmadan önce hedef veritabanını (ör. CREATE DATABASE OnayAkisiMotoru;) oluşturup USE ile seçin.';
END
GO

/* ----------------------------------------------------------------------
   1.1  ORGANİZASYON & İZİN
   ---------------------------------------------------------------------- */

CREATE TABLE dbo.Kisi (
    id              INT             IDENTITY(1,1)   NOT NULL,
    isim            NVARCHAR(100)                   NOT NULL,
    unvan           NVARCHAR(50)                    NOT NULL,
    departman       NVARCHAR(50)                    NULL,
    CONSTRAINT PK_Kisi PRIMARY KEY CLUSTERED (id)
);
GO

/* Tarih aralıklı (versiyonlu) yönetici ataması — R9/R3 çatışmasının çözümü.
   Bir düzeltme, var olan satırı güncellemez; yeni bir satır olarak eklenir
   ve öncekinin gecerlilik_bitis'i o günle kapatılır. */
CREATE TABLE dbo.OrganizasyonKaydi (
    id                      INT             IDENTITY(1,1)   NOT NULL,
    kisi_id                 INT                             NOT NULL,
    yonetici_id             INT                             NULL,      -- NULL: yönetici bilinmiyor/eksik (bkz. Senaryo 6)
    gecerlilik_baslangic    DATE                            NOT NULL,
    gecerlilik_bitis        DATE                            NULL,      -- NULL: hâlâ geçerli (açık uçlu)
    CONSTRAINT PK_OrganizasyonKaydi PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_OrgKaydi_Kisi FOREIGN KEY (kisi_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT FK_OrgKaydi_Yonetici FOREIGN KEY (yonetici_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT CK_OrgKaydi_TarihAraligi CHECK (gecerlilik_bitis IS NULL OR gecerlilik_bitis > gecerlilik_baslangic),
    CONSTRAINT CK_OrgKaydi_KendiYoneticisiOlamaz CHECK (yonetici_id IS NULL OR yonetici_id <> kisi_id)
);
GO

/* "Bir kişinin şu tarihteki yöneticisi kim" sorgusu (motorun yoneticisiniBul
   fonksiyonunun SQL karşılığı) bu indeksle desteklenir. */
CREATE INDEX IX_OrgKaydi_KisiTarih ON dbo.OrganizasyonKaydi (kisi_id, gecerlilik_baslangic, gecerlilik_bitis);
GO

/* Aynı kişi için tarih aralıkları çakışmamalı — bu, MSSQL'in yerleşik bir
   "range exclusion constraint" kavramı sunmaması nedeniyle CHECK ile değil,
   bir tetikleyiciyle (trigger) uygulanır. Basitlik ve "kalite > kapsam"
   prensibi gereği burada bilinçli olarak atlanmıştır; uygulama katmanındaki
   Finans arayüzü (bkz. tasarım dokümanı §4) yeni bir kayıt eklerken önceki
   açık uçlu kaydı otomatik kapatacak şekilde tasarlanmalıdır. */

CREATE TABLE dbo.MasrafMerkeziSahibi (
    masraf_merkezi  NVARCHAR(50)                    NOT NULL,
    kisi_id         INT                             NOT NULL,
    CONSTRAINT PK_MasrafMerkeziSahibi PRIMARY KEY CLUSTERED (masraf_merkezi),
    CONSTRAINT FK_MasrafMerkezi_Kisi FOREIGN KEY (kisi_id) REFERENCES dbo.Kisi(id)
);
GO

CREATE TABLE dbo.IzinKaydi (
    id              INT             IDENTITY(1,1)   NOT NULL,
    kisi_id         INT                             NOT NULL,
    baslangic       DATE                            NOT NULL,
    bitis           DATE                            NOT NULL,
    vekil_kisi_id   INT                             NOT NULL,
    CONSTRAINT PK_IzinKaydi PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_Izin_Kisi FOREIGN KEY (kisi_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT FK_Izin_Vekil FOREIGN KEY (vekil_kisi_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT CK_Izin_TarihAraligi CHECK (bitis >= baslangic),
    CONSTRAINT CK_Izin_KendiVekiliOlamaz CHECK (vekil_kisi_id <> kisi_id)
);
GO

CREATE INDEX IX_Izin_KisiTarih ON dbo.IzinKaydi (kisi_id, baslangic, bitis);
GO

/* ----------------------------------------------------------------------
   1.2  KURAL MOTORU
   ---------------------------------------------------------------------- */

CREATE TABLE dbo.KuralSeti (
    id                      INT             IDENTITY(1,1)   NOT NULL,
    versiyon_adi            NVARCHAR(20)                    NOT NULL,   -- 'v1', 'v2', ...
    gecerlilik_baslangic    DATE                            NOT NULL,
    gecerlilik_bitis        DATE                            NULL,
    CONSTRAINT PK_KuralSeti PRIMARY KEY CLUSTERED (id),
    CONSTRAINT UQ_KuralSeti_VersiyonAdi UNIQUE (versiyon_adi),
    CONSTRAINT CK_KuralSeti_TarihAraligi CHECK (gecerlilik_bitis IS NULL OR gecerlilik_bitis > gecerlilik_baslangic)
);
GO

/* onay_zinciri: sıralı rol listesi, JSON dizi olarak tutulur (tasarım
   dokümanı §2 kararı — ayrı bir alt tablo yok). ISJSON CHECK'i, yanlışlıkla
   düz metin girilmesini engeller. Örnek değer:
     ["Yönetici","MasrafMerkeziSahibi","FinansMüdürü"]
   kategori NULL ise bu satır bir TUTAR BANDI'dır (tutar_min <= tutar <=
   tutar_max ile eşleşir); kategori dolu ise bu satır tutardan bağımsız bir
   KATEGORİ ZORUNLULUĞU'dur (tutar_min/tutar_max bu durumda NULL kalır ve
   zorunlu_rol doldurulur — bkz. CK_KuralSatiri_TipTutarli). */
CREATE TABLE dbo.KuralSatiri (
    id              INT             IDENTITY(1,1)   NOT NULL,
    kural_seti_id   INT                             NOT NULL,
    tutar_min       DECIMAL(14,2)                   NULL,
    tutar_max       DECIMAL(14,2)                   NULL,
    kategori        NVARCHAR(50)                    NULL,
    onay_zinciri    NVARCHAR(MAX)                   NULL,   -- tutar bandı satırları için dolu
    zorunlu_rol     NVARCHAR(50)                    NULL,   -- kategori zorunluluğu satırları için dolu
    CONSTRAINT PK_KuralSatiri PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_KuralSatiri_KuralSeti FOREIGN KEY (kural_seti_id) REFERENCES dbo.KuralSeti(id),
    CONSTRAINT CK_KuralSatiri_OnayZinciriJson CHECK (onay_zinciri IS NULL OR ISJSON(onay_zinciri) = 1),
    CONSTRAINT CK_KuralSatiri_TutarAraligi CHECK (tutar_min IS NULL OR tutar_max IS NULL OR tutar_max >= tutar_min),
    -- Bir satır ya bir tutar bandıdır (tutar_min/max + onay_zinciri dolu, kategori/zorunlu_rol boş)
    -- ya da bir kategori zorunluluğudur (kategori + zorunlu_rol dolu, tutar/onay_zinciri boş) — ikisi karışmaz.
    CONSTRAINT CK_KuralSatiri_TipTutarli CHECK (
        (kategori IS NULL AND zorunlu_rol IS NULL AND onay_zinciri IS NOT NULL)
        OR
        (kategori IS NOT NULL AND zorunlu_rol IS NOT NULL AND onay_zinciri IS NULL AND tutar_min IS NULL AND tutar_max IS NULL)
    )
);
GO

CREATE INDEX IX_KuralSatiri_KuralSeti ON dbo.KuralSatiri (kural_seti_id);
GO

/* ----------------------------------------------------------------------
   1.3  TALEP & ONAY AKIŞI
   ---------------------------------------------------------------------- */

CREATE TABLE dbo.Talep (
    id                      INT             IDENTITY(1,1)   NOT NULL,
    talep_sahibi_id         INT                             NOT NULL,
    tutar                   DECIMAL(14,2)                   NOT NULL,
    kategori                NVARCHAR(50)                    NOT NULL,
    masraf_merkezi          NVARCHAR(50)                    NULL,
    gonderim_tarihi         DATE                            NULL,       -- Taslak durumundayken NULL
    durum                   NVARCHAR(20)                    NOT NULL DEFAULT 'Taslak',
    kural_seti_id           INT                             NULL,       -- gönderim anında kilitlenir (R3)
    org_referans_tarihi     DATE                            NULL,       -- gönderim anında kilitlenir (R3)
    orijinal_talep_id       INT                             NULL,       -- R8: yeniden gönderim izlenebilirliği (yalnızca raporlama amaçlı)
    olusturma_tarihi        DATETIME2                       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Talep PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_Talep_Sahibi FOREIGN KEY (talep_sahibi_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT FK_Talep_KuralSeti FOREIGN KEY (kural_seti_id) REFERENCES dbo.KuralSeti(id),
    CONSTRAINT FK_Talep_MasrafMerkezi FOREIGN KEY (masraf_merkezi) REFERENCES dbo.MasrafMerkeziSahibi(masraf_merkezi),
    CONSTRAINT FK_Talep_Orijinal FOREIGN KEY (orijinal_talep_id) REFERENCES dbo.Talep(id),
    CONSTRAINT CK_Talep_Durum CHECK (durum IN ('Taslak', 'Gönderildi', 'Onay Sürecinde', 'Onaylandı', 'Reddedildi')),
    CONSTRAINT CK_Talep_Tutar CHECK (tutar > 0),
    -- Taslak dışındaki her durumda, R3 kilidi (kural seti + org referans tarihi) dolu olmalı.
    CONSTRAINT CK_Talep_KilitlenmisVersiyon CHECK (
        durum = 'Taslak'
        OR (gonderim_tarihi IS NOT NULL AND kural_seti_id IS NOT NULL AND org_referans_tarihi IS NOT NULL)
    )
);
GO

CREATE INDEX IX_Talep_Sahibi ON dbo.Talep (talep_sahibi_id);
CREATE INDEX IX_Talep_Durum ON dbo.Talep (durum);
GO

CREATE TABLE dbo.OnayAdimi (
    id                  INT             IDENTITY(1,1)   NOT NULL,
    talep_id            INT                             NOT NULL,
    sira_no             INT                             NOT NULL,
    rol                 NVARCHAR(50)                    NOT NULL,
    atanan_kisi_id       INT                             NULL,          -- NULL: organizasyon verisinde sahip bulunamadı (bkz. Senaryo 6)
    durum               NVARCHAR(20)                    NOT NULL DEFAULT 'Bekliyor',
    atama_nedeni        NVARCHAR(30)                    NOT NULL DEFAULT 'Normal',
    olusturma_tarihi    DATETIME2                       NOT NULL DEFAULT SYSUTCDATETIME(),
    karar_tarihi        DATETIME2                       NULL,
    CONSTRAINT PK_OnayAdimi PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_OnayAdimi_Talep FOREIGN KEY (talep_id) REFERENCES dbo.Talep(id),
    CONSTRAINT FK_OnayAdimi_AtananKisi FOREIGN KEY (atanan_kisi_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT UQ_OnayAdimi_TalepSira UNIQUE (talep_id, sira_no),
    CONSTRAINT CK_OnayAdimi_Durum CHECK (durum IN ('Bekliyor', 'Onaylandı', 'Reddedildi')),
    CONSTRAINT CK_OnayAdimi_AtamaNedeni CHECK (atama_nedeni IN ('Normal', 'RolCakismasiVekalet', 'IzinKaynakliVekalet', 'Eskalasyon')),
    CONSTRAINT CK_OnayAdimi_KararTarihi CHECK (durum = 'Bekliyor' OR karar_tarihi IS NOT NULL)
);
GO

CREATE INDEX IX_OnayAdimi_Talep ON dbo.OnayAdimi (talep_id, sira_no);

/* R10'un can alıcı sorgusu ("Burak 2026 Mart'ta hangi taleplere hangi
   yetkiyle onay verdi") doğrudan bu indeksle karşılanır. */
CREATE INDEX IX_OnayAdimi_AtananKisi_KararTarihi ON dbo.OnayAdimi (atanan_kisi_id, karar_tarihi) INCLUDE (talep_id, rol, durum);
GO

/* ----------------------------------------------------------------------
   1.4  DENETİM
   ---------------------------------------------------------------------- */

/* OnayAdimi her zaman güncel atamayı tutar; bu tablo geçmişi korur.
   R4 (eskalasyon orijinal onaycıyı değiştirir) uygulandığında, eski
   atama buraya bir satır olarak yazılır, OnayAdimi.atanan_kisi_id ise
   yeni kişiyle güncellenir. */
CREATE TABLE dbo.AdimAtamaGecmisi (
    id              INT             IDENTITY(1,1)   NOT NULL,
    adim_id         INT                             NOT NULL,
    eski_atanan_id  INT                             NULL,
    yeni_atanan_id  INT                             NOT NULL,
    neden           NVARCHAR(30)                    NOT NULL,
    degisim_tarihi  DATETIME2                       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AdimAtamaGecmisi PRIMARY KEY CLUSTERED (id),
    CONSTRAINT FK_AdimGecmisi_Adim FOREIGN KEY (adim_id) REFERENCES dbo.OnayAdimi(id),
    CONSTRAINT FK_AdimGecmisi_EskiAtanan FOREIGN KEY (eski_atanan_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT FK_AdimGecmisi_YeniAtanan FOREIGN KEY (yeni_atanan_id) REFERENCES dbo.Kisi(id),
    CONSTRAINT CK_AdimGecmisi_Neden CHECK (neden IN ('Eskalasyon', 'Vekalet'))
);
GO

CREATE INDEX IX_AdimAtamaGecmisi_Adim ON dbo.AdimAtamaGecmisi (adim_id);
GO

/* ============================================================================
   ÖRNEK SORGU — R10 denetim sorusu:
   "2026 Mart'ta Burak hangi taleplere, hangi yetkiyle, hangi kural
   versiyonuna göre onay verdi?"
   ============================================================================ */
/*
SELECT
    t.id                    AS talep_id,
    oa.rol                  AS hangi_yetkiyle,
    ks.versiyon_adi         AS hangi_kural_versiyonu,
    oa.karar_tarihi
FROM dbo.OnayAdimi oa
JOIN dbo.Talep t      ON t.id = oa.talep_id
JOIN dbo.KuralSeti ks ON ks.id = t.kural_seti_id
JOIN dbo.Kisi k       ON k.id = oa.atanan_kisi_id
WHERE k.isim = N'Burak'
  AND oa.durum = 'Onaylandı'
  AND oa.karar_tarihi >= '2026-03-01' AND oa.karar_tarihi < '2026-04-01'
ORDER BY oa.karar_tarihi;
*/
