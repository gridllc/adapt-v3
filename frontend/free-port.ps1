# PowerShell script to free port 5173 if it's busy
# Usage: .\free-port.ps1

Write-Host "🔍 Checking if port 5173 is in use..." -ForegroundColor Yellow

$processes = netstat -ano | findstr :5173

if ($processes) {
    Write-Host "❌ Port 5173 is in use by the following processes:" -ForegroundColor Red
    Write-Host $processes -ForegroundColor Red
    
    Write-Host "`n🔄 Attempting to free port 5173..." -ForegroundColor Yellow
    
    # Extract PIDs and kill them
    $processes -split "`n" | ForEach-Object {
        if ($_ -match '\s+(\d+)$') {
            $pid = $matches[1]
            Write-Host "🔄 Killing process with PID: $pid" -ForegroundColor Yellow
            try {
                taskkill /F /PID $pid 2>$null
                Write-Host "✅ Process $pid killed successfully" -ForegroundColor Green
            } catch {
                Write-Host "❌ Failed to kill process $pid" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "`n✅ Port 5173 should now be free!" -ForegroundColor Green
} else {
    Write-Host "✅ Port 5173 is free!" -ForegroundColor Green
}

Write-Host "`n💡 Alternative: Use 'npx kill-port 5173' if this script doesn't work" -ForegroundColor Cyan

