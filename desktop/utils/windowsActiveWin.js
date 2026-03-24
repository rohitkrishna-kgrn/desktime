/**
 * windowsActiveWin.js
 *
 * Zero-native-dependency active window detection for Windows.
 * Spawns a single persistent PowerShell process that compiles the Win32
 * P/Invoke code ONCE on startup, then answers "get" commands fast.
 *
 * Roundtrip per query after warm-up: ~10–20 ms.
 */

const { spawn } = require('child_process');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

// PowerShell script written to %TEMP% once
const SCRIPT_PATH = path.join(os.tmpdir(), 'desktime_active_win.ps1');

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class DeskTimeWin32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
    $cmd = [Console]::ReadLine()
    if ($null -eq $cmd -or $cmd -eq 'q') { break }
    try {
        $hwnd   = [DeskTimeWin32]::GetForegroundWindow()
        $pidRef = 0
        [DeskTimeWin32]::GetWindowThreadProcessId($hwnd, [ref]$pidRef) | Out-Null
        $sb = New-Object System.Text.StringBuilder 512
        [DeskTimeWin32]::GetWindowText($hwnd, $sb, 512) | Out-Null
        $proc = Get-Process -Id $pidRef -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName) {
            [Console]::WriteLine($proc.ProcessName + '|' + $sb.ToString())
        } else {
            [Console]::WriteLine('idle|')
        }
    } catch {
        [Console]::WriteLine('idle|')
    }
}
`.trimStart();

let psProcess  = null;
let psReady    = false;
let pendingResolve = null;
let outputBuf  = '';
let startupTimer = null;

function ensureScript() {
  try { fs.writeFileSync(SCRIPT_PATH, PS_SCRIPT, 'utf8'); } catch { /* ignore */ }
}

function startPS() {
  ensureScript();

  psProcess = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-File', SCRIPT_PATH],
    { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
  );

  psProcess.stdout.setEncoding('utf8');

  // Warm-up: Add-Type compilation takes ~800ms on first run
  // Send a probe "get" after 1200ms; if we get a response, mark ready
  startupTimer = setTimeout(() => {
    if (psProcess && !psProcess.killed) {
      psProcess.stdin.write('get\n');
    }
  }, 1200);

  psProcess.stdout.on('data', (chunk) => {
    outputBuf += chunk;
    const lines = outputBuf.split('\n');
    outputBuf = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      psReady = true; // at least one response received

      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve(parseResult(trimmed));
      }
    }
  });

  psProcess.on('error', () => { psReady = false; psProcess = null; });
  psProcess.on('exit',  () => { psReady = false; psProcess = null; });
}

function parseResult(line) {
  const idx = line.indexOf('|');
  if (idx === -1) return { processName: 'idle', title: '' };
  return {
    processName: line.slice(0, idx).trim() || 'idle',
    title:       line.slice(idx + 1).trim(),
  };
}

/**
 * Get the currently focused window.
 * Returns { processName, title } or null on timeout.
 */
function getActiveWindow() {
  return new Promise((resolve) => {
    // Start PS if not running
    if (!psProcess || psProcess.killed) {
      startPS();
    }

    if (!psReady) {
      // Still warming up — return null
      resolve(null);
      return;
    }

    // Set 2-second timeout in case PS hangs
    const timer = setTimeout(() => {
      pendingResolve = null;
      resolve(null);
    }, 2000);

    pendingResolve = (result) => {
      clearTimeout(timer);
      resolve(result);
    };

    try {
      psProcess.stdin.write('get\n');
    } catch {
      clearTimeout(timer);
      pendingResolve = null;
      resolve(null);
    }
  });
}

function shutdown() {
  if (startupTimer) clearTimeout(startupTimer);
  if (psProcess && !psProcess.killed) {
    try { psProcess.stdin.write('q\n'); } catch { /* ignore */ }
    psProcess.kill();
  }
  psProcess = null;
  psReady   = false;
}

// Pre-start on module load so PS is warm by the time tracking begins
startPS();

module.exports = { getActiveWindow, shutdown };
