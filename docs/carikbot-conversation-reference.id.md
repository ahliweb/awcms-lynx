🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](carikbot-conversation-reference.md)

# Referensi CarikBot — UI Percakapan Aman Netral-Kanal

**Versi dokumen** v1.1.0 | **Tanggal** 2026-11-20 | **Status** Referensi desain F0, **usulan saja**: tidak menyiratkan kode runtime, API yang dikirim, atau paritas platform, dan setiap adopsi di bawah tetap usulan sampai gerbang 9 (cross-spec Definition of Ready) di repositori ini.
**Changeset** Diperiksa ulang terhadap `main` setelah validasi kontrak 20 November 2026: redaksi status terkini dan rujukan silang ditambahkan, klaim kepemilikan produk lain yang tak dapat diverifikasi dihapus; cermin bahasa Indonesia ditulis ulang sebagai terjemahan setia.

## Referensi terverifikasi dan batasannya
[Ekosistem CarikBot](https://github.com/CarikBot/ecosystem) menjelaskan pohon interaksi dari mind-map ke JSON, manifes kategori/paket, dan respons generik teks/menu/tombol/formulir. [Spesifikasi API](https://github.com/CarikBot/ecosystem/blob/main/docs/api-structure.md) memuat metadata kanal/pengguna, callback aksi, dan handler formulir. [Mesin Carik](https://github.com/luridarmawan/Carik) menjelaskan SimpleBOT/SimpleAI yang lebih lama, FastPlaz, dan handler Pascal. Manifes npm ekosistem mencantumkan MIT, tetapi [LICENSE.txt](https://github.com/luridarmawan/Carik/blob/master/LICENSE.txt) mesinnya tidak memberi izin eksplisit untuk memakai ulang kode mesin. **Ambil gagasan arsitektur saja**; jangan mengimpor kode atau mengasumsikan kompatibilitas operasional. Skrip tes ekosistem hanyalah placeholder, jadi tidak ada paritas kualitas yang diaudit.

## Kontrak kandidat, belum diimplementasikan
- Response.kind: text | choice | typed_form | handoff | status; dapat menyertakan teks yang disetujui dan padanan aksesibilitas.
- Sebuah choice berisi label yang dapat dibaca manusia dan **token transisi opaque bertanda tangan berumur pendek**, tidak pernah perintah bot mentah atau URL penyedia.
- Form digerakkan oleh JSON Schema ber-versi milik server; validasi input juga dilakukan di server; persetujuan (consent) dan pembatalan eksplisit.
- Pemeta kapabilitas penyedia memilih tombol, daftar, tautan, atau fallback teks bernomor, dan tidak pernah menyatakan sebuah penyedia mendukung suatu elemen berdasarkan antarmuka penyedia lain.
- Baca/tulis domain HARUS berupa operasi bernama yang terautentikasi lewat API backend kanonis yang sudah ada. UI klien/penyedia tidak dapat memberi akses, membuat mutasi pembayaran, atau mengirim kampanye secara mandiri.
- Saran yang dihasilkan AI hanyalah draf tak tepercaya. Persetujuan manusia / kebijakan risiko rendah yang disetujui sebelumnya dan otorisasi penyedia+consent yang segar tetap wajib sebelum pesan keluar apa pun.
- Semua konten di-escape, rendering HTML dibatasi, dan tautan tak tepercaya divalidasi. Tidak ada POST ke URL callback sembarang/SSRF.
- Tidak ada data lintas-tenant, rahasia, kata sandi, SQL mentah, bearer token penyedia, .env, cookie sesi, atau isi percakapan yang tidak disamarkan di log, konteks alat, telemetri, atau tangkapan layar.

~~~json
{
  "version":"1.0.0",
  "response":{"kind":"choice","text":"What do you need?",
     "choices":[{"label":"Support","transition_token":"signed-opaque-ref"}]},
  "fallback":{"kind":"text","text":"Reply 1 for Support"},
  "correlation_id":"uuid"
}
~~~

## Kepemilikan, tata kelola, dan status
**Ada saat ini:** hanya perilaku yang secara eksplisit ada di berkas repositori saat ini dan lingkungan uji yang terverifikasi yang dianggap sudah dikirim. **Diusulkan:** kontrak respons dalam referensi ini adalah kandidat, bukan skema OpenAPI yang diterbitkan. **Eksternal:** rekaman tenant dan kanonis, persetujuan, dan kebijakan pengirim milik backend (`awcms` atau `awcms-one`); runtime agen atau kanal penyedia apa pun milik produknya sendiri dan berada di luar repositori ini. Aplikasi turunan tidak mengambil kepemilikan kredensial penyedia atau sistem data bisnis baru.

## Ancaman dan tes negatif yang diwajibkan
| Ancaman | Tes/penerimaan |
|---|---|
| Markup yang disuntikkan, tautan berbahaya | Escape label/respons, blokir navigasi tak aman atau callback jarak jauh |
| Callback penyedia dipalsukan / token dipakai ulang | Tolak transisi tak valid/kedaluwarsa/cakupan tidak cocok |
| Tenant dan akun salah | Otorisasi/ABAC/RLS backend yang ada menolak operasi |
| Consent dicabut | Aksi keluar di masa depan ditolak walau draf dibuat sebelumnya |
| Submit form ganda | Kunci idempotensi menghasilkan satu transaksi yang diterima |
| Alur tanpa akhir/terlalu dalam | Kedalaman, langkah, ukuran, TTL, dan pembatalan dibatasi |
| Kapabilitas platform tak terduga | Fallback teks yang aksesibel; tanpa kehilangan data |
| Injeksi alat oleh AI | Draf tak dapat dieksekusi; allowlist alat dan persetujuan manusia/domain eksplisit |
| Gangguan jaringan | Loading/retry/pembatalan aman yang eksplisit, tidak pernah sukses palsu |
| Pencatatan data sensitif | Hanya metadata dan correlation ID; tanpa kebocoran isi pribadi |

## Tujuh+ alur uji
1. FAQ publik -> jawaban yang disetujui; tidak meminta data sensitif.
2. Menu dengan tiga pilihan -> penyedia mendukung tombol; semua pilihan terpetakan dengan benar.
3. Tombol tidak didukung -> fallback teks bernomor dan pilihan aksesibel.
4. Survei bertipe -> validasi, consent, pembatalan, dan kebijakan draf tersimpan.
5. Pencarian pesanan -> akun tak berwenang ditolak, pengguna berwenang hanya melihat status miliknya.
6. Handoff -> hanya mempertahankan konteks bercakupan yang disetujui, tidak mengirim aksi berhak istimewa.
7. Consent pesan dicabut -> draf tampil secara privat tetapi tidak pernah dikirim.
8. Callback berbahaya -> ditolak sebelum efek samping apa pun.
9. Lanjut di dua perangkat -> revisi dikunci dan token usang ditolak.
10. Retry jaringan -> tidak ada mutasi domain ganda.

## Standar desain dan syarat hukum
WCAG 2.2 AA untuk web dan semantik aksesibilitas setara pada permukaan native; OWASP ASVS/API Top 10; ISO/IEC 27001, 27002, 27005, 27034, 27701, dan 42001; ISO 20000-1 dan ISO 22301 untuk keamanan/kontinuitas operasional. ISO 27017/27018 bila prosesor PII cloud publik terlibat. ISO/IEC 15408 hanya bila target evaluasi formal terpisah didefinisikan. UU 27/2022 PDP dan PP 71/2019 PSTE berlaku sesuai peran/cakupan hukum; Perpres 95/2018 SPBE dapat berlaku untuk produk pemerintah. Jangan menyimpulkan kepatuhan hukum hanya karena dokumentasi mengutip sebuah standar.

**Gerbang rilis:** standar lintas-portofolio internal mensyaratkan perencanaan pengembangan 18 langkah, Definition of Ready lintas-spesifikasi oleh manusia (langkah 9), issue/PR atomik dan tes terverifikasi, staging dan UAT, lalu Go/No-Go oleh manusia (langkah 15). Dokumen riset saja tidak mengotorisasi deployment produksi.


## Batas khusus: klien persona LynxJS, tanpa kepemilikan backend produk

**Issue pemilik:** https://github.com/ahliweb/awcms-lynx/issues/11. Status terverifikasi saat ini: [status.md](status.md). Repositori menyediakan API klien dan jembatan host dengan tes terdokumentasi; menurut [contract-validation-2026-11.md](contract-validation-2026-11.md) (20 November 2026) tidak satu pun tes itu menyentuh backend live, dan tidak ada operasi respons-percakapan semacam itu di antara operasi yang dicakup validasi tersebut, sehingga kontrak di atas belum memiliki padanan server yang terverifikasi. Host native Android, iOS, dan HarmonyOS **belum terverifikasi** ujung ke ujung. Jangan mengklaim paritas semua native atau menyertakan rahasia penyedia.

### Pemetaan renderer yang diusulkan
| Kontrol percakapan | Klien LynxJS | Syarat host native |
|---|---|---|
| teks/menu | teks aman, daftar pilihan aksesibel | tanpa API berhak istimewa tambahan |
| tombol/tautan | navigasi dapat ditekan berlabel | allowlist origin dan deep link |
| form bertipe | validasi field ber-versi dan fokus | semantik tanggal/keyboard host opsional |
| handoff manusia | tiket/status API terotorisasi | tanpa runtime agen lokal |
| lampiran | hanya kapabilitas host yang disetujui di masa depan | tinjauan izin dan privasi lebih dulu |
| draf tersimpan | state klien minimum yang dibatasi | server memiliki state workflow kanonis |

### Bukti host/platform
Bukti kontrak Web dan desktop headless ada, tetapi Android/iOS/HarmonyOS saat ini hanya memiliki sumber referensi tanpa verifikasi perangkat native lengkap, menurut [status.md](status.md). Jangan memperkenalkan kontrol platform baru sebelum ada versi kontrak host dan bukti tes khusus perangkat. Lynx untuk Web adalah evaluasi kompatibilitas terpisah. API server memvalidasi setiap aksi; validasi di sisi klien hanya untuk kegunaan.

### Penerimaan
1. Renderer lolos tes unit terhadap fixture respons bertipe sintetis.
2. Kapabilitas native hilang -> teks aman atau affordance dinonaktifkan, tidak pernah sukses palsu.
3. Pengguna/tenant salah -> 403 dari backend dan state sementara lokal dibersihkan sesuai kebijakan.
4. Pembatalan dan lanjut tidak membocorkan data pribadi lewat log, tangkapan layar, atau akses berkas lokal.
5. Status Android, iOS, dan HarmonyOS masing-masing menyatakan VERIFIED/UNVERIFIED dengan lingkungan yang dapat direproduksi.
6. Token transisi kedaluwarsa memicu alur aman baru, bukan pemutaran ulang otomatis.
7. Input antrean offline tidak pernah menghasilkan transaksi ireversibel ganda.
8. Aksesibilitas mencakup fokus, tipe input, dan fallback yang terbaca.

Jangan mengubah aplikasi persona produksi, build rilis, atau dependensi runtime sebagai bagian dari issue riset ini.

## Changelog
- v1.1.0 (2026-11-20): Diperiksa ulang terhadap `main`: rujukan silang status dan validasi kontrak, klaim kepemilikan dibatasi pada yang dapat diverifikasi repositori ini, status usulan dinyatakan, cermin bahasa Indonesia ditulis ulang agar sesuai struktur bahasa Inggris.
- v1.0.0 (2026-11-10): Cakupan riset, kontrak kandidat, ancaman, penerimaan; nol perubahan runtime.
