# Hasil uji integrasi PRC Connect

Uji dijalankan dengan `python start.py --test` pada Linux dengan Python 3.12.14, Node.js 24.22.3, SQLite, dan Hardhat 2.26.3. Model memakai pustaka standar Python. Lingkungan uji memakai basis data terpisah dengan 73 kantong dan 180 baris riwayat sintetis serta kontrak Solidity baru.

| Skenario dan input | Hasil yang diharapkan | Hasil aktual | Status |
| --- | --- | --- | --- |
| Buka dashboard tanpa sesi dan baca stok BDRS-002 dengan akun BDRS-001. | Akses ditolak. | API mengembalikan 401 dan 403. | Lulus |
| Baca hasil model horizon 30 hari untuk ketiga BDRS. | Prediksi dihitung dari data awal dengan 14 hari data uji kronologis. | Prediksi 25, 20, dan 18 kantong. Ketiganya memakai 14 hari data uji. | Lulus |
| Cari pasangan BDRS-002 → BDRS-001, lalu ajukan pratinjau dengan tanggal kedaluwarsa yang sudah berubah. | Pratinjau berisi kandidat yang valid. Pratinjau lama ditolak. | PRC-0021 hingga PRC-0030 direkomendasikan. Pratinjau lama mendapat 409. | Lulus |
| Cari dan buat rekomendasi ulang saat pasangan sudah punya rencana aktif. | Pasangan aktif disembunyikan dan permintaan duplikat ditolak. | Pasangan aktif disembunyikan, rute lain masih tersedia, dan pembuatan duplikat mendapat 409. | Lulus |
| Coba persetujuan akhir sebelum konfirmasi BDRS, lalu jalankan urutan tiga pihak dan ulangi persetujuan. | Persetujuan dini ditolak. Persetujuan berurutan mereservasi 10 kantong dan membuat satu bukti. | Urutan yang benar menghasilkan satu pesanan dan satu bukti persetujuan. Pemakaian kantong yang sudah direservasi ditolak. | Lulus |
| Terima daftar 10 ID di UDD. Tahankan PRC-0030 tanpa alasan, lalu ulangi dengan alasan. | Penahanan tanpa alasan ditolak. Sembilan kantong dapat diteruskan. | Validasi menghasilkan 422. Setelah alasan diisi, sembilan kantong dapat diteruskan dan satu ditahan. | Lulus |
| Laporkan kantong kurang dan kantong bermasalah sebagai BDRS tujuan, lalu konfirmasi kiriman sesuai. | Laporan terlihat tanpa menambah stok atau mencatat bukti serah terima sebelum konfirmasi. | Laporan tersimpan. Setelah konfirmasi, stok asal 25, stok tujuan 19, dan satu kantong masih ditahan di UDD. | Lulus |
| Verifikasi tiga peristiwa pesanan, lalu ubah salinan payload dan verifikasi. | Bukti yang cocok terverifikasi. Perubahan payload terdeteksi. | Ketiga bukti cocok dengan receipt dan nilai kontrak. Payload yang diubah gagal diverifikasi. | Lulus |
| Batalkan sebelum keputusan, coba batalkan setelah konfirmasi pertama, dan tolak usulan lain. | Pembatalan awal tersedia. Pembatalan setelah keputusan ditolak. Penolakan menutup rencana tanpa pesanan. | Pasangan yang dibatalkan muncul kembali jika memenuhi kriteria stok. Pembatalan terlambat ditolak dan usulan yang ditolak tidak membuat pesanan. | Lulus |
| Reset redistribusi, impor stok tambahan, lalu reset stok. | Reset redistribusi mempertahankan stok manual. Reset stok memulihkan 73 kantong awal. | Rencana dikosongkan, stok awal pulih, serta riwayat pemakaian dan bukti ledger tetap tersedia. Stok tambahan dapat diimpor ulang. | Lulus |

## Bukti transaksi

Berikut hash transaksi yang dihasilkan dalam satu sesi pengujian. Sesi lain menghasilkan hash tersendiri.

```text
ORD-0001/APPROVAL 0x8d96955d6043051475f02d4ec33229daf865b87d0cc16cd854311d65ce96061f
ORD-0001/SOURCE_TO_UDD 0x4d27691e75161d12bae955b7d5969b5bc38aaecb8eefa8247750626573a15973
ORD-0001/UDD_TO_DESTINATION 0x0391367db34727f26e7adcdb6ff1a3c4c2906ce777d4ea89603d2e71a5a394a7
```
