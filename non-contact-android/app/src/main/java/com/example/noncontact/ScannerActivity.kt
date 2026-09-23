package com.example.noncontact

import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/**
 * Full-screen QR scanner that only accepts phone numbers.
 *
 * Uses CameraX + ML Kit Barcode Scanning. On detection, the raw QR value is
 * validated against ^\+?\d{5,15}$ — only pure phone numbers (optional leading
 * "+", digits only, 5-15 chars) are accepted.  JSON, URLs, or free text are
 * rejected with haptic + toast feedback and the scanner stays open.
 *
 * Returns the validated phone number via setResult(RESULT_OK, intent).
 */
class ScannerActivity : ComponentActivity() {

    companion object {
        const val EXTRA_PHONE = "phone"
        private val PHONE_REGEX = Regex("^\\+?\\d{5,15}\$")
    }

    private var scanned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scanner)

        val previewView = findViewById<PreviewView>(R.id.previewView)
        val closeButton = findViewById<ImageButton>(R.id.closeButton)
        val guideText = findViewById<TextView>(R.id.guideText)

        closeButton.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        startCamera(previewView)
    }

    private fun startCamera(previewView: PreviewView) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            // Preview
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            // Image analysis for QR detection
            val analysisExecutor = Executors.newSingleThreadExecutor()
            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(analysisExecutor) { imageProxy ->
                        if (scanned) {
                            imageProxy.close()
                            return@setAnalyzer
                        }
                        scanQr(imageProxy) { phone ->
                            scanned = true
                            imageProxy.close()
                            val intent = android.content.Intent().apply {
                                putExtra(EXTRA_PHONE, phone)
                            }
                            setResult(RESULT_OK, intent)
                            finish()
                        }
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

    private fun scanQr(imageProxy: androidx.camera.core.ImageProxy, onPhone: (String) -> Unit) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        val scanner = BarcodeScanning.getClient()

        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    val raw = barcode.rawValue ?: continue
                    if (barcode.format == Barcode.FORMAT_QR_CODE ||
                        barcode.valueType == Barcode.TYPE_TEXT
                    ) {
                        val phone = validatePhone(raw)
                        if (phone != null) {
                            onPhone(phone)
                            return@addOnSuccessListener
                        } else {
                            // Invalid — vibrate and show toast on UI thread
                            runOnUiThread {
                                vibrate()
                                Toast.makeText(
                                    this,
                                    "El QR no contiene un número de teléfono válido",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    }
                }
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    /**
     * Returns the trimmed string if it matches the phone regex, null otherwise.
     * Same regex used on the Lynx side for defense-in-depth.
     */
    private fun validatePhone(raw: String): String? {
        val trimmed = raw.trim()
        return if (PHONE_REGEX.matches(trimmed)) trimmed else null
    }

    private fun vibrate() {
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
