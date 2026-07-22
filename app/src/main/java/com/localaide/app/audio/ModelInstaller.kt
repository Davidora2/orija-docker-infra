package com.localaide.app.audio

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/**
 * Downloads and unpacks the small English Vosk model once into app-private storage.
 * After install, all transcription runs fully offline.
 */
class ModelInstaller(private val context: Context) {

    enum class Status { Missing, Downloading, Ready, Error }

    data class Progress(
        val status: Status = Status.Missing,
        val fraction: Float = 0f,
        val message: String = "Speech model not installed"
    )

    private val _progress = MutableStateFlow(Progress())
    val progress: StateFlow<Progress> = _progress.asStateFlow()

    val modelDir: File
        get() = File(context.filesDir, "vosk-model-small-en-us-0.15")

    fun isReady(): Boolean = modelDir.exists() && File(modelDir, "am/final.mdl").exists()

    suspend fun ensureInstalled(force: Boolean = false): Boolean = withContext(Dispatchers.IO) {
        if (!force && isReady()) {
            _progress.value = Progress(Status.Ready, 1f, "On-device model ready")
            return@withContext true
        }

        _progress.value = Progress(Status.Downloading, 0.02f, "Downloading speech model…")
        val zipFile = File(context.cacheDir, "vosk-model.zip")
        try {
            download(MODEL_URL, zipFile) { read, total ->
                val frac = if (total > 0) (read.toFloat() / total).coerceIn(0f, 0.85f) else 0.1f
                _progress.value = Progress(
                    Status.Downloading,
                    frac,
                    "Downloading speech model… ${(frac * 100).toInt()}%"
                )
            }

            if (modelDir.exists()) modelDir.deleteRecursively()
            _progress.value = Progress(Status.Downloading, 0.9f, "Unpacking model…")
            unzip(zipFile, context.filesDir)

            // Zip root is vosk-model-small-en-us-0.15/
            if (!isReady()) {
                // Some mirrors nest differently; try to locate am/final.mdl
                val found = context.filesDir.walkTopDown()
                    .firstOrNull { it.name == "final.mdl" && it.parentFile?.name == "am" }
                    ?.parentFile?.parentFile
                if (found != null && found.absolutePath != modelDir.absolutePath) {
                    found.copyRecursively(modelDir, overwrite = true)
                }
            }

            zipFile.delete()
            val ok = isReady()
            _progress.value = if (ok) {
                Progress(Status.Ready, 1f, "On-device model ready")
            } else {
                Progress(Status.Error, 0f, "Model unpack failed")
            }
            ok
        } catch (e: Exception) {
            _progress.value = Progress(Status.Error, 0f, e.message ?: "Download failed")
            false
        }
    }

    private fun download(url: String, dest: File, onProgress: (Long, Long) -> Unit) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = true
        }
        conn.inputStream.use { input ->
            val total = conn.contentLengthLong
            FileOutputStream(dest).use { output ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var readTotal = 0L
                while (true) {
                    val n = input.read(buffer)
                    if (n <= 0) break
                    output.write(buffer, 0, n)
                    readTotal += n
                    onProgress(readTotal, total)
                }
            }
        }
        conn.disconnect()
    }

    private fun unzip(zipFile: File, targetDir: File) {
        ZipInputStream(BufferedInputStream(zipFile.inputStream())).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                val outFile = File(targetDir, entry.name)
                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    FileOutputStream(outFile).use { fos -> zis.copyTo(fos) }
                }
                zis.closeEntry()
                entry = zis.nextEntry
            }
        }
    }

    companion object {
        // Official Alphacephei small English model (~40MB)
        const val MODEL_URL =
            "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
    }
}
