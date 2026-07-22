package com.localaide.app.data.db

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "meetings")
data class MeetingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val audioPath: String?,
    val transcript: String,
    val deliverablesJson: String,
    val createdAt: Long,
    val durationMs: Long = 0
)

@Dao
interface MeetingDao {
    @Query("SELECT * FROM meetings ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<MeetingEntity>>

    @Query("SELECT * FROM meetings WHERE id = :id")
    suspend fun getById(id: Long): MeetingEntity?

    @Insert
    suspend fun insert(meeting: MeetingEntity): Long

    @Update
    suspend fun update(meeting: MeetingEntity)

    @Query("DELETE FROM meetings WHERE id = :id")
    suspend fun delete(id: Long)
}

@Database(entities = [MeetingEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun meetingDao(): MeetingDao
}
