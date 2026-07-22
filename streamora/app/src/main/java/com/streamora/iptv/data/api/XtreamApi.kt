package com.streamora.iptv.data.api

import com.streamora.iptv.data.model.Category
import com.streamora.iptv.data.model.LiveStream
import com.streamora.iptv.data.model.SeriesInfoResponse
import com.streamora.iptv.data.model.SeriesItem
import com.streamora.iptv.data.model.VodStream
import com.streamora.iptv.data.model.XtreamAuthResponse
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query
import java.util.concurrent.TimeUnit

interface XtreamApi {
    @GET("player_api.php")
    suspend fun authenticate(
        @Query("username") username: String,
        @Query("password") password: String
    ): XtreamAuthResponse

    @GET("player_api.php")
    suspend fun getLiveCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_live_categories"
    ): List<Category>

    @GET("player_api.php")
    suspend fun getLiveStreams(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_live_streams",
        @Query("category_id") categoryId: String? = null
    ): List<LiveStream>

    @GET("player_api.php")
    suspend fun getVodCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_vod_categories"
    ): List<Category>

    @GET("player_api.php")
    suspend fun getVodStreams(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_vod_streams",
        @Query("category_id") categoryId: String? = null
    ): List<VodStream>

    @GET("player_api.php")
    suspend fun getSeriesCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series_categories"
    ): List<Category>

    @GET("player_api.php")
    suspend fun getSeries(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series",
        @Query("category_id") categoryId: String? = null
    ): List<SeriesItem>

    @GET("player_api.php")
    suspend fun getSeriesInfo(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series_info",
        @Query("series_id") seriesId: Int
    ): SeriesInfoResponse
}

object XtreamApiFactory {
    fun create(baseUrl: String): XtreamApi {
        val normalized = normalizeBaseUrl(baseUrl)
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(logging)
            .followRedirects(true)
            .build()

        return Retrofit.Builder()
            .baseUrl(normalized)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(XtreamApi::class.java)
    }

    fun normalizeBaseUrl(url: String): String {
        var u = url.trim()
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
            u = "http://$u"
        }
        if (!u.endsWith("/")) u += "/"
        return u
    }

    fun buildLiveUrl(baseUrl: String, username: String, password: String, streamId: Int): String {
        val base = normalizeBaseUrl(baseUrl).trimEnd('/')
        return "$base/live/$username/$password/$streamId.m3u8"
    }

    fun buildVodUrl(
        baseUrl: String,
        username: String,
        password: String,
        streamId: Int,
        extension: String?
    ): String {
        val base = normalizeBaseUrl(baseUrl).trimEnd('/')
        val ext = extension?.ifBlank { null } ?: "mp4"
        return "$base/movie/$username/$password/$streamId.$ext"
    }

    fun buildSeriesUrl(
        baseUrl: String,
        username: String,
        password: String,
        episodeId: String,
        extension: String?
    ): String {
        val base = normalizeBaseUrl(baseUrl).trimEnd('/')
        val ext = extension?.ifBlank { null } ?: "mp4"
        return "$base/series/$username/$password/$episodeId.$ext"
    }
}
