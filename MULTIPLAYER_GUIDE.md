# Sir Autismos Tavern Online Multiplayer Guide

This build includes a multiplayer-ready room server. The current online layer connects players, creates room codes, shares table logs, and sends public table sync snapshots. It is the foundation for full online card/darts/pool turns.

## 1. Start The Server On Your PC

Install Node.js if you do not already have it, then open a terminal in the game folder and run:

```bash
npm run server
```

You should see:

```text
Sir Autismos Tavern multiplayer server listening on ws://localhost:3217
```

Leave that terminal open while playing.

## 2. Test On The Same Computer

1. Open the game.
2. On the title screen, keep the server URL as:

```text
ws://localhost:3217
```

3. Press `Host`.
4. Copy the room code.
5. Open another copy of the game.
6. Type the same room code and press `Join`.

Both windows should show the room status and unlock the Room Code Regular achievement.

## 3. Play On The Same Wi-Fi

On the host computer, find your local IP address:

```powershell
ipconfig
```

Look for `IPv4 Address`, something like `192.168.1.25`.

Your friend uses this server URL:

```text
ws://192.168.1.25:3217
```

The host presses `Host`, then the friend enters the room code and presses `Join`.

If it does not connect, Windows Firewall may ask to allow Node.js. Allow it on private networks.

## 4. Put The Server Online

Free-ish choices that work well for testing:

- Render free web service
- Railway trial/free credits
- Fly.io free allowance if available
- A spare home PC with port forwarding

When hosted online, your game server URL will look like:

```text
wss://your-server-name.example.com
```

Use `wss://` for a secure hosted site, not `ws://`.

## 5. Safety Settings For Public Hosting

When you put the server on Render, add these environment variables in the Render service settings.

At minimum, set a server token:

```text
SERVER_TOKEN=make-a-long-secret-password-here
```

Then put the token into the game server URL:

```text
wss://your-server-name.onrender.com?token=make-a-long-secret-password-here
```

That keeps random people from joining your server unless they know the secret token.

Recommended Render environment variables:

```text
SERVER_TOKEN=make-a-long-secret-password-here
MAX_CLIENTS=40
MAX_ROOMS=20
MAX_ROOM_CLIENTS=4
MAX_MESSAGES_PER_WINDOW=40
RATE_WINDOW_MS=10000
MAX_MESSAGE_BYTES=8192
```

Optional stricter origin lock:

```text
ALLOWED_ORIGINS=null,file://
```

Use `null,file://` for Electron/file builds. If you later host the game as a website, use that website origin instead, such as:

```text
ALLOWED_ORIGINS=https://your-game-site.example.com
```

The server also includes:

- Message size limits
- Room/client limits
- Rate limits
- Room code validation
- Safer broadcast payload validation
- Idle client cleanup
- Token-gated public hosting

## 6. Current Multiplayer Scope

This version is multiplayer-ready, meaning the room system is built and the game can connect, host, join, leave, share logs, and send sync snapshots.

The next step for full online play is making the server authoritative for:

- Deck shuffle and card dealing
- Hidden hands
- Legal move checks
- Dice rolls
- Shop item use
- Darts and pool input validation
- Win/loss rewards

That keeps online games fair and prevents desyncs.
