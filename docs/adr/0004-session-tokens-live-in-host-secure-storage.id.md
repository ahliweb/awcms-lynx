🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0004-session-tokens-live-in-host-secure-storage.md)

# ADR-0004 — Token sesi disimpan di secure storage host, tidak pernah di dalam bundle

- **Status:** Diterima
- **Tanggal:** 25 Oktober 2026
- **Pengambil keputusan:** ahliweb
- **Terkait:** ADR-0003; awcms ADR-0146 §2.3 (secret native di secure storage, tidak pernah localStorage); awcms-one ADR-0016 (sesi bearer pelanggan), ADR-0017 (kunci provider tetap di server)

## Konteks

Kedua backend menerbitkan token bearer opak: sesi staf awcms (120 menit secara default, tanpa refresh, dapat dicabut dengan `POST /api/v1/auth/logout`) dan sesi pelanggan awcms-one (`cs_…`, 30 hari bergulir/sliding, dapat dicabut dengan `POST …/account/logout`). Siapa pun yang memegang token dianggap sebagai pengguna tersebut hingga token kedaluwarsa atau dicabut.

## Keputusan

**D1.** Klien hanya menyimpan satu rekaman, dengan kunci `awcms-lynx:session`, melalui `secureStorage.set` — Keychain di iOS, AES-GCM berbasis Android Keystore di Android, HUKS di HarmonyOS, OS keyring (atau file aplikasi yang hanya dapat diakses pemilik, diberi label sebagai demikian) di desktop, penyimpanan browser di Web.

**D2.** Tidak ada token, kata sandi, OTP, atau kredensial mesin yang pernah dikompilasi ke dalam bundle, dicatat di log, atau diteruskan melalui `globalProps`. Variabel `PUBLIC_*` hanya membawa konfigurasi yang tidak bersifat rahasia.

**D3.** Sign-out selalu menghapus rekaman lokal, bahkan ketika pemanggilan ke server gagal; respons `401` dari backend pada pemanggilan yang terautentikasi juga menghapusnya.

**D4.** Sesi staf dibuang secara lokal begitu `expiresAt` terlewati (server tidak memperpanjangnya secara bergulir). Sesi pelanggan tidak dikadaluwarsakan secara lokal, karena server memperpanjangnya secara bergulir tanpa mengembalikan `expiresAt` baru; klien mengandalkan `401` berikutnya.

**D5.** Di Web, sesi menggunakan `sessionStorage` untuk profil `awcms` (staf) dan `localStorage` untuk `awcms-one` (pelanggan, sesuai perilaku storefront sendiri `awcms-one:akun:v1`), dan dapat diubah melalui `PUBLIC_AWCMS_WEB_SESSION_PERSISTENCE`. Layar pengaturan menyatakan bahwa sesi disimpan di profil browser.

## Konsekuensi

- Produk yang membutuhkan jaminan lebih kuat (pengikatan perangkat, rotasi refresh, pencabutan jarak jauh untuk semua perangkat) memerlukan pekerjaan backend terlebih dahulu; lihat `docs/backend-integration.md` §Gaps.
- Lynx Explorer dan unit test menggunakan penyimpanan di memori dan tidak boleh pernah digunakan untuk sign-in produksi.
