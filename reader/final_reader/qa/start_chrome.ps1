# Start one isolated headless Chrome for the redesign QA run.
# Dedicated profile + port; the user's own Chrome is never touched.
param(
    [int]$Port = 9361,
    [string]$ProfileDir = (Join-Path $env:TEMP 'book2-redesign-chrome'),
    [string]$WindowSize = '1600,1000'
)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) {
    $chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
}
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

function Test-Cdp {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 | Out-Null; return $true }
    catch { return $false }
}

if (-not (Test-Cdp)) {
    $args = @(
        '--headless=new',
        "--remote-debugging-port=$Port",
        "--user-data-dir=$ProfileDir",
        '--no-first-run', '--no-default-browser-check', '--disable-extensions',
        '--disable-background-networking', '--disable-component-update',
        '--disable-sync', '--disable-default-apps', '--mute-audio',
        '--no-service-autorun', '--disable-features=Translate,MediaRouter',
        '--allow-file-access-from-files', '--disable-gpu',
        '--hide-scrollbars=false',
        "--window-size=$WindowSize",
        'about:blank'
    )
    $p = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -WindowStyle Hidden
    Write-Output "chrome pid: $($p.Id)  port: $Port  profile: $ProfileDir"
    Set-Content -LiteralPath (Join-Path $ProfileDir 'redesign-chrome.pid') -Value $p.Id
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-Cdp) { break }
    }
}
if (-not (Test-Cdp)) { throw "headless Chrome did not answer on port $Port" }
$v = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version"
Write-Output "cdp ready: $($v.Browser)"
