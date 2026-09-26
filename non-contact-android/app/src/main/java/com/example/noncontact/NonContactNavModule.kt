package com.example.noncontact

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

/**
 * Android back button bridge for mithril-lynx/route.
 *
 * JS (src/background.ts, route.listenBackButton) calls setCanGoBack() whenever
 * the in-app history changes between "can go back" and "cannot". While it
 * can, MainActivity's OnBackPressedCallback is enabled and forwards the back
 * button to JS as the "mithrilLynx:back" global event; otherwise the callback
 * is disabled and Android's default applies (back closes the app).
 *
 * Registered on the LynxView in MainActivity via LynxViewBuilder.registerModule,
 * reachable from JS as `NativeModules.NonContactNavModule.setCanGoBack(boolean)`.
 */
class NonContactNavModule(context: Context) : LynxModule(context) {
    @LynxMethod
    fun setCanGoBack(canGoBack: Boolean) {
        // Called from the JS thread; the callback belongs to the UI thread.
        Handler(Looper.getMainLooper()).post { MainActivity.backCallback?.isEnabled = canGoBack }
    }
}
