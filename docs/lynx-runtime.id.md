🇮🇩 Bahasa Indonesia · 🇬🇧 [English (sumber)](lynx-runtime.md)

# Runtime Lynx, sebagaimana repositori ini menggunakannya

Fakta tentang Lynx yang membentuk kode, beserta tempat ia diverifikasi. Lynx engine 4.0 (Explorer release 4.0.0), `@lynx-js/react` 0.129.0, `@lynx-js/rspeedy` 0.18.3, `@lynx-js/web-core` 0.26.5, Lynxtron 0.0.30.

| Fakta | Konsekuensi di sini | Diverifikasi di |
| --- | --- | --- |
| UI dirender di thread utama; efek, handler event, dan `fetch` berjalan di background thread | kode klien dan bridge adalah kode background-thread | lynx-website `docs/en/react/thinking-in-reactlynx.mdx` |
| Global background-thread: `fetch`/`Request`/`Response`/`Headers`, `setTimeout`/`setInterval`, `queueMicrotask`, `TextEncoder`/`TextDecoder`, `console`, `SystemInfo`, `NativeModules`, `lynx` | tidak ada `URL`, `URLSearchParams`, `AbortController` (dideteksi fitur), `crypto` (dideteksi fitur), `Intl`, `localStorage` | `@lynx-js/types` 4.3.0 `types/background-thread/*.d.ts` |
| `fetch` Lynx native tidak memiliki CORS, redirect/keepalive, FormData/Blob | panggilan native tidak memerlukan CORS; unggahan memerlukan jalur lain | lynx-website `docs/en/api/lynx-api/global/fetch.mdx` |
| Di Web, `fetch` adalah milik peramban | CORS berlaku untuk Lynx for Web | sama |
| `SystemInfo.platform` ∈ `Android`, `iOS`, `Harmony`, `windows`, `macOS` | jenis host berasal dari `app.info`, bukan dari tebakan | `@lynx-js/types` `common/system-info.d.ts` |
| `lynx.__globalProps` membawa nilai yang disediakan host; diberi tipe dengan menambah `GlobalProps` | penimpaan konfigurasi runtime (`apps/mobile/src/env.d.ts`) | `background-thread/lynx.d.ts` |
| `<lynx-view>` menyediakan `globalProps`, `onNativeModulesCall(name, data, moduleName)`, `nativeModulesMap`, `url` | penyambungan `apps/web` | `@lynx-js/web-core` `dist/client/mainthread/LynxView.d.ts` |
| Lynxtron meneruskan `NativeModules.bridge.call` ke proses utama sebagai `-lynx-invoke` | proses utama `apps/desktop` menjawab kontrak | templat `create-lynxtron` 0.0.30 |
| Rspeedy `environments: { lynx: {}, web: {} }` menghasilkan `main.lynx.bundle` dan `main.web.bundle` | satu build, dua artefak | lynx-website `docs/en/guide/start/fragments/web/integrating-lynx-with-web.mdx`, dikonfirmasi oleh `bun run build:mobile` |
| Rspeedy memuat `.env*` dan menyisipkan `PUBLIC_*` sebagai `import.meta.env.*` | `apps/mobile/src/build-env.ts` | `@lynx-js/rspeedy` `createRspeedy({ loadEnv = true })` |
| Encoder templat membuang CSS yang tidak didukung (misalnya `text-transform`) dengan peringatan build | jaga agar build bebas peringatan | keluaran `bun run build:mobile` |
| Transformasi pengujian ReactLynx mengurai berkas `.ts` seperti TSX, sehingga fungsi panah generik `<T>(…) =>` gagal | tulis helper generik sebagai `function name<T>()` | eksekusi Rstest `apps/mobile` |
| Rspeedy, Rstest, dan Lynxtron berjalan di bawah Node (≥ 20.19 / 22.18) | ADR-0002 | quick start lynx-website, pengantar Lynxtron |

Saat meningkatkan paket Lynx, periksa ulang tabel ini dan sebutkan di dalam changeset baris mana yang berubah.
