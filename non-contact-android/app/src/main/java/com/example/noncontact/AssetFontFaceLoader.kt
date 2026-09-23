package com.example.noncontact

import android.graphics.Typeface
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.fontface.FontFace
import com.lynx.tasm.loader.LynxFontFaceLoader

// Public, documented Lynx extension point (com.lynx.tasm.loader.LynxFontFaceLoader,
// shipped in the core `lynx` artifact — no extra dependency) for resolving custom
// @font-face src schemes. Without a registered Loader, Lynx's own default
// (LynxFontFaceLoader$1, decompiled from lynx-4.1.0.aar) is a no-op that never
// resolves "asset:///" — confirmed by inspecting FontFaceManager's bytecode:
// asset:/// is only handled inline inside loadTypeface() when a "FONT"
// LynxResourceProvider is registered (which we don't have), and prefetchFont()'s
// non-http/non-data: branch (prefetchFontWithLoader) goes ONLY through this
// Loader, with no built-in asset:/// fallback of its own.
//
// Used together with NoopGenericResourceFetcher (data: URIs) so both the
// asset:/// path (JetBrains Mono in assets/fonts/) and any inlined data:
// font resolve on the fast FontFaceManager path — see issue #9431.
object AssetFontFaceLoader : LynxFontFaceLoader.Loader() {
    private const val ASSET_PREFIX = "asset:///"

    override fun onLoadFontFace(
        context: LynxContext,
        type: FontFace.TYPE,
        src: String,
    ): Typeface? {
        if (!src.startsWith(ASSET_PREFIX)) return null
        return try {
            Typeface.createFromAsset(context.context.assets, src.removePrefix(ASSET_PREFIX))
        } catch (e: Exception) {
            null
        }
    }
}
