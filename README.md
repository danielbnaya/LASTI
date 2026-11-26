# PRC Connect · Prototipe D3 II3120

Aplikasi web lokal untuk simulasi prediksi pemakaian dan redistribusi PRC. Satu akun UDD dan tiga akun BDRS menggunakan dashboard, REST API, model regresi, SQLite, dan smart contract Solidity.

## Menjalankan di Windows lewat PowerShell

Buka PowerShell dari folder proyek yang berisi start.py dan package.json. Jika memakai lokasi kelompok, jalankan:

    Set-Location 'C:\Project\LASTI'
    py --list
    node --version

Jika .\.venv\Scripts\python.exe sudah tersedia, pakai lingkungan itu. Untuk pemasangan baru, contoh di bawah memakai Python 3.12 dan Node.js 22 LTS. Jalankan perintah berikut satu per satu untuk pemasangan pertama. Tunggu tiap perintah selesai. Jika salah satunya gagal, periksa pesan error di terminal sebelum melanjutkan.

    py -3.12 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    npm.cmd ci

Setiap kali akan menjalankan aplikasi:

    .\.venv\Scripts\python.exe start.py

Tunggu sampai PowerShell menampilkan **Uvicorn running on http://127.0.0.1:8000**, lalu buka **http://127.0.0.1:8000** pada laptop yang sama. Gunakan akun UDD-001 dan sandi demo-prc. Biarkan terminal tetap terbuka. Tekan Ctrl+C setelah demo selesai.

### Jika browser menampilkan “This site can’t be reached”

- Jika terminal kembali ke prompt sebelum baris Uvicorn muncul, startup gagal. Baca pesan terakhir. Untuk error Hardhat, buka 25 baris terakhir log dengan perintah di bawah.
- Jika port 8000 sedang dipakai, jalankan server dengan port berbeda dan buka alamat yang ditampilkan. Port 8545 dipakai oleh blockchain lokal.
- Saat server berjalan, periksa respons dari PowerShell kedua. Status 200 menunjukkan dashboard dapat diakses dari laptop itu.

    Get-Content .\data\hardhat.log -Tail 25
    # Alternatif saat port dashboard sedang dipakai
    .\.venv\Scripts\python.exe start.py --port 8001
    # Tes dari terminal kedua (sesuaikan port)
    (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/).StatusCode

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
| 2 | UDD-001 → Redistribusi → Cari rekomendasi → Buat usulan untuk **BDRS-002 → BDRS-001**. Periksa ringkasan kantong, lalu pilih **Konfirmasi buat usulan** | REC-0001 berisi PRC-0021 sampai PRC-0030. |
| 3 | Ganti akun ke BDRS-002. Buka detail rencana dan pilih Setujui rencana. | Konfirmasi pelepasan tercatat. |
| 4 | Ganti akun ke BDRS-001 dan setujui pada detail rencana. | Kesediaan menerima tercatat. |
| 5 | Ganti akun ke UDD-001 dan setujui. | ORD-0001 dibuat. Sepuluh ID direservasi bersama, stok tersedia asal menjadi 25. Bukti blockchain pertama tersedia. |
| 6 | Pada pesanan yang sama, isi sepuluh ID penerimaan, atau pilih Isi daftar untuk simulasi, lalu Konfirmasi penerimaan. | Sepuluh kantong berada di UDD dan menunggu pemeriksaan. Bukti kedua tersedia. |
| 7 | Pada pemeriksaan, pilih Siap diteruskan untuk PRC-0021 hingga PRC-0029. Pilih Ditahan bagi PRC-0030, isi alasan simulasi, lalu Simpan hasil pemeriksaan. | Sembilan ID dapat diteruskan dan satu berada di UDD. |
| 8 | Ganti akun ke BDRS-001, buka ORD-0001 lalu konfirmasi sembilan ID yang diterima. | Stok tersedia BDRS-001 menjadi 19. Bukti ketiga tersedia. |
| 9 | Pada Riwayat blockchain, klik Verifikasi untuk masing-masing peristiwa. | Tiga receipt sukses, tiga hash transaksi berbeda. Setiap tombol membaca kembali bukti dari node Ethereum lokal. |

Pada **Daftar rencana**, UDD dapat memilih **Batalkan usulan** sebelum ada keputusan dari pihak mana pun. Setelah dikonfirmasi, rencana terlihat dengan status **Dibatalkan** dan hasil rekomendasi diperbarui otomatis berdasarkan stok terbaru. Pencarian menampilkan pasangan asal dan tujuan yang belum memiliki rencana aktif. Setelah rencana selesai, ditolak, atau dibatalkan, pasangan dapat muncul kembali jika memenuhi aturan stok.

Angka 25/20/18 dihitung dari CSV oleh model. Perubahan persediaan, pemakaian, dan periode prediksi dapat mengubah rekomendasi.

## Stok tambahan untuk uji rekomendasi

Dari PowerShell di folder proyek, jalankan perintah berikut satu kali:

    .\.venv\Scripts\python.exe tambah_stok_demo.py

Skrip menambahkan 30 kantong per BDRS ke database yang dipakai aplikasi. Data yang sudah ada, riwayat pemakaian, dan pesanan tetap tersimpan. Jika aplikasi sudah terbuka, muat ulang halaman. Dengan akun UDD-001 dan periode 30 hari, buka **Redistribusi → Cari rekomendasi**. Untuk melihat status dan kedaluwarsa, buka **Persediaan**, lalu pilih BDRS yang ingin diperiksa. Dataset tambahan mencakup kantong tersedia dengan sisa masa simpan 2–36 hari dan kantong dengan reservasi pasien. BDRS-001 mendapat lebih banyak stok berstatus reservasi pasien agar masih memiliki kebutuhan redistribusi.

Demo utama dengan angka 10 kantong pada tabel sebelumnya memakai data awal sebelum stok tambahan diimpor. Rekomendasi setelah impor mengikuti stok, pemakaian, dan pesanan yang ada pada database lokal.

## Implementasi dan ruang lingkup

- **AI** menggunakan regresi linear per fasilitas dengan fitur kategori hari dalam minggu. Koefisien per kategori dipelajari dari riwayat dengan solusi kuadrat terkecil berupa rata-rata pemakaian untuk hari tersebut. Implementasi memakai pustaka standar Python sehingga modul prediksi dapat dimuat tanpa DLL SciPy. Evaluasi kronologis membandingkan MAE model dengan MAE rata-rata historis pada 14 hari terakhir. Model operasional kemudian dilatih pada seluruh riwayat. MAE dan proyeksi harian terlihat pada menu Prediksi AI. Dataset sintetis dikalibrasi untuk skenario kelompok.
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
