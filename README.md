# LocalAide

Personal meeting assistant for Android. Runs **entirely on-device**.

## What it does

1. **Records meetings** with the microphone (foreground service keeps capture alive)
2. **Transcribes speech offline** with the Vosk English model (downloaded once into app storage)
3. **Extracts deliverables / action items** locally from the transcript
4. **Creates calendar events** for each selected deliverable (title, owner, due date, source snippet)

No cloud AI accounts. Audio and transcripts stay on the phone.

## Install the APK

Debug APK (after build):

```text
releases/LocalAide-debug.apk
```

On your phone: enable *Install from unknown sources*, then open the APK.

First launch → tap **Install** on the speech model (~40MB, one-time). After that, transcription works offline.

## Build from source

```bash
export ANDROID_HOME=/path/to/android-sdk
./gradlew :app:assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk releases/LocalAide-debug.apk
```

Requirements: JDK 17+, Android SDK platform 34, build-tools 34.

## Permissions

| Permission | Why |
|---|---|
| Microphone | Meeting capture |
| Calendar read/write | Insert deliverable events |
| Internet | One-time speech model download only |
| Notifications | Foreground recording indicator |

## Privacy

- Speech recognition: Vosk on-device
- Deliverable parsing: on-device heuristics (no network)
- Storage: Room database + WAV files under app-private `files/meetings/`
