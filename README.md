# PRC Connect

PRC Connect adalah prototipe akademik untuk **Deliverable 3 II3120**. Aplikasi ini membantu satu Unit Donor Darah (UDD) dan tiga Bank Darah Rumah Sakit (BDRS) melihat persediaan *packed red cells* (PRC), memperkirakan pemakaian, dan mengoordinasikan redistribusi antar fasilitas.

## Fitur

- **Persediaan PRC.** Catat stok, kedaluwarsa, reservasi pasien, dan pemakaian per kantong.
- **Prediksi AI.** Regresi linear memperkirakan pemakaian per BDRS untuk 7, 14, atau 30 hari dari riwayat harian. Dashboard menampilkan rentang tanggal, prediksi harian, dan evaluasi MAE.
- **Redistribusi.** UDD meninjau rekomendasi dan daftar kantong. Persetujuan berjalan dari BDRS asal ke BDRS tujuan, lalu ke UDD. Rute pengiriman melewati UDD untuk pemeriksaan per kantong sebelum diteruskan.
- **Notifikasi dan bukti blockchain.** Aplikasi menampilkan aktivitas fasilitas, laporan ketidaksesuaian, dan bukti yang dapat diverifikasi untuk persetujuan akhir dan kedua serah terima.

## Mulai cepat

Prasyaratnya adalah Git, Python 3.12, dan Node.js 22 LTS beserta npm.

### Windows (PowerShell)

Untuk instalasi pertama dari folder proyek baru:

```powershell
git clone https://github.com/danielbnaya/LASTI.git
cd LASTI
```

Jika repo sudah ada, langsung masuk ke folder salinanmu, misalnya `Set-Location 'C:\Project\LASTIII'`. Dari folder repo, jalankan satu per satu:

```powershell
py --list
node --version
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd ci
```

Jika Python 3.12 tidak muncul di `py --list`, instal Python 3.12 atau gunakan `py -m venv .venv` untuk memakai Python yang sudah tersedia.

Untuk menjalankan aplikasi dari folder repo:

```powershell
.\.venv\Scripts\python.exe start.py
```

### macOS dan Linux

```bash
git clone https://github.com/danielbnaya/LASTI.git
cd LASTI
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
.venv/bin/python start.py
```

`start.py` menyiapkan node Hardhat dan kontrak lokal. Tunggu pesan **Uvicorn running on** sebelum membuka [dashboard](http://127.0.0.1:8000). Biarkan terminal terbuka selama demo dan tekan `Ctrl+C` untuk berhenti. Hasil build React sudah disertakan, sehingga aplikasi dapat langsung dijalankan setelah dependensi terpasang.

### Akun demo

| Akun | Peran |
| --- | --- |
| `UDD-001` | Koordinator rekomendasi, pemberi persetujuan akhir, dan pemeriksa kantong di UDD |
| `BDRS-001`, `BDRS-002`, `BDRS-003` | Petugas BDRS sesuai fasilitas yang dipilih |

Sandi awal semua akun simulasi adalah `demo-prc`. Gunakan tombol **Ganti akun** untuk berpindah peran selama demo.

## Demo redistribusi

Contoh ini memakai stok awal, tanggal simulasi **25 November 2026**, dan horizon **30 hari**.

| Langkah | Tindakan | Hasil yang dapat diperiksa |
| --- | --- | --- |
| 1 | Sebagai **UDD-001**, buka **Prediksi AI** untuk BDRS-001 dan jalankan prediksi. | Perkiraan pemakaian 25 kantong. Dengan stok 10 dan cadangan 5, potensi kekurangan adalah 20 kantong. |
| 2 | Di **Redistribusi**, pilih **Cari rekomendasi**, lalu **Buat usulan** untuk BDRS-002 → BDRS-001. Tinjau daftar kantong, lalu konfirmasi usulan. | Usulan memuat 10 kantong, PRC-0021 hingga PRC-0030. |
| 3 | Di detail rencana, setujui secara berurutan sebagai **BDRS-002**, **BDRS-001**, dan **UDD-001**. | Pesanan dibuat, kantong direservasi, dan persetujuan akhir tercatat di blockchain. |
| 4 | Sebagai **UDD-001**, isi ID kantong yang tiba atau pilih **Isi daftar untuk simulasi**, lalu konfirmasi penerimaan. | Sepuluh kantong masuk tahap pemeriksaan UDD dan bukti serah terima pertama tercatat. |
| 5 | Di pemeriksaan UDD, tandai PRC-0021 hingga PRC-0029 siap diteruskan. Tahankan PRC-0030 dengan alasan simulasi. | Sembilan kantong dapat diteruskan dan satu ditahan di UDD. |
| 6 | Sebagai **BDRS-001**, buka pesanan, pilih **Kiriman sesuai**, lalu konfirmasi sembilan ID yang tiba. | Stok tersedia penerima menjadi 19 kantong dan bukti serah terima kedua tercatat. |
| 7 | Di **Riwayat blockchain**, klik **Verifikasi** untuk tiap peristiwa. | Tiga peristiwa memiliki hash transaksi terpisah dan dapat diverifikasi dari node lokal. |

Untuk menguji jalur lain:

- **Batalkan usulan.** UDD dapat membatalkan sebelum ada keputusan pertama. Pasangan asal dan tujuan dapat muncul kembali pada rekomendasi jika memenuhi kriteria stok.
- **Laporkan ketidaksesuaian.** BDRS tujuan dapat memilih **Ada ketidaksesuaian**, mencatat ID yang tiba, dan memberi alasan. Laporan terlihat oleh UDD. Stok penerima bertambah setelah kiriman berhasil dikonfirmasi.

## Data simulasi

Data awal berisi 73 kantong PRC O+ dan 60 hari riwayat pemakaian sintetis per BDRS. SQLite disimpan di `data/prc.sqlite`. Folder `data/` juga memuat konfigurasi kontrak dan jurnal transaksi blockchain lokal. Simpan folder ini sebagai satu kesatuan jika ingin mengarsipkan demo.

| Aksi UDD | Dampak |
| --- | --- |
| **Redistribusi → Reset data redistribusi** | Mengosongkan daftar rencana dan pesanan serta mengembalikan kantong yang terdampak ke fasilitas asal selama belum terpakai atau dicadangkan untuk pasien. |
| **Persediaan → Reset stok darah** | Mengembalikan 73 kantong awal dan menghapus stok tambahan serta daftar redistribusi di aplikasi. |

Kedua reset mempertahankan riwayat pemakaian dan bukti yang sudah tercatat di blockchain. Untuk menambah 30 kantong uji per BDRS, jalankan skrip berikut dari PowerShell dan muat ulang aplikasi:

```powershell
.\.venv\Scripts\python.exe tambah_stok_demo.py
```

## Arsitektur dan pengembangan

| Lokasi | Fungsi |
| --- | --- |
| `ui.jsx`, `web/` | Antarmuka React, CSS, dan hasil build |
| `app.py`, `service.py`, `database.py` | FastAPI, aturan redistribusi, dan penyimpanan SQLite |
| `forecast.py`, `fixtures/usage.csv` | Model regresi berdasarkan hari dalam minggu dan data sintetis |
| `chain/`, `ledger.py`, `hardhat.config.cjs` | Kontrak Solidity, node lokal, pencatatan dan verifikasi bukti |
| `start.py`, `tests/demo.py` | Peluncur aplikasi dan uji integrasi |

[Dokumentasi API interaktif](http://127.0.0.1:8000/docs) tersedia saat aplikasi berjalan. Setelah mengubah `ui.jsx`, bangun ulang frontend dengan `npm.cmd run build` di PowerShell atau `npm run build` di macOS/Linux.

### Pengujian

Hentikan dulu aplikasi agar port Hardhat tersedia. Pengujian memakai basis data sementara dan kontrak baru.

```powershell
.\.venv\Scripts\python.exe start.py --test
```

Di macOS/Linux gunakan `.venv/bin/python start.py --test`. Lihat [hasil uji integrasi](HASIL-UJI.md) untuk skenario dan contoh bukti transaksi.

### Jika aplikasi belum terbuka

- Baca pesan terakhir di terminal dan pastikan pesan **Uvicorn running on** muncul. Untuk masalah Hardhat, periksa `Get-Content .\data\hardhat.log -Tail 25`.
- Port default dashboard adalah `8000`. Jika dipakai layanan lain, jalankan `.\.venv\Scripts\python.exe start.py --port 8001`. Port `8545` dipakai Hardhat. Jalankan hanya satu salinan PRC Connect pada satu waktu.

## Batasan prototipe

Prototipe ini memakai fasilitas dan data sintetis, satu jenis komponen dan golongan darah (PRC O+), serta satu node Hardhat lokal. ID kantong dan hasil pemeriksaan dicatat secara manual. Evaluasi model dan pengujian fungsi memakai skenario simulasi. Integrasi SIMRS/PMI, pemindaian kode kantong, identitas petugas per orang, dan jaringan blockchain lintas fasilitas merupakan ruang pengembangan berikutnya.
