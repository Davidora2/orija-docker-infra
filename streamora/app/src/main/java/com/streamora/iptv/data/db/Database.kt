package com.streamora.iptv.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "profiles")
data class ProfileEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val avatarColor: Long,
    val isKids: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "favorites", primaryKeys = ["profileId", "contentId", "contentType"])
data class FavoriteEntity(
    val profileId: Long,
    val contentId: Int,
    val contentType: String,
    val title: String,
    val posterUrl: String?,
    val rating: String? = null,
    val plot: String? = null,
    val extension: String? = null,
    val likedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "watch_history", primaryKeys = ["profileId", "contentId", "contentType"])
data class WatchHistoryEntity(
    val profileId: Long,
    val contentId: Int,
    val contentType: String,
    val title: String,
    val posterUrl: String?,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val watchedAt: Long = System.currentTimeMillis()
)

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profiles ORDER BY createdAt ASC")
    fun observeProfiles(): Flow<List<ProfileEntity>>

    @Query("SELECT * FROM profiles ORDER BY createdAt ASC")
    suspend fun getProfiles(): List<ProfileEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(profile: ProfileEntity): Long

    @Update
    suspend fun update(profile: ProfileEntity)

    @Query("DELETE FROM profiles WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("SELECT * FROM profiles WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): ProfileEntity?
}

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites WHERE profileId = :profileId ORDER BY likedAt DESC")
    fun observeFavorites(profileId: Long): Flow<List<FavoriteEntity>>

    @Query("SELECT * FROM favorites WHERE profileId = :profileId AND contentId = :contentId AND contentType = :contentType LIMIT 1")
    suspend fun getFavorite(profileId: Long, contentId: Int, contentType: String): FavoriteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(favorite: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE profileId = :profileId AND contentId = :contentId AND contentType = :contentType")
    suspend fun remove(profileId: Long, contentId: Int, contentType: String)

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE profileId = :profileId AND contentId = :contentId AND contentType = :contentType)")
    fun observeIsFavorite(profileId: Long, contentId: Int, contentType: String): Flow<Boolean>
}

@Dao
interface WatchHistoryDao {
    @Query("SELECT * FROM watch_history WHERE profileId = :profileId ORDER BY watchedAt DESC LIMIT 40")
    fun observeHistory(profileId: Long): Flow<List<WatchHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: WatchHistoryEntity)
}

@Database(
    entities = [ProfileEntity::class, FavoriteEntity::class, WatchHistoryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class StreamoraDatabase : RoomDatabase() {
    abstract fun profileDao(): ProfileDao
    abstract fun favoriteDao(): FavoriteDao
    abstract fun watchHistoryDao(): WatchHistoryDao
}
