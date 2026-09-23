package com.example.noncontact

import android.content.Context
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule

/**
 * Persistent key-value store for the background bundle, backed by
 * SharedPreferences. Lynx has no built-in storage API — same gap as
 * indicadores-android's IndicadoresStorageModule — so this is a hand-written
 * native module registered on the LynxView.
 *
 * Reachable from JS as `NativeModules.NonContactStorageModule.get(key)` /
 * `.set(key, value)` (synchronous).
 */
class NonContactStorageModule(context: Context) : LynxModule(context) {
    private val prefs = context.getSharedPreferences("non_contact_storage", Context.MODE_PRIVATE)

    @LynxMethod
    fun get(key: String): String? = prefs.getString(key, null)

    @LynxMethod
    fun set(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }
}
