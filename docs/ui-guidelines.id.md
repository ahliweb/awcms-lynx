🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](ui-guidelines.md)

# Panduan UI, aksesibilitas, dan responsivitas

Aturan untuk layar di `packages/app`. Aturan ini berlaku di setiap host, karena komponen yang sama dirender baik secara native maupun di Web.

## Elemen

Lynx bukan peramban. Gunakan elemen Lynx huruf kecil — `<view>`, `<text>`, `<image>`, `<scroll-view>`, `<input>` — jangan pernah `div`/`span`/`button`. Teks hanya dirender di dalam `<text>`. `display` diatur secara eksplisit (`flex`) di setiap kelas tata letak. `<input>` Lynx bersifat tidak terkontrol (uncontrolled): baca nilainya dari `bindinput` (`event.detail.value`).

## Komponen (`packages/app/src/components`)

| Komponen | Kegunaan | Aksesibilitas bawaan |
| --- | --- | --- |
| `Screen`, `Section`, `Row`, `Loading` | kerangka halaman, baris berlabel | penanda heading pada judul; setiap baris adalah satu elemen yang dibacakan sebagai "label: nilai" |
| `Button` | setiap aksi yang dapat diketuk | `accessibility-element`, `traits="button"`, label = teks yang terlihat; target minimum 48 px; status nonaktif dan sibuk |
| `TextField` | input satu baris berlabel | label yang terlihat, `accessibility-label`, teks galat dibacakan sebagai elemen tersendiri |
| `Notice` | pesan info / sukses / peringatan / galat | satu elemen dengan kalimat lengkap sebagai label |
| `TabBar` | navigasi tingkat atas | setiap tab adalah tombol; tab yang aktif membawa `selected` |

## Token desain (`packages/app/src/styles/app.css`)

Dideklarasikan sebagai custom property pada `.App`. Kontras (WCAG 2.2 AA, ≥ 4,5:1 untuk teks):

| Pasangan | Rasio |
| --- | --- |
| `--color-text` #1b1f24 pada `--color-surface` #ffffff | 16,6 : 1 |
| `--color-muted` #4a5360 pada #ffffff | 7,8 : 1 |
| `--color-muted` pada `--color-bg` #f6f7f9 | 7,3 : 1 |
| `--color-on-primary` #ffffff pada `--color-primary` #0b5cad | 6,7 : 1 |
| `--color-primary` pada #ffffff (tombol sekunder, harga) | 6,7 : 1 |
| #ffffff pada `--color-danger` #b42318 (dan warna danger sebagai teks galat pada #ffffff) | 6,6 : 1 |
| `--color-text` pada latar belakang pesan (#e8f1fb, #fdecea, #e7f6ec, #fff4e0) | ≥ 14 : 1 |

Produk turunan melakukan rebrand dengan mengubah token, `PUBLIC_AWCMS_APP_NAME`, dan ikon host (`apps/desktop/resources/`, ikon peluncur shell native) — lalu memeriksa ulang rasio-rasio ini.

## Daftar periksa aksesibilitas (per layar)

- Setiap elemen interaktif adalah `Button`/tab `TabBar` atau memiliki `accessibility-element` + trait + label.
- Setiap input memiliki label yang terlihat; galat berupa teks, bukan hanya warna.
- Heading menggunakan `accessibility-heading`.
- Gambar memiliki `accessibility-label` (`alt` dari API, atau nama item bila tidak ada).
- Perubahan status (memuat, galat, sukses) muncul sebagai teks di dalam `Notice` atau `Loading`.
- Target sentuh ≥ 48 × 48.
- Uji dengan VoiceOver (iOS), TalkBack (Android), pembaca layar HarmonyOS, dan pembaca layar peramban pada host Web; catat hasilnya di PoC produk (ADR-0146 §2.7).

## Tata letak responsif

Tata letaknya berupa satu kolom yang melebar: kolom flex, lebar persentase, tanpa lebar halaman yang tetap. Ponsel dan tablet merender pohon yang sama; di Web dan desktop, host yang menentukan viewport-nya (halaman web mengatur `width=device-width`, jendela desktop memiliki ukuran minimum). Produk yang memerlukan tata letak dua panel untuk tablet/desktop bercabang berdasarkan `SystemInfo.pixelWidth / pixelRatio` di dalam layar, bukan per host.

## Bahasa

String berada di `packages/app/src/i18n.ts`; Bahasa Indonesia adalah default dan bahasa Inggris menjadi cadangan. String baru ditambahkan ke kedua tabel dalam perubahan yang sama (tabel `id` bertipe `Record<MessageKey, string>`, sehingga terjemahan yang hilang menggagalkan `tsc`). Tanggal menggunakan `formatDateTime()` dan uang menggunakan `formatMoney()` — keduanya tanpa `Intl`, yang tidak tersedia di background thread Lynx.

## Aturan UX

- Jangan pernah mengklaim lebih dari yang dikatakan server: layar permintaan OTP menyatakan bahwa kode sedang dikirim *jika* akun ada, karena backend menjawab secara netral.
- Galat berupa satu kalimat yang dapat ditindaklanjuti dari `describeError()`; pesan mentah dari server tidak pernah ditampilkan.
- Keluar selalu berhasil secara lokal, bahkan saat luring (offline).
- Layar Pengaturan menyampaikan kebenaran tentang tempat sesi disimpan.
