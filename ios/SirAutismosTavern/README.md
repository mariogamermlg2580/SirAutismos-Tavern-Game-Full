# Sir Autismos Tavern iOS Wrapper

This is a native iOS wrapper for the HTML game. It opens `SirAutismosTavern/Web/index.html` in a fullscreen `WKWebView`.

The iOS web bundle is intentionally separate from the Windows version. It has a mobile-first overhaul with separate screens for cards, darts, and 8-ball billiards, wager support, animated dart hits, 3D-styled canvas tables, pixel silhouette spectators, and iPhone safe-area controls.

You need macOS + Xcode to compile the iOS binary. Windows can prepare the files, but it cannot produce the iPhone executable inside an IPA.

To make an unsigned IPA on a Mac:

```bash
cd ios/SirAutismosTavern
chmod +x build_unsigned_ipa.sh
./build_unsigned_ipa.sh
```

Output:

```text
ios/SirAutismosTavern/dist/Sir Autismos Tavern Cards and Stuff - unsigned.ipa
```

Then sign it with your Apple developer identity/provisioning profile, or open `SirAutismosTavern.xcodeproj` in Xcode and archive/export with your signing settings.

## Free GitHub Actions build

You can also build the unsigned IPA for free by uploading this `SirAutismosTavern` folder to a public GitHub repository.

1. Create a public GitHub repo.
2. Upload the contents of this `SirAutismosTavern` folder to the repo root.
3. Open the repo's Actions tab.
4. Choose `Build Unsigned IPA`.
5. Click `Run workflow`.
6. When it finishes, download the `Sir-Autismos-Tavern-unsigned-IPA` artifact.

The workflow lives at:

```text
.github/workflows/build-unsigned-ipa.yml
```
