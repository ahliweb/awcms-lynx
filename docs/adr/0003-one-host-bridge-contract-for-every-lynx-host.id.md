🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](0003-one-host-bridge-contract-for-every-lynx-host.md)

# ADR-0003 — Satu kontrak host-bridge untuk setiap host Lynx

- **Status:** Diterima
- **Tanggal:** 25 Oktober 2026
- **Pengambil keputusan:** ahliweb
- **Terkait:** ADR-0001, ADR-0004; `packages/platform/src/contract.ts`

## Konteks

Bundle ReactLynx yang sama berjalan di lima host, dan beberapa kapabilitas hanya bisa berasal dari host: penyimpanan aman untuk token sesi, versi aplikasi, membuka tautan di browser sistem. Lynx mengekspos kapabilitas host sebagai NativeModules, tetapi setiap host menghubungkannya dengan cara yang berbeda: host native iOS/Android/HarmonyOS mendaftarkan modul kustom; `<lynx-view>` di Web meneruskan `NativeModules.bridge.call` ke `onNativeModulesCall`; Lynxtron meneruskannya ke proses utama sebagai `-lynx-invoke`. Background thread Lynx juga tidak memiliki `URL`, `crypto`, dan `localStorage`, sehingga aplikasi tidak dapat membuat polyfill penyimpanan sendiri.

## Keputusan

**D1.** Satu kontrak yang bersifat versioned (`HOST_BRIDGE_VERSION = 1`) dengan lima method — `secureStorage.get|set|delete`, `app.info`, `link.open` — dan satu bentuk wire, `call(method, params, callback(reply))`, di mana `reply` berupa `{ok:true,result}` atau `{ok:false,error:{code,message}}`, baik sebagai objek maupun string JSON-nya.

**D2.** Urutan pencarian di aplikasi: modul native kustom `AwcmsHostBridge` → `NativeModules.bridge` bawaan (Web, Lynxtron) → fallback di memori (Lynx Explorer, unit test). Fallback melaporkan `secureStorage: 'memory'`, dan layar pengaturan menyatakan hal itu.

**D3.** Setiap host memvalidasi input-nya sendiri (namespace kunci `awcms-lynx:*`, nilai ≤ 16 KiB, `link.open` hanya http/https). Aplikasi juga memvalidasi terlebih dahulu, sehingga panggilan yang buruk tidak pernah sampai ke host; pemeriksaan di host adalah pertahanan berlapis untuk bundle yang telah disusupi.

**D4.** `app.info.secureStorage` menyebutkan backend yang sebenarnya (`keychain`, `android-keystore`, `harmony-huks`, `os-keyring`, `app-file`, `browser-storage`, `memory`). Label yang jujur merupakan bagian dari kontrak.

**D5.** Menambahkan method menaikkan `HOST_BRIDGE_VERSION`, menambahkannya ke `HOST_METHODS`, memperbarui `hosts/contract-test-vectors.json` dan setiap host dalam perubahan yang sama.

## Opsi yang dipertimbangkan

| Kriteria | Satu kontrak kecil (dipilih) | Jalur kode per host di aplikasi | Pustaka bridge pihak ketiga |
| --- | --- | --- | --- |
| Keamanan | Satu rangkaian aturan validasi, ditinjau sekali | Mudah terlewat di salah satu host | Permukaan supply chain tambahan |
| Performa | Satu lompatan async per panggilan | Sama | Sama atau lebih buruk |
| Maintainability | Host ditinjau secara terpisah terhadap vector | Percabangan di mana-mana | Terikat pada siklus rilisnya |
| Kompatibilitas | Berfungsi di kelima host dan Explorer | Sama | Jarang mencakup HarmonyOS dan Lynxtron |
| Jangka panjang | Versioned; bersifat aditif | Sulit dikembangkan | Bergantung pada maintainer |

## Konsekuensi

- Host native di `hosts/` merupakan sumber referensi sampai PoC produk turunan mengompilasinya (`docs/status.md`).
- Pengambilan push token, kamera, lokasi, dan routing deep-link **tidak** termasuk dalam v1; masing-masing memerlukan kenaikan kontrak ketika PoC produk membutuhkannya.
