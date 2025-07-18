# run-migration.ps1
# Скрипт для выполнения миграций в payment-service

param(
    [switch]$Revert,
    [switch]$Show
)

Write-Host "Database Migrations for payment-service" -ForegroundColor Cyan

if (!(Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Make sure you are in payment-service directory" -ForegroundColor Red
    exit 1
}

if ($Show) {
    Write-Host "Showing migration history..." -ForegroundColor Yellow
    try {
        npm run typeorm:migration:run -- --dry-run
    } catch {
        Write-Host "Error showing migrations: $_" -ForegroundColor Red
    }
    exit 0
}

if ($Revert) {
    Write-Host "Reverting last migration..." -ForegroundColor Yellow
    $confirmation = Read-Host "Are you sure you want to revert the last migration? (y/N)"
    
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        try {
            npm run typeorm:migration:revert
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Migration reverted successfully!" -ForegroundColor Green
            } else {
                Write-Host "Error reverting migration" -ForegroundColor Red
            }
        } catch {
            Write-Host "Error occurred: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Revert cancelled" -ForegroundColor Yellow
    }
    exit 0
}

Write-Host "Running migrations..." -ForegroundColor Yellow

try {
    Write-Host "`nApplying new migrations..." -ForegroundColor Yellow
    npm run typeorm:migration:run
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "All migrations applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "Error running migrations" -ForegroundColor Red
    }
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
}

Write-Host "`nAvailable commands:" -ForegroundColor Cyan
Write-Host "   .\run-migration.ps1           - Run all new migrations" -ForegroundColor Gray
Write-Host "   .\run-migration.ps1 -Show     - Show migration history" -ForegroundColor Gray
Write-Host "   .\run-migration.ps1 -Revert   - Revert last migration" -ForegroundColor Gray 