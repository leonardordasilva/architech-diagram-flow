# Inicia Podman + Supabase local
Write-Host "Iniciando Podman..." -ForegroundColor Cyan

$machine = podman machine list --format "{{.Name}},{{.LastUp}}" 2>$null | Select-Object -First 1
if ($machine -notmatch "Currently running") {
    podman machine start
    if (-not $?) { Write-Host "Erro ao iniciar Podman machine." -ForegroundColor Red; exit 1 }
} else {
    Write-Host "Podman machine ja esta rodando." -ForegroundColor Green
}

Write-Host "Expondo API Docker via TCP..." -ForegroundColor Cyan
$tcpJob = Get-NetTCPConnection -LocalPort 2375 -ErrorAction SilentlyContinue
if (-not $tcpJob) {
    Start-Job -ScriptBlock { podman system service --time=0 tcp://localhost:2375 } | Out-Null
    Start-Sleep -Seconds 2
} else {
    Write-Host "Porta 2375 ja esta em uso." -ForegroundColor Green
}

Write-Host "Iniciando Supabase..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
npx supabase start

if ($?) {
    Write-Host "`nSupabase rodando!" -ForegroundColor Green
    Write-Host "Studio:   http://127.0.0.1:54323" -ForegroundColor Yellow
    Write-Host "API:      http://127.0.0.1:54321" -ForegroundColor Yellow
    Write-Host "Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres" -ForegroundColor Yellow
}
