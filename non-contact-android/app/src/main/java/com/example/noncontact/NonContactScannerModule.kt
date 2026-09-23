package com.example.noncontact

import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.behavior.LynxContext

/**
 * Lynx native module that opens the QR scanner and sends results back to JS
 * via LynxContext.sendGlobalEvent() → JS GlobalEventEmitter.
 *
 * Registered on the LynxView in MainActivity, reachable from JS as
 * `NativeModules.NonContactScannerModule.startScan()`.
 *
 * JS receives results via:
 *   const emitter = lynx.getJSModule("GlobalEventEmitter");
 *   emitter.addListener("scanResult", (data) => { ... });
 */
class NonContactScannerModule(context: android.content.Context) : LynxModule(context) {

    companion object {
        private const val TAG = "NonContactScanner"
    }

    private val lynxContext: LynxContext = context as LynxContext
    private var pendingScan = false

    @LynxMethod
    fun startScan() {
        if (pendingScan) {
            Log.d(TAG, "Scan already in progress — ignoring duplicate call")
            return
        }

        val activity = lynxContext.activity
        if (activity !is ComponentActivity) {
            sendError("Actividad no disponible")
            return
        }

        if (ContextCompat.checkSelfPermission(activity, android.Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            launchScanner(activity)
        } else {
            pendingScan = true
            val launcher = activity.activityResultRegistry.register(
                "scanner_camera_perm_${hashCode()}",
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                pendingScan = false
                if (granted) {
                    launchScanner(activity)
                } else {
                    sendError("Permiso de cámara denegado")
                }
            }
            launcher.launch(android.Manifest.permission.CAMERA)
        }
    }

    private fun launchScanner(activity: ComponentActivity) {
        pendingScan = true
        val launcher = activity.activityResultRegistry.register(
            "scanner_activity_${hashCode()}",
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            pendingScan = false
            if (result.resultCode == android.app.Activity.RESULT_OK) {
                val phone = result.data?.getStringExtra(ScannerActivity.EXTRA_PHONE)
                if (phone != null) {
                    sendPhone(phone)
                } else {
                    sendError("No se pudo leer el número")
                }
            }
            // RESULT_CANCELED: user closed scanner — do nothing
        }
        val intent = android.content.Intent(activity, ScannerActivity::class.java)
        launcher.launch(intent)
    }

    private fun sendPhone(phone: String) {
        val map = JavaOnlyMap()
        map.putString("phone", phone)
        lynxContext.sendGlobalEvent("scanResult", JavaOnlyArray.of(map))
    }

    private fun sendError(message: String) {
        val map = JavaOnlyMap()
        map.putString("error", message)
        lynxContext.sendGlobalEvent("scanResult", JavaOnlyArray.of(map))
    }
}
