# PaySync on-device DTMF IVR

PaySync now captures keypad audio locally on the Android gateway phone. Node.js receives only the authenticated `dtmf_result` event and updates the matching `automation_call_requests` row; it does not open a microphone or decode audio.

## Call flow

1. The call becomes active; after 1.5 seconds PaySync speaks the configured message followed by “Press 1 to confirm, 2 to cancel.”
2. When TTS completes, PaySync starts `AudioRecord` with `MediaRecorder.AudioSource.MIC`, 8 kHz, mono, 16-bit PCM. It prefers a wired headset input when Android exposes one.
3. An on-device Goertzel detector watches for `697+1209 Hz` (1) or `697+1336 Hz` (2), with a 220 ms release window and held-key debounce.
4. On a key, or after five seconds without a key, PaySync stops and releases `AudioRecord`, disconnects the call, and emits `dtmf_result` as `confirmed`, `cancelled`, or `no_input`.

## Android setup

Update PaySync and grant Microphone permission when the app requests it. Start the gateway from the visible app screen so Android can start its foreground service with the `microphone` type. Connect the phone’s call-output/headset loopback to the input recognized by Android as a microphone. The selected input is device-dependent; check Android's wired-headset indication before testing.

Android can silence ordinary-app microphone capture while a cellular call owns the input. The loopback must appear as a usable external microphone on the target handset; the permission prompt alone cannot override the OS audio-sharing policy. See [Android audio-input sharing](https://developer.android.com/media/platform/sharing-audio-input).

## Backend response storage

`dtmf_result` is authenticated by the registered gateway Socket.IO connection and is idempotent. It writes `automation_call_requests.dtmf_result`, `dtmf_digit`, `status`, and response timestamps. This repository has no generic orders table, so order-specific changes require a concrete order model and a `reference_type`/`reference_id` mapping.
