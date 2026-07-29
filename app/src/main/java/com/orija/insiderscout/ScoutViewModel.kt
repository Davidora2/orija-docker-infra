package com.orija.insiderscout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.orija.insiderscout.data.ScanResult
import com.orija.insiderscout.data.SecEdgarClient
import com.orija.insiderscout.data.TradeIdeaScorer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ScoutUiState(
    val loading: Boolean = false,
    val lookbackDays: Int = 14,
    val maxFilings: Int = 40,
    val result: ScanResult? = null,
    val error: String? = null,
)

class ScoutViewModel(
    private val client: SecEdgarClient = SecEdgarClient(),
) : ViewModel() {
    private val _state = MutableStateFlow(ScoutUiState())
    val state: StateFlow<ScoutUiState> = _state.asStateFlow()

    init {
        scan()
    }

    fun updateLookback(days: Int) {
        _state.update { it.copy(lookbackDays = days.coerceIn(1, 60)) }
    }

    fun updateMaxFilings(count: Int) {
        _state.update { it.copy(maxFilings = count.coerceIn(10, 80)) }
    }

    fun scan() {
        viewModelScope.launch {
            val lookback = _state.value.lookbackDays
            val maxFilings = _state.value.maxFilings
            _state.update { it.copy(loading = true, error = null) }
            runCatching {
                val txs = client.fetchRecentTransactions(
                    lookbackDays = lookback,
                    maxFilings = maxFilings,
                )
                TradeIdeaScorer.buildTradeIdeas(
                    transactions = txs,
                    lookbackDays = lookback,
                )
            }.onSuccess { result ->
                _state.update { it.copy(loading = false, result = result, error = null) }
            }.onFailure { err ->
                val message = when {
                    err.message?.contains("Unexpected token", ignoreCase = true) == true ->
                        "Could not read SEC feed (bad/compressed response). Update the app and retry."
                    err.message.isNullOrBlank() ->
                        "Scan failed. Check network and try again."
                    else -> err.message
                }
                _state.update {
                    it.copy(loading = false, error = message)
                }
            }
        }
    }
}
