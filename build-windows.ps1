# Build CF-Hero for Windows

Write-Host "Building Web Dashboard..." -ForegroundColor Cyan
Push-Location web
npm install
npm run build
Pop-Location

Write-Host "Building Go Executable..." -ForegroundColor Cyan
# Build with hidden console window for a cleaner experience (optional, but good for dashboard mode)
# go build -ldflags "-H=windowsgui" -o Fortive-IP.exe ./cmd/Fortive-IP
# But since it's also a CLI, we keep the console:
go build -o Fortive-IP.exe ./cmd/Fortive-IP

Write-Host "Build Complete! Run .\Fortive-IP.exe -serve to start the dashboard." -ForegroundColor Green

