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
import com.localaide.app.data.model.PriorityPlan
import com.localaide.app.nlp.DeliverableExtractor
import com.localaide.app.nlp.PriorityReasoner
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
    val priorityPlan: PriorityPlan? = null,
    val calendarMessage: String? = null,
    val busy: Boolean = false,
    val reasoningExpandedId: String? = null
)

class AssistantViewModel(
    private val repository: MeetingRepository,
    private val modelInstaller: ModelInstaller,
    private val transcriber: VoskTranscriber,
    private val extractor: DeliverableExtractor,
    private val priorityReasoner: PriorityReasoner,
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
                val plan = prioritize(extractor.extract(transcript), transcript)
                Log.i(TAG, "[local] transcript=${transcript.length}, deliverables=${plan.ranked.size}, doFirst=${plan.doFirstId}")

                val id = repository.saveMeeting(
                    title = title,
                    audioPath = path,
                    transcript = transcript,
                    deliverables = plan.ranked,
                    durationMs = duration
                )

                _capture.update {
                    it.copy(
                        isRecording = false,
                        busy = false,
                        liveTranscript = transcript,
                        lastMeetingId = id,
                        statusMessage = "Saved · ${plan.ranked.size} deliverable(s) · ranked on-device"
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
            val plan = meeting.priorityPlan
                ?: prioritize(meeting.deliverables, meeting.transcript).also { fresh ->
                    repository.updateDeliverables(meetingId, fresh.ranked)
                }
            val rankedMeeting = meeting.copy(
                deliverables = plan.ranked,
                priorityPlan = plan
            )
            _review.value = ReviewUiState(
                meeting = rankedMeeting,
                selected = plan.ranked.map { it.id }.toSet(),
                priorityPlan = plan
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

    fun toggleReasoning(id: String) {
        _review.update { state ->
            state.copy(
                reasoningExpandedId = if (state.reasoningExpandedId == id) null else id
            )
        }
    }

    fun updateDeliverableTitle(id: String, title: String) {
        val meeting = _review.value.meeting ?: return
        val updated = meeting.deliverables.map {
            if (it.id == id) it.copy(title = title) else it
        }
        // Re-rank after edits so deadline/sensitivity reasoning stays fresh
        viewModelScope.launch {
            val plan = prioritize(updated, meeting.transcript)
            repository.updateDeliverables(meeting.meetingId, plan.ranked)
            _review.update {
                it.copy(
                    meeting = meeting.copy(deliverables = plan.ranked, priorityPlan = plan),
                    priorityPlan = plan
                )
            }
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
            // Prefer recommended order when writing events
            val ordered = (_review.value.priorityPlan?.ranked ?: chosen)
                .filter { it.id in _review.value.selected }
            val result = calendarWriter.createEventsForDeliverables(meeting.title, ordered)
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
                    calendarMessage = msg
                )
            }
            openReview(meeting.meetingId)
        }
    }

    fun reExtract() {
        val meeting = _review.value.meeting ?: return
        viewModelScope.launch {
            val plan = prioritize(extractor.extract(meeting.transcript), meeting.transcript)
            repository.updateDeliverables(meeting.meetingId, plan.ranked)
            openReview(meeting.meetingId)
        }
    }

    fun reRank() {
        val meeting = _review.value.meeting ?: return
        viewModelScope.launch {
            _review.update { it.copy(busy = true) }
            val plan = prioritize(meeting.deliverables, meeting.transcript)
            repository.updateDeliverables(meeting.meetingId, plan.ranked)
            Log.i(TAG, "[local] priority reasoner: ${plan.doFirstBlurb}")
            _review.update {
                it.copy(
                    busy = false,
                    meeting = meeting.copy(deliverables = plan.ranked, priorityPlan = plan),
                    priorityPlan = plan,
                    calendarMessage = "Re-ranked on-device · ${plan.doFirstBlurb}"
                )
            }
        }
    }

    fun deleteMeeting(id: Long) {
        viewModelScope.launch { repository.deleteMeeting(id) }
    }

    fun processPastedTranscript(text: String) {
        viewModelScope.launch {
            val title = "Notes ${SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date())}"
            val plan = prioritize(extractor.extract(text), text)
            val id = repository.saveMeeting(title, null, text, plan.ranked, 0)
            _capture.update {
                it.copy(
                    lastMeetingId = id,
                    statusMessage = "Imported · ${plan.ranked.size} deliverable(s) · ranked on-device"
                )
            }
            openReview(id)
        }
    }

    private fun prioritize(items: List<Deliverable>, transcript: String): PriorityPlan {
        val plan = priorityReasoner.prioritize(items, transcript)
        Log.i(TAG, "[local] reasoner overall: ${plan.overallReasoning}")
        return plan
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
            priorityReasoner = c.priorityReasoner,
            calendarWriter = c.calendarWriter,
            meetingsDir = File(app.filesDir, "meetings")
        ) as T
    }
}
