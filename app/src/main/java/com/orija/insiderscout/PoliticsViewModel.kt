package com.orija.insiderscout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.orija.insiderscout.data.politics.Country
import com.orija.insiderscout.data.politics.PoliticianDisclosure
import com.orija.insiderscout.data.politics.PoliticsRepository
import com.orija.insiderscout.data.politics.TradePerformance
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AppTab { INSIDERS, POLITICIANS }

data class PoliticsUiState(
    val loading: Boolean = false,
    val country: Country = Country.US,
    val items: List<PoliticianDisclosure> = emptyList(),
    val error: String? = null,
    val selected: PoliticianDisclosure? = null,
    val performance: TradePerformance? = null,
    val chartLoading: Boolean = false,
)

data class AppUiState(
    val tab: AppTab = AppTab.POLITICIANS,
)

class PoliticsViewModel(
    private val repo: PoliticsRepository = PoliticsRepository(),
) : ViewModel() {
    private val _state = MutableStateFlow(PoliticsUiState())
    val state: StateFlow<PoliticsUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun setCountry(country: Country) {
        if (_state.value.country == country && _state.value.items.isNotEmpty()) return
        _state.update { it.copy(country = country, selected = null, performance = null) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val country = _state.value.country
            _state.update { it.copy(loading = true, error = null) }
            runCatching { repo.loadFeed(country) }
                .onSuccess { items ->
                    _state.update { it.copy(loading = false, items = items, error = null) }
                }
                .onFailure { err ->
                    _state.update {
                        it.copy(
                            loading = false,
                            error = err.message ?: "Could not load politician disclosures.",
                        )
                    }
                }
        }
    }

    fun openDisclosure(item: PoliticianDisclosure) {
        _state.update { it.copy(selected = item, performance = null, chartLoading = false) }
        val ticker = item.ticker
        if (ticker.isNullOrBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(chartLoading = true) }
            runCatching {
                val points = repo.loadChart(ticker)
                repo.performanceFor(item, points)
            }.onSuccess { perf ->
                _state.update { it.copy(chartLoading = false, performance = perf) }
            }.onFailure {
                _state.update { it.copy(chartLoading = false, performance = null) }
            }
        }
    }

    fun clearSelection() {
        _state.update { it.copy(selected = null, performance = null, chartLoading = false) }
    }
}
