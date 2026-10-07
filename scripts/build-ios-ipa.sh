#!/bin/bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'The native iOS build requires macOS and Xcode. Use the iOS IPA GitHub Actions workflow from Windows.' >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUTPUT="$ROOT/build/ios"
mkdir -p "$OUTPUT"
node scripts/ios-icons.cjs
xcodebuild -quiet -workspace ios/VirtusPlanner.xcworkspace -scheme VirtusPlanner \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath "$OUTPUT/VirtusPlanner.xcarchive" \
  -resultBundlePath "$OUTPUT/Archive-$(date +%s).xcresult" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  archive 2>&1 | tee "$OUTPUT/xcodebuild.log"

APP="$OUTPUT/VirtusPlanner.xcarchive/Products/Applications/VirtusPlanner.app"
test -s "$APP/VirtusPlanner"
test -s "$APP/main.jsbundle"
lipo "$APP/VirtusPlanner" -verify_arch arm64
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist"
STAGING="$(mktemp -d "$OUTPUT/package.XXXXXX")"
mkdir -p "$STAGING/Payload"
ditto "$APP" "$STAGING/Payload/VirtusPlanner.app"
ditto -c -k --keepParent "$STAGING/Payload" "$OUTPUT/VirtusPlanner-AltStore.ipa"
unzip -t "$OUTPUT/VirtusPlanner-AltStore.ipa"
shasum -a 256 "$OUTPUT/VirtusPlanner-AltStore.ipa" > "$OUTPUT/SHA256SUMS.txt"
echo "Unsigned device IPA for AltStore: $OUTPUT/VirtusPlanner-AltStore.ipa"
