# Script para desplegar Edge Functions de Supabase
# Uso: .\deploy-functions.ps1

Write-Host "🚀 Desplegando Edge Functions de Supabase..." -ForegroundColor Cyan
Write-Host ""

# Verificar que las funciones existen
if (-not (Test-Path "supabase\functions\send-expiration-alerts\index.ts")) {
    Write-Host "❌ Error: No se encuentra send-expiration-alerts\index.ts" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "supabase\functions\send-operation-notification\index.ts")) {
    Write-Host "❌ Error: No se encuentra send-operation-notification\index.ts" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Desplegando send-expiration-alerts..." -ForegroundColor Yellow
npx supabase functions deploy send-expiration-alerts --project-ref ilufjftwomzjghhesixt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ send-expiration-alerts desplegada correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error al desplegar send-expiration-alerts" -ForegroundColor Red
}

Write-Host ""
Write-Host "📦 Desplegando send-operation-notification..." -ForegroundColor Yellow
npx supabase functions deploy send-operation-notification --project-ref ilufjftwomzjghhesixt

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ send-operation-notification desplegada correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error al desplegar send-operation-notification" -ForegroundColor Red
}

Write-Host ""
Write-Host "✨ Proceso completado" -ForegroundColor Cyan

