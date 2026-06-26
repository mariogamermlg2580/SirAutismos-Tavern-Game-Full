#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$ROOT/SirAutismosTavern.xcodeproj"
BUILD_DIR="$ROOT/build"
OUT_DIR="$ROOT/dist"
APP="$BUILD_DIR/Release-iphoneos/SirAutismosTavern.app"
IPA="$OUT_DIR/Sir Autismos Tavern Cards and Stuff - unsigned.ipa"

mkdir -p "$OUT_DIR"
rm -rf "$BUILD_DIR" "$ROOT/Payload" "$IPA"

xcodebuild \
  -project "$PROJECT" \
  -scheme SirAutismosTavern \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  -allowProvisioningUpdates \
  build \
  CONFIGURATION_BUILD_DIR="$BUILD_DIR/Release-iphoneos" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=""

mkdir -p "$ROOT/Payload"
cp -R "$APP" "$ROOT/Payload/"
(
  cd "$ROOT"
  /usr/bin/zip -qry "$IPA" Payload
)
rm -rf "$ROOT/Payload"

echo "Unsigned IPA created at: $IPA"
ls -la "$OUT_DIR"
