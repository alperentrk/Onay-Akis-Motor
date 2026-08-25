/* ============================================================================
   ÖRNEK VERİ — case dokümanındaki organizasyon/kural verisiyle birebir
   (src/veri.js ile aynı içerik, MSSQL karşılığı).
   schema.sql çalıştırıldıktan sonra bu script ile doldurulabilir.
   ============================================================================ */

SET IDENTITY_INSERT dbo.Kisi ON;
INSERT INTO dbo.Kisi (id, isim, unvan, departman) VALUES
    (1, N'Ayşe', N'Uzman', N'IT'),
    (2, N'Burak', N'Müdür', N'IT'),
    (3, N'Deniz', N'Direktör', N'Teknoloji'),
    (4, N'Can', N'Uzman', N'Finans'),
    (5, N'Fatma', N'Müdür', N'Finans'),
    (6, N'Elif', N'CEO', NULL);
SET IDENTITY_INSERT dbo.Kisi OFF;
GO

INSERT INTO dbo.OrganizasyonKaydi (kisi_id, yonetici_id, gecerlilik_baslangic, gecerlilik_bitis) VALUES
    (1, 2, '2026-01-01', NULL),   -- Ayşe → Burak
    (2, 3, '2026-01-01', NULL),   -- Burak → Deniz
    (5, 6, '2026-01-01', NULL),   -- Fatma → Elif
    (4, 5, '2026-01-01', NULL),   -- Can → Fatma
    (3, NULL, '2026-01-01', '2026-03-19'),  -- Deniz → (hatalı/eksik kayıt, İK düzeltmesinden önce)
    (3, 6, '2026-03-20', NULL);              -- Deniz → Elif (düzeltilmiş kayıt)
GO

INSERT INTO dbo.MasrafMerkeziSahibi (masraf_merkezi, kisi_id) VALUES
    (N'IT-OPS', 2),   -- Burak
    (N'PROJE-X', 3);  -- Deniz
GO

INSERT INTO dbo.IzinKaydi (kisi_id, baslangic, bitis, vekil_kisi_id) VALUES
    (2, '2026-03-10', '2026-03-20', 3),  -- Burak izinli, vekili Deniz
    (3, '2026-03-15', '2026-03-25', 5);  -- Deniz izinli, vekili Fatma
GO

/* --- Kural seti v1 ---
   Sınır kuralı motorla (src/kuralYardimci.js) birebir aynı: tutar_min/max
   burada DECIMAL(14,2) hassasiyetinde ifade edilir (ör. 9999.99 / 10000.00),
   böylece "10.000 sınırı 2. banda dahildir" kararı SQL tarafında da korunur. */
DECLARE @v1 INT;
INSERT INTO dbo.KuralSeti (versiyon_adi, gecerlilik_baslangic, gecerlilik_bitis)
VALUES (N'v1', '2026-01-01', '2026-03-14');
SET @v1 = SCOPE_IDENTITY();

INSERT INTO dbo.KuralSatiri (kural_seti_id, tutar_min, tutar_max, onay_zinciri) VALUES
    (@v1, 0.01,     9999.99,    N'["Yönetici"]'),
    (@v1, 10000.00, 100000.00,  N'["Yönetici","MasrafMerkeziSahibi","FinansMüdürü"]'),
    (@v1, 100000.01, 999999999.99, N'["Yönetici","MasrafMerkeziSahibi","FinansMüdürü","CEO"]');

INSERT INTO dbo.KuralSatiri (kural_seti_id, kategori, zorunlu_rol) VALUES
    (@v1, N'Danışmanlık', N'FinansMüdürü');
GO

/* --- Kural seti v2 --- */
DECLARE @v2 INT;
INSERT INTO dbo.KuralSeti (versiyon_adi, gecerlilik_baslangic, gecerlilik_bitis)
VALUES (N'v2', '2026-03-15', NULL);
SET @v2 = SCOPE_IDENTITY();

INSERT INTO dbo.KuralSatiri (kural_seti_id, tutar_min, tutar_max, onay_zinciri) VALUES
    (@v2, 0.01,     14999.99,   N'["Yönetici"]'),
    (@v2, 15000.00, 150000.00,  N'["Yönetici","MasrafMerkeziSahibi","FinansMüdürü"]'),
    (@v2, 150000.01, 999999999.99, N'["Yönetici","MasrafMerkeziSahibi","FinansMüdürü","CEO"]');

INSERT INTO dbo.KuralSatiri (kural_seti_id, kategori, zorunlu_rol) VALUES
    (@v2, N'Danışmanlık', N'FinansMüdürü'),
    (@v2, N'Yazılım Lisansı', N'TeknolojiDirektörü');
GO
