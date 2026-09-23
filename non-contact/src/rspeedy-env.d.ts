/// <reference types="@lynx-js/rspeedy/client" />
/// <reference types="@lynx-js/types" />
/// <reference types="@lynx-js/type-element-api" />

// non-contact-android's NonContactStorageModule.kt — persistent key-value
// store registered via LynxViewBuilder.registerModule() (see MainActivity.kt).
declare module "@lynx-js/types" {
  interface NativeModules {
    NonContactStorageModule?: {
      get(key: string): string | null;
      set(key: string, value: string): void;
    };
    NonContactIntentModule?: {
      openWhatsApp(phone: string): void;
    };
  }
}
