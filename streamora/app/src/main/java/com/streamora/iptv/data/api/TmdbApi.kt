package com.streamora.iptv.data.api

import com.google.gson.annotations.SerializedName
import com.streamora.iptv.BuildConfig
import com.streamora.iptv.data.search.TitleSearch
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

data class TmdbMultiResponse(
    @SerializedName("results") val results: List<TmdbResult> = emptyList()
)

data class TmdbResult(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("media_type") val mediaType: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("release_date") val releaseDate: String? = null,
    @SerializedName("first_air_date") val firstAirDate: String? = null,
    @SerializedName("original_title") val originalTitle: String? = null,
    @SerializedName("original_name") val originalName: String? = null
) {
    fun displayTitle(): String =
        title?.takeIf { it.isNotBlank() }
            ?: name?.takeIf { it.isNotBlank() }
            ?: originalTitle
            ?: originalName
            ?: ""

    fun year(): Int? {
        val date = releaseDate?.takeIf { it.isNotBlank() } ?: firstAirDate
        return date?.take(4)?.toIntOrNull()
    }
}

interface TmdbApi {
    @GET("search/multi")
    suspend fun searchMulti(
        @Query("api_key") apiKey: String,
        @Query("query") query: String,
        @Query("include_adult") includeAdult: Boolean = false,
        @Query("language") language: String = "en-US",
        @Query("page") page: Int = 1
    ): TmdbMultiResponse
}

object TmdbClient {
    val apiKey: String get() = BuildConfig.TMDB_API_KEY.trim()
    val isConfigured: Boolean get() = apiKey.isNotBlank()

    private val api: TmdbApi by lazy {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        val client = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .build()
        Retrofit.Builder()
            .baseUrl("https://api.themoviedb.org/3/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(TmdbApi::class.java)
    }

    suspend fun predict(query: String, limit: Int = 6): List<TitleSearch.SearchSuggestion> {
        if (!isConfigured || query.trim().length < 2) return emptyList()
        return try {
            val response = api.searchMulti(apiKey = apiKey, query = query.trim())
            response.results
                .asSequence()
                .filter { it.mediaType == "movie" || it.mediaType == "tv" }
                .mapNotNull { r ->
                    val title = r.displayTitle().takeIf { it.isNotBlank() } ?: return@mapNotNull null
                    TitleSearch.SearchSuggestion(
                        title = title,
                        source = TitleSearch.SuggestionSource.TMDB,
                        year = r.year(),
                        mediaHint = r.mediaType
                    )
                }
                .distinctBy { TitleSearch.normalize(it.title) to it.year }
                .take(limit)
                .toList()
        } catch (_: Exception) {
            emptyList()
        }
    }
}
