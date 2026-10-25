// Lynx injects `NativeModules` into the background thread. Declared loosely
// here so this package type-checks without depending on @lynx-js/types; the
// app package gets the precise declaration from @lynx-js/types.
declare const NativeModules: unknown;
