# Start exactly one isolated headless Chrome for the step-3 Contents-navigation
# QA run, print its pid, and wait until the CDP endpoint answers.
# Never touches a user profile or a user's running browser.
param(
    [int]$Port = 9341,
    [string]$ProfileDir = (Join-Path $env:TEMP 'book2-step3-chrome'),
    [string]$WindowSize = '1400,1000'
)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
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
        "--window-size=$WindowSize",
        'about:blank'
    )
    $p = Start-Process -FilePath $chrome -ArgumentList $args -PassThru -WindowStyle Hidden
    Write-Output "chrome pid: $($p.Id)  port: $Port  profile: $ProfileDir"
    Set-Content -LiteralPath (Join-Path $ProfileDir 'step3-chrome.pid') -Value $p.Id
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-Cdp) { break }
    }
}
if (-not (Test-Cdp)) { throw "headless Chrome did not answer on port $Port" }
$v = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version"
Write-Output "cdp ready: $($v.Browser)"
