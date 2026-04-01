/**
 * windowsActiveWin.js
 *
 * Gets the currently active window (process name + title) on Windows.
 *
 * Uses a persistent PowerShell process with:
 *   -ExecutionPolicy Bypass  — works on restricted/corporate machines
 *   -EncodedCommand          — passes script as base64 (no temp file, no AV flags)
 *
 * Falls back to returning null (recorded as idle) if PowerShell is
 * unavailable or blocked, rather than crashing the app.
 */

const { spawn } = require('child_process');

// ── PowerShell script ────────────────────────────────────────────────────────
// Reads "get" commands from stdin, responds with "processName|windowTitle\n"
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

// Encode script as UTF-16LE base64 for PowerShell -EncodedCommand.
// This avoids writing any temp file (no AV flags) and bypasses execution policy.
function buildEncodedArg(script) {
  const buf = Buffer.alloc(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    buf.writeUInt16LE(script.charCodeAt(i), i * 2);
  }
  return buf.toString('base64');
}

const ENCODED_SCRIPT = buildEncodedArg(PS_SCRIPT);

// ── State ────────────────────────────────────────────────────────────────────
let psProcess     = null;
let psReady       = false;
let pendingResolve = null;
let outputBuf     = '';
let startupTimer  = null;
let startAttempts = 0;
const MAX_ATTEMPTS = 3;

// ── Safe stdin write — never throws ─────────────────────────────────────────
function safeWrite(data) {
  if (!psProcess || psProcess.killed || !psProcess.stdin.writable) return false;
  try {
    psProcess.stdin.write(data);
    return true;
  } catch {
    // EPIPE or other write error — process is gone
    psReady = false;
    psProcess = null;
    return false;
  }
}

// ── Parse a "processName|title" line ────────────────────────────────────────
function parseResult(line) {
  const idx = line.indexOf('|');
  if (idx === -1) return { processName: 'idle', title: '' };
  return {
    processName: line.slice(0, idx).trim() || 'idle',
    title:       line.slice(idx + 1).trim(),
  };
}

// ── Start / restart the PowerShell child process ─────────────────────────────
function startPS() {
  if (startAttempts >= MAX_ATTEMPTS) {
    console.warn('[ActiveWin] PowerShell failed after max attempts — app tracking disabled');
    return;
  }
  startAttempts++;

  try {
    psProcess = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',  // works on restricted/corporate machines
        '-EncodedCommand', ENCODED_SCRIPT, // no temp file — bypasses AV
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );
  } catch (err) {
    console.warn('[ActiveWin] Failed to spawn PowerShell:', err.message);
    psProcess = null;
    return;
  }

  // Prevent unhandled EPIPE on stdin
  psProcess.stdin.on('error', () => {
    psReady = false;
  });

  psProcess.stdout.setEncoding('utf8');
  psProcess.stdout.on('error', () => {});

  // Warm-up: Add-Type compilation takes ~800-1200ms on first run.
  // Send a probe after 2s; first response marks psReady = true.
  startupTimer = setTimeout(() => {
    safeWrite('get\n');
  }, 2000);

  psProcess.stdout.on('data', (chunk) => {
    outputBuf += chunk;
    const lines = outputBuf.split('\n');
    outputBuf = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      psReady = true;

      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve(parseResult(trimmed));
      }
    }
  });

  psProcess.on('error', (err) => {
    console.warn('[ActiveWin] PS process error:', err.message);
    psReady = false;
    psProcess = null;
  });

  psProcess.on('exit', (code) => {
    console.warn(`[ActiveWin] PS process exited (code ${code})`);
    psReady = false;
    psProcess = null;

    // Resolve any pending request as idle so callers aren't stuck
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve({ processName: 'idle', title: '' });
    }
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the currently focused window.
 * Returns { processName, title } or null on timeout / PS unavailable.
 */
function getActiveWindow() {
  return new Promise((resolve) => {
    // If max attempts reached, return null (all samples → idle)
    if (startAttempts >= MAX_ATTEMPTS && !psProcess) {
      resolve(null);
      return;
    }

    // Restart PS if it died
    if (!psProcess || psProcess.killed) {
      startPS();
    }

    // Still warming up — return null (sample skipped, no elapsed added)
    if (!psReady) {
      resolve(null);
      return;
    }

    // 2-second timeout guards against PS hangs
    const timer = setTimeout(() => {
      pendingResolve = null;
      resolve(null);
    }, 2000);

    pendingResolve = (result) => {
      clearTimeout(timer);
      resolve(result);
    };

    if (!safeWrite('get\n')) {
      clearTimeout(timer);
      pendingResolve = null;
      resolve(null);
    }
  });
}

function shutdown() {
  if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; }
  if (psProcess && !psProcess.killed) {
    safeWrite('q\n');
    try { psProcess.kill(); } catch { /* already dead */ }
  }
  psProcess = null;
  psReady   = false;
}

// Pre-start on module load so PS is warm by the time tracking begins
startPS();

module.exports = { getActiveWindow, shutdown };
