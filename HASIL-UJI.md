# Hasil uji prototipe PRC Connect

Uji dijalankan pada Linux menggunakan Python 3.12, SQLite, scikit-learn, Node.js 24, kontrak Solidity pada Hardhat 2.26.3 dan Chromium headless. Data awal terdiri dari 180 baris pemakaian sintetis dan 73 kantong tersedia. Tabel merangkum hasil aktual pada paket ini.

| Skenario dan input | Hasil yang diharapkan | Hasil aktual | Status |
|---|---|---|---|
| Buka dashboard tanpa sesi, lalu coba baca stok BDRS-002 sebagai BDRS-001 | HTTP 401 dan 403 | Kedua permintaan ditolak dengan status tersebut | Lulus |
| Hitung prediksi 30 hari dari fixtures/usage.csv | Nilai keluaran model menghasilkan rekomendasi pada skenario awal | 25, 20, 18 kantong untuk BDRS-001, 002, 003. Uji kronologis memakai 14 hari | Lulus |
| Ajukan rencana BDRS-002 ke BDRS-001 | 10 kandidat unik memenuhi batas cadangan dan FEFO | PRC-0021 sampai PRC-0030 | Lulus |
| Coba persetujuan akhir sebelum konfirmasi BDRS, lalu jalankan urutan tiga pihak | Persetujuan dini ditolak, urutan yang benar berhasil | 409 untuk persetujuan dini. Tiga keputusan tercatat dan satu pesanan dibuat | Lulus |
| Ulangi persetujuan akhir, lalu catat pemakaian kantong yang direservasi | Pencatatan ganda dicegah | Persetujuan idempoten, pemakaian mendapat 409 | Lulus |
| Konfirmasi 10 ID ke UDD, tahan PRC-0030 tanpa alasan, lalu ulangi dengan alasan | Pemeriksaan tanpa alasan ditolak, sembilan ID dapat diteruskan | 422 untuk input tidak lengkap. Pemeriksaan dengan alasan tersimpan | Lulus |
| Coba serahkan 10 kantong ke tujuan, lalu serahkan sembilan yang lolos | ID yang ditahan tidak bisa dikirim | 422 untuk daftar 10. Daftar sembilan diterima, stok tujuan 19, asal 25, satu ditahan di UDD | Lulus |
| Buka riwayat ORD-0001 dan baca kontrak | Tiga receipt dan digest cocok dengan tiga peristiwa | Ketiganya terverifikasi. Mengubah salinan payload menyebabkan verifikasi gagal | Lulus |
| Tolak usulan berikutnya oleh asal | Pesanan tidak terbentuk | Rencana REJECTED tanpa orderId | Lulus |
| Gunakan browser untuk berpindah di antara akun, memeriksa dan menerima pesanan | Pengguna dapat menyelesaikan demo dari dashboard | Alur selesai melalui antarmuka. Tiga tombol menampilkan Terverifikasi | Lulus |
| Hentikan backend dan node, jalankan kembali dengan folder data yang sama | Sesi data serta bukti transaksi dapat digunakan kembali | Seluruh bukti pesanan berhasil diverifikasi setelah jurnal dipulihkan | Lulus |
| Buka detail pesanan di browser selebar 390 piksel | Halaman dapat diakses tanpa gulir horizontal pada seluruh halaman | Lebar dokumen sesuai viewport | Lulus |

## Bukti keluaran uji integrasi

Berikut keluaran aktual satu sesi uji. Untuk mengamati transaksi pada node yang sedang berjalan, jalankan demo dari README.md dan buka pesanan pada menu Redistribusi.

    PASS Akses tanpa sesi 401, akses stok lintas BDRS 403
    PASS Model menghasilkan prediksi 25/20/18 dan MAE pada 14 hari uji
    PASS FEFO merekomendasikan sepuluh kantong unik
    PASS Persetujuan berurutan dan percobaan ulang menghasilkan satu bukti
    PASS Reservasi melarang pemakaian ganda
    PASS Kantong ditahan wajib beralasan dan ditolak saat dikirim
    PASS Akhir transaksi: asal 25, tujuan 19, satu kantong ditahan di UDD
    PASS Tiga transaksi berbeda pada kontrak
    PASS Bukti ORD-0001/APPROVAL cocok dengan receipt dan state kontrak
    PASS Bukti ORD-0001/SOURCE_TO_UDD cocok dengan receipt dan state kontrak
    PASS Bukti ORD-0001/UDD_TO_DESTINATION cocok dengan receipt dan state kontrak
    PASS Perubahan payload terdeteksi
    PASS Penolakan menutup rencana tanpa reservasi dan tanpa pesanan
    Bukti transaksi pengujian
    ORD-0001/APPROVAL 0xe79bd4472ac0a2961c6a39f3676eedca12761c865055c5137b3286bafdfd0bb9
    ORD-0001/SOURCE_TO_UDD 0xbeac13a95abb30e4b41b8e9a130ba0ac122f3366481d6b9242ae804e5017b405
    ORD-0001/UDD_TO_DESTINATION 0x23c7dc9fabc5927e86e1a09854c7b4f63f90dc61e53509bc0d87fe650e3ac6da

Peluncur Windows disertakan. Eksekusi langsung berkas CMD pada Windows belum diverifikasi. Nilai simulasi dan hasil uji ini dapat digunakan kelompok sebagai acuan saat mengumpulkan bukti pengujian di laptop presentasi.
