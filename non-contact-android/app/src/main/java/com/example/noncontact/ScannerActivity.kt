package com.example.noncontact

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Full-screen QR scanner that only accepts phone numbers.
 *
 * Uses CameraX + ML Kit Barcode Scanning. On detection, the raw QR value is
 * validated against ^\+?\d{5,15}$ — only pure phone numbers (optional leading
 * "+", digits only, 5-15 chars) are accepted. JSON, URLs, or free text are
 * rejected with haptic feedback and a message in the guide text, and the
 * scanner stays open.
 *
 * A rejected QR used to crash the app: the rejection vibrates, and the
 * manifest lacked android.permission.VIBRATE, so Vibrator.vibrate() threw a
 * SecurityException on the main thread. The permission is declared now, and
 * vibrate() swallows any failure — haptics are a hint, never fatal.
 *
 * A rejected QR also stays in front of the camera frame after frame, so the
 * rejection must not cost anything per frame: one scanner client for the
 * whole activity (not one per frame, which leaked native detectors until
 * the app died), and at most one notice per REJECT_NOTICE_MS (not a toast
 * + vibration per frame, which flooded the toast queue and made the screen
 * look frozen).
 *
 * Returns the validated phone number via setResult(RESULT_OK, intent).
 */
class ScannerActivity : ComponentActivity() {

    companion object {
        const val EXTRA_PHONE = "phone"
        private val PHONE_REGEX = Regex("^\\+?\\d{5,15}\$")
        private const val GUIDE_TEXT = "Apunta al código QR"
        private const val REJECTED_TEXT = "Este QR no contiene un número de teléfono"
        private const val GUIDE_COLOR = 0xFFE0E0E0.toInt()
        private const val REJECTED_COLOR = 0xFFFFB74D.toInt()
        /** How long the rejection notice stays up, and the minimum gap between two notices. */
        private const val REJECT_NOTICE_MS = 2500L
    }

    // Written on the analysis thread, read on both.
    @Volatile private var scanned = false

    private lateinit var guideText: TextView
    private val mainHandler = Handler(Looper.getMainLooper())
    private val restoreGuide = Runnable {
        guideText.text = GUIDE_TEXT
        guideText.setTextColor(GUIDE_COLOR)
    }

    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val barcodeScanner: BarcodeScanner by lazy {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
        )
    }

    // Rejection feedback throttle — main thread only.
    private var lastRejectedAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scanner)

        val previewView = findViewById<PreviewView>(R.id.previewView)
        val closeButton = findViewById<ImageButton>(R.id.closeButton)
        guideText = findViewById(R.id.guideText)

        closeButton.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        startCamera(previewView)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        analysisExecutor.shutdown()
        barcodeScanner.close()
        super.onDestroy()
    }

    private fun startCamera(previewView: PreviewView) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            if (isFinishing || isDestroyed) return@addListener
            val cameraProvider = cameraProviderFuture.get()

            // Preview
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            // Image analysis for QR detection
            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(analysisExecutor) { imageProxy ->
                        if (scanned) {
                            imageProxy.close()
                            return@setAnalyzer
                        }
                        scanQr(imageProxy)
                    }
                }

            // Bind to lifecycle
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis
                )
            } catch (e: Exception) {
                Toast.makeText(this, "No se pudo abrir la cámara", Toast.LENGTH_LONG).show()
                setResult(RESULT_CANCELED)
                finish()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun scanQr(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        barcodeScanner.process(image)
            .addOnSuccessListener { barcodes ->
                if (scanned || isFinishing || isDestroyed) return@addOnSuccessListener
                var rejected = false
                for (barcode in barcodes) {
                    val raw = barcode.rawValue ?: continue
                    val phone = validatePhone(raw)
                    if (phone != null) {
                        acceptPhone(phone)
                        return@addOnSuccessListener
                    }
                    rejected = true
                }
                if (rejected) onRejected()
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    private fun acceptPhone(phone: String) {
        scanned = true
        val intent = android.content.Intent().apply {
            putExtra(EXTRA_PHONE, phone)
        }
        setResult(RESULT_OK, intent)
        finish()
    }

    /**
     * Main thread (ML Kit's listeners run there). At most one notice per
     * REJECT_NOTICE_MS whatever the QR: with two rejected codes in view,
     * frames alternate between them, so a per-content throttle let a
     * vibration through every ~200 ms (seen on device).
     */
    private fun onRejected() {
        val now = SystemClock.elapsedRealtime()
        if (lastRejectedAt != 0L && now - lastRejectedAt < REJECT_NOTICE_MS) return
        lastRejectedAt = now
        vibrate()
        guideText.text = REJECTED_TEXT
        guideText.setTextColor(REJECTED_COLOR)
        mainHandler.removeCallbacks(restoreGuide)
        mainHandler.postDelayed(restoreGuide, REJECT_NOTICE_MS)
    }

    /**
     * Returns the trimmed string if it matches the phone regex, null otherwise.
     * Same regex used on the Lynx side for defense-in-depth.
     */
    private fun validatePhone(raw: String): String? {
        val trimmed = raw.trim()
        return if (PHONE_REGEX.matches(trimmed)) trimmed else null
    }

    /** Haptic hint only: a failure here (no vibrator, no permission) must never take the scanner down. */
    private fun vibrate() {
        try {
            vibrateOnce()
        } catch (e: Exception) {
            // Ignored — the guide text already tells the user what happened.
        }
    }

    private fun vibrateOnce() {
        val vibrator = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            val manager = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        vibrator.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
    }
}
