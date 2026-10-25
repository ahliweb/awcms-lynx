import { startApp } from '@awcms-lynx/app';
import { BUILD_DEFAULTS } from './build-env.ts';

// No UI lives here: screens, i18n and navigation are in packages/app and are
// shared with every other host. This file only passes the build-time defaults.
startApp(BUILD_DEFAULTS);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
