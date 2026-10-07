# VirtusPlanner on iPhone

This port starts from d654c5e1b387515784f7ef0923324247f76a5b55 and keeps React Native 0.73.8. Minimum iOS version: 15.1. It uses the same local tasks, calendar, focus timer, analytics, themes and assistant as Android.

## Build from Windows

Push the `ios-support` branch to your GitHub repository. The `iOS IPA for AltStore` workflow builds on a macOS runner using Xcode 15.4. Download the `VirtusPlanner-AltStore` workflow artifact and extract `VirtusPlanner-AltStore.ipa`. The runner installs Node, Ruby dependencies and CocoaPods; no local Xcode installation is possible or required on Windows.

The IPA contains an arm64 device executable, Hermes and a release JavaScript bundle. It does not need Metro. It is unsigned and must be signed by AltStore before installation; opening it directly in Files will not install it. There is no App Store upload or release step. GitHub artifacts expire after seven days, so keep a local copy.

macOS 14 runners are scheduled to retire in November 2026. Before that date, migrate the runner and validate a newer Xcode with this older React Native release.

## AltStore Classic installation

Use the official Windows guide: https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows

Install the required Apple software and AltServer from the official sources in that guide, connect and trust your iPhone, and install AltStore Classic with your own Apple ID. Then transfer the IPA to Files on the iPhone, open AltStore, choose My Apps -> +, and select the IPA. Enable Developer Mode if iOS requests it. Free-account signatures normally need refreshing every seven days; keep AltServer available for refreshes. Never send your Apple ID password to the developer or put it in this repository.

## YandexGPT configuration

The repository does not include live API keys. Without keys the app supports local task commands and OpenStreetMap nearby search. To enable YandexGPT, supply `VIRTUS_YANDEX_API_KEY` and `VIRTUS_YANDEX_FOLDER_ID` as GitHub Actions secrets before building. `VIRTUS_GEOCODER_API_KEY` is optional. On a Mac, the ignored `.virtus-secrets.json` described in README.md also works. Values are embedded in the bundle, as in the Android implementation; use only a restricted testing key and keep a keyed IPA private.

## Native iOS behavior

- Local task and timer-completion notifications use UserNotifications, with the required iOS notification module linked by CocoaPods. No APNs entitlement is required for AltStore signing.
- iOS does not support Android's persistent countdown notification. The countdown stays in the app, and one scheduled notification announces completion while the app is backgrounded.
- Nearby reminders use Core Location movement updates (100 m distance filter), throttled to no more than one map check per minute. Allow location access, precise location and notifications. With background authorization, updates may continue while the app is suspended; delivery timing is controlled by iOS and network availability. Force-quitting stops this session; reopen the app to restart it. Battery use and locked-screen behavior require a physical-device check.
- The existing notification scheduler is intended for small personal schedules. Large schedules can exceed the iOS pending-notification limit; there is no rolling schedule implementation yet.

## Build on a Mac

```sh
npm ci
bundle install
cd ios && bundle exec pod install && cd ..
bash scripts/build-ios-ipa.sh
```

For a debug simulator build, use `npm run ios` after installing pods. For device signing through Xcode, open `ios/VirtusPlanner.xcworkspace` and choose your development team and a unique bundle identifier.

## Acceptance check on the iPhone

Launch without Metro; finish onboarding; create, edit, complete and delete a task; restart and confirm persistence; toggle the theme; test the keyboard and safe-area navigation; ask for nearby shops and test location denial; schedule a reminder with the app backgrounded; start a short focus timer, lock the phone and verify its completion notification; disable reminders and verify cancellation. For YandexGPT, verify a live response only after building with testing credentials.
