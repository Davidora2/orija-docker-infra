package com.localaide.app.audio

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.atomic.AtomicBoolean

/**
 * On-device meeting transcription via Vosk.
 * Audio never leaves the device.
 */
class VoskTranscriber(
    @Suppress("UNUSED_PARAMETER") context: Context,
    private val modelInstaller: ModelInstaller
) {
    private val sampleRate = 16_000
    private var model: Model? = null
    private val recording = AtomicBoolean(false)

    private val _partial = MutableStateFlow("")
    val partial: StateFlow<String> = _partial.asStateFlow()

    private val _finalChunks = MutableSharedFlow<String>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val finalChunks: SharedFlow<String> = _finalChunks.asSharedFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    suspend fun prepare(): Boolean = withContext(Dispatchers.IO) {
        if (!modelInstaller.ensureInstalled()) return@withContext false
        try {
            if (model == null) {
                model = Model(modelInstaller.modelDir.absolutePath)
                Log.i(TAG, "[vosk] Model loaded from ${modelInstaller.modelDir}")
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "[vosk] Model load failed", e)
            false
        }
    }

    /**
     * Capture mic audio, write WAV, and emit live transcript chunks.
     * Returns Pair(wavPath, fullTranscript).
     */
    suspend fun recordMeeting(
        outputWav: File,
        onLevel: (Float) -> Unit = {}
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        check(prepare()) { "Speech model not ready" }
        val activeModel = model ?: error("Model null")

        val minBuf = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val bufferSize = minBuf.coerceAtLeast(sampleRate / 2) * 2

        @Suppress("MissingPermission")
        val recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize
        )
        check(recorder.state == AudioRecord.STATE_INITIALIZED) { "Mic init failed" }

        val recognizer = Recognizer(activeModel, sampleRate.toFloat())
        val pcmChunks = ArrayList<ByteArray>()
        val transcript = StringBuilder()
        val buffer = ByteArray(bufferSize)

        recording.set(true)
        _isListening.value = true
        _partial.value = ""
        recorder.startRecording()
        Log.i(TAG, "[vosk] Recording started")

        try {
            while (recording.get() && isActive) {
                val read = recorder.read(buffer, 0, buffer.size)
                if (read > 0) {
                    val copy = buffer.copyOf(read)
                    pcmChunks.add(copy)
                    onLevel(rms(copy))

                    if (recognizer.acceptWaveForm(copy, read)) {
                        val text = extractText(recognizer.result)
                        if (text.isNotBlank()) {
                            transcript.append(text).append(' ')
                            _finalChunks.emit(text)
                            _partial.value = ""
                        }
                    } else {
                        val partialText = extractText(recognizer.partialResult, key = "partial")
                        if (partialText.isNotBlank()) _partial.value = partialText
                    }
                }
            }

            val finalText = extractText(recognizer.finalResult)
            if (finalText.isNotBlank()) {
                transcript.append(finalText).append(' ')
                _finalChunks.emit(finalText)
            }
        } finally {
            try {
                recorder.stop()
            } catch (_: Exception) {
            }
            recorder.release()
            recognizer.close()
            _isListening.value = false
            _partial.value = ""
            Log.i(TAG, "[vosk] Recording stopped")
        }

        writeWav(outputWav, pcmChunks, sampleRate)
        val full = transcript.toString().trim().ifBlank {
            // Offline fallback when silence / model miss
            "(No speech detected. Try speaking closer to the microphone.)"
        }
        Log.i(TAG, "[vosk] Transcript length=${full.length}")
        outputWav.absolutePath to full
    }

    fun stop() {
        recording.set(false)
    }

    /**
     * Transcribe an existing 16-bit mono PCM/WAV file offline.
     */
    suspend fun transcribeFile(wavFile: File): String = withContext(Dispatchers.IO) {
        check(prepare()) { "Speech model not ready" }
        val activeModel = model ?: error("Model null")
        val bytes = wavFile.readBytes()
        // Skip 44-byte WAV header if present
        val pcm = if (bytes.size > 44 && bytes[0] == 'R'.code.toByte()) {
            bytes.copyOfRange(44, bytes.size)
        } else bytes

        val recognizer = Recognizer(activeModel, sampleRate.toFloat())
        try {
            val chunk = 4000
            val sb = StringBuilder()
            var offset = 0
            while (offset < pcm.size) {
                val end = (offset + chunk).coerceAtMost(pcm.size)
                val slice = pcm.copyOfRange(offset, end)
                if (recognizer.acceptWaveForm(slice, slice.size)) {
                    val t = extractText(recognizer.result)
                    if (t.isNotBlank()) sb.append(t).append(' ')
                }
                offset = end
            }
            val fin = extractText(recognizer.finalResult)
            if (fin.isNotBlank()) sb.append(fin)
            sb.toString().trim()
        } finally {
            recognizer.close()
        }
    }

    fun release() {
        stop()
        model?.close()
        model = null
    }

    private fun extractText(json: String, key: String = "text"): String {
        return try {
            JSONObject(json).optString(key, "").trim()
        } catch (_: Exception) {
            ""
        }
    }

    private fun rms(pcm: ByteArray): Float {
        if (pcm.isEmpty()) return 0f
        val shorts = ShortArray(pcm.size / 2)
        ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(shorts)
        var sum = 0.0
        for (s in shorts) sum += s * s.toDouble()
        val mean = sum / shorts.size
        return (kotlin.math.sqrt(mean) / Short.MAX_VALUE).toFloat().coerceIn(0f, 1f)
    }

    private fun writeWav(file: File, chunks: List<ByteArray>, sampleRate: Int) {
        file.parentFile?.mkdirs()
        val dataSize = chunks.sumOf { it.size }
        FileOutputStream(file).use { out ->
            val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
            header.put("RIFF".toByteArray())
            header.putInt(36 + dataSize)
            header.put("WAVE".toByteArray())
            header.put("fmt ".toByteArray())
            header.putInt(16)
            header.putShort(1) // PCM
            header.putShort(1) // mono
            header.putInt(sampleRate)
            header.putInt(sampleRate * 2)
            header.putShort(2)
            header.putShort(16)
            header.put("data".toByteArray())
            header.putInt(dataSize)
            out.write(header.array())
            chunks.forEach { out.write(it) }
        }
    }

    companion object {
        private const val TAG = "LocalAide"
    }
}
