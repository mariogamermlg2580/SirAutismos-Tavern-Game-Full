Sir Autismos Tavern Cards and Stuff - iOS IPA notes

This project can be wrapped for iPhone, but a real IPA requires Apple's signing tools:

1. Use a Mac with Xcode installed.
2. Add a web-to-native wrapper such as Capacitor.
3. Copy this game's web files into the wrapper's web assets.
4. Open the iOS project in Xcode.
5. Pick an Apple Developer Team and bundle id.
6. Archive the app in Xcode.
7. Export the archive as an IPA.

Suggested Capacitor path on a Mac:

```powershell
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Sir Autismos Tavern Cards and Stuff" "com.sirautismos.taverncards"
npx cap add ios
npx cap copy ios
npx cap open ios
```

In Xcode, set signing, build an archive, then export the IPA.

The game has mobile-friendly touch controls in `index.html`: tap cards, tap opponents for dice targets, drag darts, drag pool shots, safe-area padding, sticky action controls, and iOS web-app metadata.
