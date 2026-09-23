package com.example.noncontact

import android.content.Context
import android.util.Log
import com.lynx.tasm.provider.AbsTemplateProvider
import java.io.IOException

/**
 * Reads the Lynx bundle (and lazy-bundle chunks from dynamic import()) from
 * assets on a separate thread.
 *
 * Measured on real hardware: reading the same asset SYNCHRONOUSLY in
 * MainActivity.onCreate() (blocking Android's UI thread — distinct from Lynx's
 * internal main/background thread split, but just as harmful to the first
 * frame) cost 2.4-2.8s of cold start under `adb shell am start -W`; with this
 * async provider, ~300ms. This is not optional.
 */
class AssetTemplateProvider(private val context: Context) : AbsTemplateProvider() {
    override fun loadTemplate(url: String, callback: Callback) {
        Thread {
            try {
                val assetPath = normalizeAssetPath(url)
                Log.i(TAG, "loadTemplate url=$url assetPath=$assetPath")
                val bytes = context.assets.open(assetPath).use { it.readBytes() }
                callback.onSuccess(bytes)
            } catch (e: IOException) {
                Log.e(TAG, "loadTemplate failed url=$url", e)
                callback.onFailed(e.toString())
            }
        }.start()
    }

    companion object {
        private const val TAG = "NonContactAssets"

        /**
         * Lynx may request `lazy-bundle/foo.bundle`, `/lazy-bundle/foo.bundle`,
         * or a file:// / http(s) URL. Assets only accept a relative path.
         */
        fun normalizeAssetPath(url: String): String {
            var path = url.trim()
            when {
                path.startsWith("file:///android_asset/") ->
                    path = path.removePrefix("file:///android_asset/")
                path.startsWith("asset:///") ->
                    path = path.removePrefix("asset:///")
                path.startsWith("asset://") ->
                    path = path.removePrefix("asset://")
            }
            // Strip a leading slash so assets.open("lazy-bundle/...") works.
            while (path.startsWith("/")) path = path.substring(1)
            return path
        }
    }
}
