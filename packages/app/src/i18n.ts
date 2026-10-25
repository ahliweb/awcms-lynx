/**
 * UI strings, English and Indonesian.
 *
 * The AWCMS family ships `en` and `id` at minimum (awcms `src/lib/i18n/locales.ts`).
 * A plain typed dictionary instead of gettext: the Lynx background thread has
 * no `Intl`, the catalogue is small, and a missing key must fail `tsc`, not
 * render a raw msgid on a phone. `id` is the default locale — the family's
 * users are Indonesian first.
 */
import type { AppLocale } from '@awcms-lynx/platform';

const en = {
  'app.loading': 'Loading…',
  'app.retry': 'Try again',
  'app.configError.title': 'This build is misconfigured',
  'app.configError.body': 'The app cannot start because a setting is invalid:',
  'tab.home': 'Home',
  'tab.search': 'Search',
  'tab.catalog': 'Catalog',
  'tab.account': 'Account',
  'tab.settings': 'Settings',
  'home.title': 'Welcome',
  'home.backend': 'Backend',
  'home.status': 'Server status',
  'home.status.ok': 'Online',
  'home.status.down': 'Unreachable',
  'home.latest': 'Latest updates',
  'home.latest.empty': 'Nothing has been published yet.',
  'home.news': 'News',
  'search.title': 'Search',
  'search.placeholder': 'Search articles and pages',
  'search.submit': 'Search',
  'search.empty': 'No results for “{q}”.',
  'search.more': 'Load more',
  'search.tooLong': 'Use at most 128 characters.',
  'catalog.title': 'Catalog',
  'catalog.empty': 'No products are available yet.',
  'catalog.outOfStock': 'Out of stock',
  'catalog.sold': '{n} sold',
  'catalog.flashSale': 'Flash sale',
  'catalog.notConfigured': 'The storefront origin is not configured for this build.',
  'signIn.title': 'Sign in',
  'signIn.staff.identifier': 'Email or username',
  'signIn.staff.password': 'Password',
  'signIn.staff.submit': 'Sign in',
  'signIn.staff.tenant': 'Choose a workspace',
  'signIn.staff.tenantHint':
    'Your account belongs to more than one workspace. Enter the workspace ID to continue.',
  'signIn.staff.tenantId': 'Workspace ID',
  'signIn.staff.mfa': 'Two-step verification',
  'signIn.staff.mfaHint': 'Enter the 6-digit code from your authenticator app, or a recovery code.',
  'signIn.staff.mfaCode': 'Verification code',
  'signIn.staff.mfaEnrol':
    'Your workspace requires two-step verification. Set it up in the web admin first, then sign in here.',
  'signIn.staff.turnstile':
    'This server requires a browser challenge (Turnstile) to sign in, which a native app cannot complete. Ask your administrator to use the LAN/offline security profile for app sign-in, or sign in on the web.',
  'signIn.customer.email': 'Email',
  'signIn.customer.requestCode': 'Send code',
  'signIn.customer.codeSent':
    'If an account exists for {email}, a 6-digit code is on its way. It is valid for {minutes} minutes.',
  'signIn.customer.code': '6-digit code',
  'signIn.customer.verify': 'Verify',
  'signIn.customer.changeEmail': 'Use another email',
  'signIn.customer.register': 'Create an account',
  'signIn.customer.name': 'Full name',
  'signIn.customer.phone': 'Phone number',
  'signIn.back': 'Back',
  'account.title': 'Account',
  'account.signedInAs': 'Signed in as',
  'account.roles': 'Roles',
  'account.expires': 'Session expires',
  'account.assurance': 'Assurance level',
  'account.orders': 'Your orders',
  'account.orders.empty': 'You have no orders yet.',
  'account.signOut': 'Sign out',
  'account.level': 'Member level',
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.host': 'Host',
  'settings.transport': 'Bridge transport',
  'settings.storage': 'Session storage',
  'settings.storage.weak': 'Not hardware-backed: do not use this host for production sign-in.',
  'settings.storage.browser': 'Kept in this browser profile. Sign out on shared computers.',
  'settings.version': 'App version',
  'settings.apiBase': 'API base URL',
  'settings.tenant': 'Tenant',
  'settings.tenant.none': 'chosen at sign-in',
  'settings.environment': 'Environment',
  'error.network': 'Cannot reach the server. Check your connection and try again.',
  'error.timeout': 'The server took too long to answer. Try again.',
  'error.rateLimited': 'Too many attempts. Try again in {seconds} seconds.',
  'error.rateLimitedNoWait': 'Too many attempts. Try again in a moment.',
  'error.invalidCredentials': 'The sign-in details are not correct.',
  'error.otpInvalid': 'That code is not valid or has expired. Request a new one.',
  'error.accountNotFound': 'No account uses this email. Create one instead.',
  'error.accountBlocked': 'This account is blocked. Contact the store.',
  'error.passwordLoginDisabled': 'Password sign-in is turned off for this workspace.',
  'error.validation': 'Some fields are not valid. Check them and try again.',
  'error.signedOut': 'Your session has ended. Sign in again.',
  'error.forbidden': 'You do not have access to this.',
  'error.server': 'The server could not complete the request ({code}).',
  'error.config': 'This feature is not available in this build ({code}).',
  'error.unknown': 'Something went wrong. Try again.',
} as const;

export type MessageKey = keyof typeof en;

const id: Record<MessageKey, string> = {
  'app.loading': 'Memuat…',
  'app.retry': 'Coba lagi',
  'app.configError.title': 'Konfigurasi build ini salah',
  'app.configError.body': 'Aplikasi tidak bisa dimulai karena ada pengaturan yang tidak valid:',
  'tab.home': 'Beranda',
  'tab.search': 'Cari',
  'tab.catalog': 'Katalog',
  'tab.account': 'Akun',
  'tab.settings': 'Pengaturan',
  'home.title': 'Selamat datang',
  'home.backend': 'Backend',
  'home.status': 'Status server',
  'home.status.ok': 'Daring',
  'home.status.down': 'Tidak terjangkau',
  'home.latest': 'Kabar terbaru',
  'home.latest.empty': 'Belum ada yang diterbitkan.',
  'home.news': 'Berita',
  'search.title': 'Cari',
  'search.placeholder': 'Cari artikel dan halaman',
  'search.submit': 'Cari',
  'search.empty': 'Tidak ada hasil untuk “{q}”.',
  'search.more': 'Muat lebih banyak',
  'search.tooLong': 'Gunakan paling banyak 128 karakter.',
  'catalog.title': 'Katalog',
  'catalog.empty': 'Belum ada produk.',
  'catalog.outOfStock': 'Stok habis',
  'catalog.sold': '{n} terjual',
  'catalog.flashSale': 'Flash sale',
  'catalog.notConfigured': 'Origin storefront belum dikonfigurasi untuk build ini.',
  'signIn.title': 'Masuk',
  'signIn.staff.identifier': 'Email atau nama pengguna',
  'signIn.staff.password': 'Kata sandi',
  'signIn.staff.submit': 'Masuk',
  'signIn.staff.tenant': 'Pilih ruang kerja',
  'signIn.staff.tenantHint':
    'Akun Anda terdaftar di lebih dari satu ruang kerja. Masukkan ID ruang kerja untuk melanjutkan.',
  'signIn.staff.tenantId': 'ID ruang kerja',
  'signIn.staff.mfa': 'Verifikasi dua langkah',
  'signIn.staff.mfaHint': 'Masukkan kode 6 digit dari aplikasi autentikator, atau kode pemulihan.',
  'signIn.staff.mfaCode': 'Kode verifikasi',
  'signIn.staff.mfaEnrol':
    'Ruang kerja Anda mewajibkan verifikasi dua langkah. Aktifkan dulu di admin web, lalu masuk di sini.',
  'signIn.staff.turnstile':
    'Server ini mewajibkan tantangan browser (Turnstile) untuk masuk, yang tidak bisa diselesaikan aplikasi native. Minta administrator memakai profil keamanan LAN/offline untuk login aplikasi, atau masuk lewat web.',
  'signIn.customer.email': 'Email',
  'signIn.customer.requestCode': 'Kirim kode',
  'signIn.customer.codeSent':
    'Jika ada akun untuk {email}, kode 6 digit sedang dikirim. Berlaku {minutes} menit.',
  'signIn.customer.code': 'Kode 6 digit',
  'signIn.customer.verify': 'Verifikasi',
  'signIn.customer.changeEmail': 'Pakai email lain',
  'signIn.customer.register': 'Buat akun',
  'signIn.customer.name': 'Nama lengkap',
  'signIn.customer.phone': 'Nomor telepon',
  'signIn.back': 'Kembali',
  'account.title': 'Akun',
  'account.signedInAs': 'Masuk sebagai',
  'account.roles': 'Peran',
  'account.expires': 'Sesi berakhir',
  'account.assurance': 'Tingkat jaminan',
  'account.orders': 'Pesanan Anda',
  'account.orders.empty': 'Anda belum punya pesanan.',
  'account.signOut': 'Keluar',
  'account.level': 'Level member',
  'settings.title': 'Pengaturan',
  'settings.language': 'Bahasa',
  'settings.host': 'Host',
  'settings.transport': 'Transport bridge',
  'settings.storage': 'Penyimpanan sesi',
  'settings.storage.weak':
    'Tidak didukung perangkat keras: jangan pakai host ini untuk login produksi.',
  'settings.storage.browser':
    'Disimpan di profil browser ini. Keluar setelah memakai komputer bersama.',
  'settings.version': 'Versi aplikasi',
  'settings.apiBase': 'URL dasar API',
  'settings.tenant': 'Tenant',
  'settings.tenant.none': 'dipilih saat masuk',
  'settings.environment': 'Lingkungan',
  'error.network': 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.',
  'error.timeout': 'Server terlalu lama menjawab. Coba lagi.',
  'error.rateLimited': 'Terlalu banyak percobaan. Coba lagi dalam {seconds} detik.',
  'error.rateLimitedNoWait': 'Terlalu banyak percobaan. Coba lagi sebentar lagi.',
  'error.invalidCredentials': 'Data masuk tidak benar.',
  'error.otpInvalid': 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru.',
  'error.accountNotFound': 'Belum ada akun dengan email ini. Buat akun baru.',
  'error.accountBlocked': 'Akun ini diblokir. Hubungi toko.',
  'error.passwordLoginDisabled': 'Login dengan kata sandi dimatikan untuk ruang kerja ini.',
  'error.validation': 'Ada isian yang tidak valid. Periksa lalu coba lagi.',
  'error.signedOut': 'Sesi Anda berakhir. Silakan masuk lagi.',
  'error.forbidden': 'Anda tidak punya akses ke sini.',
  'error.server': 'Server tidak dapat menyelesaikan permintaan ({code}).',
  'error.config': 'Fitur ini tidak tersedia di build ini ({code}).',
  'error.unknown': 'Terjadi kesalahan. Coba lagi.',
};

export const MESSAGES: Record<AppLocale, Record<MessageKey, string>> = { en, id };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function createTranslator(locale: AppLocale): Translate {
  const table = MESSAGES[locale];
  return (key, vars) => {
    const template = table[key] ?? MESSAGES.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/** Formats an ISO timestamp as `YYYY-MM-DD HH:mm` in the device's offset, without Intl. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
