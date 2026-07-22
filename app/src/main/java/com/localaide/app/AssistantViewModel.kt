package com.localaide.app

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.localaide.app.audio.ModelInstaller
import com.localaide.app.audio.VoskTranscriber
import com.localaide.app.calendar.CalendarEventWriter
import com.localaide.app.data.MeetingRepository
import com.localaide.app.data.model.Deliverable
import com.localaide.app.data.model.MeetingSummary
import com.localaide.app.nlp.DeliverableExtractor
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class CaptureUiState(
    val isRecording: Boolean = false,
    val partialText: String = "",
    val liveTranscript: String = "",
    val level: Float = 0f,
    val statusMessage: String = "",
    val modelProgress: ModelInstaller.Progress = ModelInstaller.Progress(),
    val lastMeetingId: Long? = null,
    val busy: Boolean = false,
    val error: String? = null
)

data class ReviewUiState(
    val meeting: MeetingSummary? = null,
    val selected: Set<String> = emptySet(),
    val calendarMessage: String? = null,
    val busy: Boolean = false
)

class AssistantViewModel(
    private val repository: MeetingRepository,
    private val modelInstaller: ModelInstaller,
    private val transcriber: VoskTranscriber,
    private val extractor: DeliverableExtractor,
    private val calendarWriter: CalendarEventWriter,
    private val meetingsDir: File
) : ViewModel() {

    val meetings = repository.observeMeetings()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _capture = MutableStateFlow(CaptureUiState())
    val capture: StateFlow<CaptureUiState> = _capture.asStateFlow()

    private val _review = MutableStateFlow(ReviewUiState())
    val review: StateFlow<ReviewUiState> = _review.asStateFlow()

    private var recordJob: Job? = null
    private var startedAt: Long = 0L

    init {
        viewModelScope.launch {
            modelInstaller.progress.collect { p ->
                _capture.update { it.copy(modelProgress = p) }
            }
        }
        viewModelScope.launch {
            transcriber.partial.collect { text ->
                _capture.update { it.copy(partialText = text) }
            }
        }
        viewModelScope.launch {
            if (modelInstaller.isReady()) {
                modelInstaller.ensureInstalled()
            }
        }
    }

    fun ensureModel() {
        viewModelScope.launch {
            _capture.update { it.copy(busy = true, error = null, statusMessage = "Preparing on-device model…") }
            val ok = modelInstaller.ensureInstalled()
            _capture.update {
                it.copy(
                    busy = false,
                    statusMessage = if (ok) "Ready to record locally" else it.modelProgress.message,
                    error = if (ok) null else it.modelProgress.message
                )
            }
        }
    }

    fun startRecording() {
        if (_capture.value.isRecording) return
        meetingsDir.mkdirs()
        val stamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
        val wav = File(meetingsDir, "meeting-$stamp.wav")
        startedAt = System.currentTimeMillis()

        recordJob = viewModelScope.launch {
            _capture.update {
                it.copy(
                    isRecording = true,
                    liveTranscript = "",
                    partialText = "",
                    error = null,
                    statusMessage = "Listening… audio stays on this phone",
                    busy = true
                )
            }
            try {
                val prepared = transcriber.prepare()
                if (!prepared) {
                    _capture.update {
                        it.copy(
                            isRecording = false,
                            busy = false,
                            error = "Speech model not ready. Download it first."
                        )
                    }
                    return@launch
                }

                val chunks = StringBuilder()
                val collectJob = launch {
                    transcriber.finalChunks.collect { piece ->
                        chunks.append(piece).append(' ')
                        _capture.update { state ->
                            state.copy(liveTranscript = chunks.toString().trim())
                        }
                    }
                }

                val (path, transcript) = transcriber.recordMeeting(wav) { level ->
                    _capture.update { it.copy(level = level) }
                }
                collectJob.cancel()

                val duration = System.currentTimeMillis() - startedAt
                val title = "Meeting ${SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(startedAt))}"
                val deliverables = extractor.extract(transcript)
                Log.i(TAG, "[local] transcript result length=${transcript.length}, deliverables=${deliverables.size}")

                val id = repository.saveMeeting(
                    title = title,
                    audioPath = path,
                    transcript = transcript,
                    deliverables = deliverables,
                    durationMs = duration
                )

                _capture.update {
                    it.copy(
                        isRecording = false,
                        busy = false,
                        liveTranscript = transcript,
                        lastMeetingId = id,
                        statusMessage = "Saved locally · ${deliverables.size} deliverable(s) found"
                    )
                }
                openReview(id)
            } catch (e: Exception) {
                Log.e(TAG, "record failed", e)
                _capture.update {
                    it.copy(
                        isRecording = false,
                        busy = false,
                        error = e.message ?: "Recording failed"
                    )
                }
            }
        }
    }

    fun stopRecording() {
        transcriber.stop()
        _capture.update { it.copy(statusMessage = "Finalizing transcript…") }
    }

    fun openReview(meetingId: Long) {
        viewModelScope.launch {
            val meeting = repository.getMeeting(meetingId) ?: return@launch
            _review.value = ReviewUiState(
                meeting = meeting,
                selected = meeting.deliverables.map { it.id }.toSet()
            )
        }
    }

    fun toggleDeliverable(id: String) {
        _review.update { state ->
            val next = state.selected.toMutableSet()
            if (!next.add(id)) next.remove(id)
            state.copy(selected = next)
        }
    }

    fun updateDeliverableTitle(id: String, title: String) {
        val meeting = _review.value.meeting ?: return
        val updated = meeting.deliverables.map {
            if (it.id == id) it.copy(title = title) else it
        }
        _review.update { it.copy(meeting = meeting.copy(deliverables = updated)) }
        viewModelScope.launch {
            repository.updateDeliverables(meeting.meetingId, updated)
        }
    }

    fun pushSelectedToCalendar() {
        val meeting = _review.value.meeting ?: return
        val chosen = meeting.deliverables.filter { it.id in _review.value.selected }
        if (chosen.isEmpty()) {
            _review.update { it.copy(calendarMessage = "Select at least one deliverable") }
            return
        }
        viewModelScope.launch {
            _review.update { it.copy(busy = true, calendarMessage = null) }
            val result = calendarWriter.createEventsForDeliverables(meeting.title, chosen)
            repository.updateDeliverables(meeting.meetingId, meeting.deliverables)
            val msg = buildString {
                append("Created ${result.created} calendar event(s)")
                if (result.errors.isNotEmpty()) {
                    append(" · ").append(result.errors.first())
                }
            }
            Log.i(TAG, "[local] calendar result: $msg")
            _review.update {
                it.copy(
                    busy = false,
                    calendarMessage = msg,
                    meeting = meeting.copy(deliverables = meeting.deliverables)
                )
            }
            openReview(meeting.meetingId)
        }
    }

    fun reExtract() {
        val meeting = _review.value.meeting ?: return
        viewModelScope.launch {
            val items = extractor.extract(meeting.transcript)
            repository.updateDeliverables(meeting.meetingId, items)
            openReview(meeting.meetingId)
        }
    }

    fun deleteMeeting(id: Long) {
        viewModelScope.launch { repository.deleteMeeting(id) }
    }

    fun processPastedTranscript(text: String) {
        viewModelScope.launch {
            val title = "Notes ${SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date())}"
            val deliverables = extractor.extract(text)
            val id = repository.saveMeeting(title, null, text, deliverables, 0)
            _capture.update {
                it.copy(lastMeetingId = id, statusMessage = "Imported notes · ${deliverables.size} deliverable(s)")
            }
            openReview(id)
        }
    }

    override fun onCleared() {
        super.onCleared()
        transcriber.stop()
    }

    companion object {
        private const val TAG = "LocalAide"
    }
}

class AssistantViewModelFactory(
    private val app: LocalAideApp
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        val c = app.container
        return AssistantViewModel(
            repository = c.meetingRepository,
            modelInstaller = c.modelInstaller,
            transcriber = c.transcriber,
            extractor = c.deliverableExtractor,
            calendarWriter = c.calendarWriter,
            meetingsDir = File(app.filesDir, "meetings")
        ) as T
    }
}
