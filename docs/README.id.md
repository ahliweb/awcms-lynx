🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](README.md)

# Dokumentasi

| Halaman | Baca saat |
| --- | --- |
| [`architecture.md`](architecture.md) | Anda memerlukan gambaran besar: lapisan, thread, boot, routing, data yang disimpan, dan siapa memiliki tanggung jawab atas apa |
| [`backend-integration.md`](backend-integration.md) | Anda memanggil atau mengubah API: setiap endpoint, header, dan galat per backend, CORS, serta kekurangan backend |
| [`lynx-runtime.md`](lynx-runtime.md) | Anda menulis kode yang berjalan di Lynx: apa yang dimiliki dan tidak dimiliki runtime, beserta sumbernya |
| [`security.md`](security.md) | Anda menyentuh sesi, host, konfigurasi, atau data pribadi; pemetaan standar |
| [`ui-guidelines.md`](ui-guidelines.md) | Anda membangun layar: elemen, komponen, token dan kontras, aksesibilitas, tata letak responsif, bahasa |
| [`testing.md`](testing.md) | Anda menambah atau menjalankan pengujian |
| [`deployment.md`](deployment.md) | Anda merilis target: iOS, Android, HarmonyOS, Web, macOS, Windows |
| [`development.md`](development.md) | Anda menyiapkan lingkungan, menjalankan alur harian, membuka pull request, atau menerbitkan rilis |
| [`status.md`](status.md) | Anda perlu tahu apa yang sudah terverifikasi per target dan apa yang belum |
| [`adr/`](adr/README.md) | Anda ingin tahu mengapa sesuatu dibuat seperti itu |
| [`../hosts/README.md`](../hosts/README.md) | Anda membangun host native |

## Cakupan checklist dokumentasi

Templat klien tidak memiliki tanggung jawab sisi server sendiri; baris-baris di bawah ini menunjuk ke lokasi tempat tanggung jawab tersebut berada.

| Topik | Lokasi |
| --- | --- |
| Arsitektur | `architecture.md`, ADR-0001…0004 |
| Skema database / kamus data | `architecture.md` §Data yang disimpan klien (dua rekaman penyimpanan aman); skema server berada di repositori backend |
| Dokumentasi API | `backend-integration.md`, `../packages/client/README.md` |
| CMS / manajemen konten, alur publikasi, taksonomi konten | `architecture.md` §Lokasi setiap tanggung jawab — konten dikelola dan dipublikasikan di admin Astro milik backend; aplikasi hanya membaca konten yang sudah dipublikasikan (feed, pencarian situs dengan filter `type`, berita storefront `rubrik`/`region`) |
| Izin dan otorisasi | `security.md`, `architecture.md` — diputuskan oleh backend (RBAC + ABAC, RLS); aplikasi hanya menampilkan peran |
| Audit log | `architecture.md` — sisi server; klien mengirim `X-Correlation-ID` pada setiap panggilan |
| Manajemen media, manajemen logo | `architecture.md`, `ui-guidelines.md` §Token desain — gambar dirender dari URL API; branding melalui token, nama aplikasi, dan ikon host |
| Routing | `architecture.md` §Routing |
| Periklanan | `architecture.md` — tidak ada di templat |
| SEO | `architecture.md`, `deployment.md` §Web — tidak berlaku untuk aplikasi persona; host web berstatus `noindex`; SEO publik tetap di Astro |
| Aksesibilitas, desain responsif, UI/UX | `ui-guidelines.md` |
| Pengujian | `testing.md` |
| Deployment | `deployment.md`, `../hosts/README.md`, `../apps/web/README.md`, `../apps/desktop/README.md` |
| Alur kerja pengembangan, panduan repositori | `development.md`, `../CONTRIBUTING.md`, `../.changesets/README.md` |
| Instruksi agen, skill | `../AGENTS.md` (termasuk peran orchestrator & agent), `../.claude/agents/`, `../.claude/skills/` |
