# cintelis-monitor

Live Windows TCP connection monitor with search, alerting, monitoring, and logging. Polls `netstat -ano -f` every second, streams results to a split-pane UI (outbound vs inbound/listening), and can log OPEN/CLOSE events.

## Prereqs
- Node.js installed
- Windows (uses `netstat -ano -f`)

## Setup
```powershell
cd C:\code\cintelis-monitor
npm install ws
```

## Run
```powershell
node server.js
```
Open http://localhost:8080. Outbound on the left; inbound/listening on the right. Updates every second.

## Search & Monitor
- Search box highlights matches (IP/host/port/state/PID). Hostnames appear because `netstat -f` resolves them.
- Tick "monitor" (or use terminal command) to open the Active Monitoring window; it logs matching OPEN/CLOSE events in a table (Time, Event, Proto, Local, Remote, Remote Host/Port, State, PID).
- One monitor window only; it auto-opens on the first match.

## Logging (file)
- Click "Start logging" or terminal `start` to create `connections-log-*.txt` in the app folder.
- Logs OPEN/CLOSE with timestamp, endpoints, PID, state. `stop` ends logging.

## In-page Terminal Commands
- `help` — list commands and examples.
- `start` / `stop` — toggle file logging.
- `status` — logging state.
- `clear` — clear the terminal view.
- `search <term> [monitor|-monitor|--monitor] [-log]` — set search filter; `monitor` enables Active Monitoring window; `-log` turns on file logging.
  - Examples:
    - `search 93.127.215.188:4444 monitor`
    - `search rs.bitken.cloud --monitor -log`
    - `search 4444`
- `Ctrl+C` in the terminal box — stop monitoring and close the Active Monitoring window (keeps current search text).

## C2 Probe Script (testing/IR)
- File: `probe-c2.ps1`
- Purpose: quick TCP probe to the hardcoded C2 (`rs.bitken.cloud:4444`), sends a JSON ping, waits up to 10s for any response, reports result.
- Use cases: reproduce/confirm reachability during security incidents; correlate with the monitor UI.
- Run from repo root:
```powershell
powershell -ExecutionPolicy Bypass -File .\probe-c2.ps1
```
- While the script runs, you can watch the connection appear in the monitor UI by searching/monitoring for `rs.bitken.cloud` or `4444`.

## Notes
- Runs without admin, but run shell as Administrator if you need full PID/state visibility.
- Refresh rate: 1000 ms; change `setInterval` in `server.js` if needed.
- If port 8080 is busy, kill the process using it (`netstat -ano | findstr :8080`, `taskkill /PID <PID> /F`) or change the port in `server.js`.
