package com.example.noncontact

import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.tasm.LynxBooleanOption
import com.lynx.tasm.LynxViewBuilder
import com.lynx.tasm.ThreadStrategyForRendering
import com.lynx.xelement.XElementBehaviors

class MainActivity : AppCompatActivity() {
    companion object {
        // Android back button bridge (mithril-lynx route.listenBackButton):
        // disabled until JS reports there is history to go back to, so at the
        // first screen Android's default applies and back closes the app.
        // Toggled by NonContactNavModule.setCanGoBack().
        var backCallback: OnBackPressedCallback? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Must run BEFORE super.onCreate() — a Splash Screen API requirement.
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val builder = LynxViewBuilder()
        // <input>/<textarea> are opt-in "xelement" components, not part of the
        // core artifact: without this they measure 0 and never open the
        // keyboard. Remove this line (and the xelement dependencies) if you
        // don't use them.
        builder.addBehaviors(XElementBehaviors().create())
        builder.registerModule("NonContactIntentModule", NonContactIntentModule::class.java)
        // Theme persistence for non-contact/src/index.ts — see NonContactStorageModule.
        builder.registerModule("NonContactStorageModule", NonContactStorageModule::class.java)
        // QR scanner — opens camera, validates phone-only QR, returns result to Lynx.
        builder.registerModule("NonContactScannerModule", NonContactScannerModule::class.java)
        // Back button — tells this activity whether the in-app history can go back.
        builder.registerModule("NonContactNavModule", NonContactNavModule::class.java)
        // lynx-family/lynx's own explorer/android registers a
        // GenericResourceFetcher unconditionally (LynxViewShellActivity —
        // "used inside LynxEngine for resource loading capabilities of
        // components such as Text"). Without one, @font-face / addFont
        // data: URIs fall back to a ~1.4-1.5s legacy path — see
        // NoopGenericResourceFetcher and https://github.com/lynx-family/lynx/issues/9431
        builder.setEnableGenericResourceFetcher(LynxBooleanOption.TRUE)
        builder.setGenericResourceFetcher(NoopGenericResourceFetcher())
        builder.setThreadStrategyForRendering(ThreadStrategyForRendering.ALL_ON_UI)
        // Reads the bundle from assets on a separate thread — see
        // AssetTemplateProvider's comment: reading it synchronously here cost
        // 2.4-2.8s of cold start measured on a real device, vs ~300ms with this.
        builder.setTemplateProvider(AssetTemplateProvider(this))
        val lynxView = builder.build(this)
        setContentView(lynxView)

        // The bundle lives in app/src/main/assets/main-thread.bundle, copied
        // there by `npm run android` (scripts/android.mjs) from the JS
        // project's dist/. The name has to match exactly.
        lynxView.renderTemplateUrl("main-thread.bundle", "")

        // Forwards the back button to mithril-lynx/route while there is
        // in-app history (see backCallback above and src/background.ts).
        val callback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                lynxView.sendGlobalEvent("mithrilLynx:back", JavaOnlyArray())
            }
        }
        onBackPressedDispatcher.addCallback(this, callback)
        backCallback = callback
    }

    override fun onDestroy() {
        backCallback = null
        super.onDestroy()
    }
}
