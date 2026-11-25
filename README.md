# PRC Connect · Prototipe D3 II3120

Aplikasi web lokal untuk simulasi prediksi pemakaian dan redistribusi PRC. Satu akun UDD dan tiga akun BDRS menggunakan dashboard, REST API, model regresi, SQLite, dan smart contract Solidity.

## Menjalankan di Windows

1. Pasang **Python 3.12 64-bit** dan **Node.js 22 LTS 64-bit**. Saat memasang Python, aktifkan *Add Python to PATH*.
2. Ekstrak seluruh ZIP ke satu folder. Buka **MULAI-WINDOWS.cmd** di folder proyek. Pada penggunaan pertama, peluncur membuat lingkungan Python dan mengunduh dependensi Python serta npm. Siapkan internet untuk langkah ini.
3. Buka **http://127.0.0.1:8000** jika browser belum terbuka. Pilih akun **UDD-001**, sandi **demo-prc**.
4. Biarkan terminal terbuka selama demo. Gunakan **Ganti akun** di dashboard untuk beralih peran. Tekan Ctrl+C di terminal untuk berhenti.

Perintah alternatif di PowerShell dari folder proyek:

    py -3.12 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    npm.cmd ci
    .\.venv\Scripts\python.exe start.py

Di macOS/Linux:

    python3 -m venv .venv
    .venv/bin/python -m pip install -r requirements.txt
    npm ci
    .venv/bin/python start.py

Peluncur memakai port 8000 untuk aplikasi dan 8545 untuk Hardhat. Tampilan React sudah dibangun di folder web. Setelah mengubah ui.jsx, jalankan **npm run build**.

## Demo utama

Data simulasi menggunakan tanggal tetap **25 November 2026**, satu kelompok PRC O+, dan riwayat 60 hari untuk setiap BDRS. Mulai dengan data awal dan horizon **30 hari**.

| Langkah | Akun dan tindakan | Hasil yang dapat diperiksa |
|---|---|---|
| 1 | UDD-001 → Prediksi AI → BDRS-001 → Jalankan prediksi | Model memprediksi 25 kantong. Dengan 10 tersedia dan cadangan 5, kekurangannya 20. |
| 2 | UDD-001 → Redistribusi → Cari rekomendasi → Buat usulan untuk **BDRS-002 → BDRS-001** | REC-0001 berisi PRC-0021 sampai PRC-0030. |
| 3 | Ganti akun ke BDRS-002. Buka detail rencana dan pilih Setujui rencana. | Konfirmasi pelepasan tercatat. |
| 4 | Ganti akun ke BDRS-001 dan setujui pada detail rencana. | Kesediaan menerima tercatat. |
| 5 | Ganti akun ke UDD-001 dan setujui. | ORD-0001 dibuat. Sepuluh ID direservasi bersama, stok tersedia asal menjadi 25. Bukti blockchain pertama tersedia. |
| 6 | Pada pesanan yang sama, isi sepuluh ID penerimaan, atau pilih Isi daftar untuk simulasi, lalu Konfirmasi penerimaan. | Sepuluh kantong berada di UDD dan menunggu pemeriksaan. Bukti kedua tersedia. |
| 7 | Pada pemeriksaan, pilih Siap diteruskan untuk PRC-0021 hingga PRC-0029. Pilih Ditahan bagi PRC-0030, isi alasan simulasi, lalu Simpan hasil pemeriksaan. | Sembilan ID dapat diteruskan dan satu berada di UDD. |
| 8 | Ganti akun ke BDRS-001, buka ORD-0001 lalu konfirmasi sembilan ID yang diterima. | Stok tersedia BDRS-001 menjadi 19. Bukti ketiga tersedia. |
| 9 | Pada Riwayat blockchain, klik Verifikasi untuk masing-masing peristiwa. | Tiga receipt sukses, tiga hash transaksi berbeda. Setiap tombol membaca kembali bukti dari node Ethereum lokal. |

Angka 25/20/18 dihitung dari CSV oleh model. Perubahan persediaan, pemakaian, dan periode prediksi dapat mengubah rekomendasi.

## Implementasi dan ruang lingkup

- **AI** menggunakan regresi linear per fasilitas dengan fitur hari dalam minggu. Evaluasi kronologis membandingkan MAE model dengan MAE rata-rata historis pada 14 hari terakhir. Model operasional kemudian dilatih pada seluruh riwayat. MAE dan proyeksi harian terlihat pada menu Prediksi AI. Dataset sintetis dikalibrasi untuk skenario kelompok.
- **Aturan stok** memakai hitungan AVAILABLE, prediksi, cadangan 5, kiriman masuk dari pesanan aktif, dan FEFO. Kandidat memiliki sisa masa simpan 5–14 hari. Transit diasumsikan satu hari. Jumlah rekomendasi dibatasi pemakaian yang diperkirakan sebelum kedaluwarsa dan stok tujuan yang akan habis lebih awal. Validasi ulang dan reservasi terjadi dalam satu transaksi SQLite saat persetujuan akhir.
- **Blockchain** memakai satu node Hardhat lokal dan satu akun penulis milik backend. Identitas petugas berasal dari sesi aplikasi. Kontrak menyimpan SHA-256 dari payload yang memuat pesanan, tahap, waktu, fasilitas, aktor, jumlah, dan daftar ID. Hash transaksi Ethereum merujuk ke receipt terpisah. Verifikasi membaca log transaksi, receipt, dan nilai kontrak.
- **Gangguan ledger** meninggalkan peristiwa dengan status tertunda. UDD dapat menekan Coba catat ulang. Kunci pesanan/tahap mencegah pencatatan ganda. Folder data menyimpan SQLite, konfigurasi kontrak, dan jurnal transaksi bertanda tangan. Peluncur memutar kembali transaksi asli jika node dimulai ulang. Simpan folder data sebagai satu kesatuan.
- **Antarmuka** memakai React, FastAPI dan Bearer JWT dengan sesi fasilitas. Dokumentasi interaktif tersedia di http://127.0.0.1:8000/docs. Operasi stok menerima ID per kantong. Persetujuan membedakan tiga tahap. Pemeriksaan merupakan operasi tambahan pada POST /api/v1/prc-redistribution/inspections. Tiga endpoint notifikasi memakai format ringkas facilityId dan message. Aksi dashboard mengirim pemberitahuan internal. Callback eksternal memerlukan variabel PRC_CALLBACK_KEY yang juga dikirim sebagai header X-Service-Key.
- Seluruh fasilitas, kondisi persediaan dan hasil pemeriksaan merupakan simulasi akademik. Sistem memakai input ID manual. Integrasi SIMRS/PMI, sensor rantai dingin, evaluasi klinis, tanda tangan dompet per petugas, dan konsensus blockchain lintas instansi berada di luar cakupan. Akun simulasi berbagi sandi awal yang dapat diganti melalui variabel PRC_PASSWORD.

## Uji dan penyimpanan

Hentikan demo. Di Windows jalankan:

    .\.venv\Scripts\python.exe start.py --test

Pada macOS/Linux gunakan **.venv/bin/python start.py --test**. Pengujian memakai folder sementara dan node Hardhat baru. Terminal menunjukkan status tiap pemeriksaan serta hash tiga transaksi uji. Setiap sesi demo menghasilkan hash masing-masing. Lihat **HASIL-UJI.md** untuk bukti pengujian paket.

Untuk memulai sesi baru dan mempertahankan pekerjaan lama, hentikan aplikasi dan ubah nama folder data menjadi data-arsip. Peluncur berikutnya membuat data simulasi baru. Untuk membuka arsip, hentikan aplikasi dan kembalikan folder yang dipilih ke nama data.

| Berkas | Isi |
|---|---|
| fixtures/usage.csv dan forecast.py | Data dan pelatihan model |
| service.py dan database.py | Persediaan, persetujuan, serah terima dan penyimpanan |
| app.py | REST API, validasi, sesi dan notifikasi |
| chain/PRCRedistributionLedger.sol, chain/deploy.cjs dan ledger.py | Kontrak, deployment, pencatatan dan verifikasi |
| ui.jsx, web/style.css dan web/bundle.js | Sumber antarmuka dan hasil build |
| tests/demo.py | Uji integrasi dengan kontrak yang berjalan |
