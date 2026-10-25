import '@lynx-js/preact-devtools';
import '@lynx-js/react/debug';
import { startApp } from '@awcms-lynx/app';
import { BUILD_DEFAULTS } from './build-env.ts';

startApp(BUILD_DEFAULTS);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
