package com.example.noncontact

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

/**
 * Lynx ships no built-in "open an external app/URL" API, so this is a
 * hand-written native module (same approach as NonContactStorageModule).
 *
 * Registered on the LynxView in MainActivity via LynxViewBuilder.registerModule,
 * reachable from JS as `NativeModules.NonContactIntentModule.openWhatsApp(phone)`.
 * `phone` must already be digits only (country code + number, no "+").
 */
class NonContactIntentModule(private val context: Context) : LynxModule(context) {
    @LynxMethod
    fun openWhatsApp(phone: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}
