# generate-migration.ps1
# Script for generating new migrations in payment-service

param(
    [Parameter(Mandatory=$true)]
    [string]$MigrationName
)

Write-Host "🔄 Generating migration: $MigrationName" -ForegroundColor Cyan

# Check if we are in the correct directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Make sure you are in the payment-service directory" -ForegroundColor Red
    exit 1
}

# Generate migration
Write-Host "📝 Executing command: npm run typeorm:migration:generate -- --name $MigrationName" -ForegroundColor Yellow
npm run typeorm:migration:generate -- --name $MigrationName

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration '$MigrationName' successfully generated!" -ForegroundColor Green
    Write-Host "📁 Check the file in src/migrations/ folder" -ForegroundColor Gray
} else {
    Write-Host "❌ Error during migration generation" -ForegroundColor Red
}

# Show list of migrations
Write-Host "`n📋 Current migrations:" -ForegroundColor Blue
Get-ChildItem -Path "src/migrations" -Filter "*.ts" | Sort-Object Name | ForEach-Object {
    Write-Host "   📄 $($_.Name)" -ForegroundColor Gray
}

Write-Host "`n💡 To apply migration use: .\run-migration.ps1" -ForegroundColor Cyan 