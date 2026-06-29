#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Verify Vercel deployment readiness sau khi áp dụng tất cả fixes.
  Chạy: pwsh scripts/verify-vercel-build.ps1
#>

$ErrorActionPreference = 'Stop'
$Project = "H:\Scripts\japanese-vocab-app"
Set-Location $Project

$passed = 0
$failed = 0

function Test-Check {
  param([string]$Name, [scriptblock]$Check)
  try {
    $result = & $Check
    if ($result.ok) {
      Write-Host "✅ PASS: $Name" -ForegroundColor Green
      if ($result.detail) { Write-Host "   → $($result.detail)" -ForegroundColor Gray }
      $script:passed++
    } else {
      Write-Host "❌ FAIL: $Name" -ForegroundColor Red
      Write-Host "   → $($result.reason)" -ForegroundColor Yellow
      $script:failed++
    }
  } catch {
    Write-Host "❌ ERROR: $Name — $_" -ForegroundColor Red
    $script:failed++
  }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  VERCEL DEPLOYMENT READINESS CHECK" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# PRE-BUILD CHECKS
Write-Host "--- Pre-build config checks ---" -ForegroundColor Magenta

Test-Check "vercel.json tồn tại" {
  $ok = Test-Path "$Project\vercel.json"
  @{ ok = $ok; reason = "vercel.json không tồn tại!" }
}

Test-Check "vercel.json có buildCommand đúng" {
  $v = Get-Content "$Project\vercel.json" | ConvertFrom-Json
  $ok = $v.buildCommand -like "*ng build*"
  @{ ok = $ok; detail = "buildCommand: $($v.buildCommand)"; reason = "buildCommand sai: $($v.buildCommand)" }
}

Test-Check "vercel.json có outputDirectory đúng" {
  $v = Get-Content "$Project\vercel.json" | ConvertFrom-Json
  $ok = $v.outputDirectory -eq "dist/japanese-vocab-app/browser"
  @{ ok = $ok; detail = $v.outputDirectory; reason = "outputDirectory sai: $($v.outputDirectory)" }
}

Test-Check "api/chat.ts tồn tại (Vercel Function)" {
  $ok = Test-Path "$Project\api\chat.ts"
  @{ ok = $ok; reason = "api/chat.ts không tồn tại — /api/chat sẽ 404 trên Vercel!" }
}

Test-Check "angular.json có public/ trong assets" {
  $content = Get-Content "$Project\angular.json" -Raw
  $ok = $content -match '"input":\s*"public"'
  @{ ok = $ok; reason = "public/ không có trong assets → manifest.webmanifest sẽ 404" }
}

Test-Check "ngsw-config.json dùng /api/chat (không phải /api/ai/chat)" {
  $content = Get-Content "$Project\ngsw-config.json" -Raw
  $hasOld = $content -match '/api/ai/chat'
  $hasNew = $content -match '/api/chat'
  @{ ok = (-not $hasOld -and $hasNew); reason = "ngsw-config.json vẫn có /api/ai/chat cũ" }
}

Test-Check "package.json có vercel-build script" {
  $pkg = Get-Content "$Project\package.json" | ConvertFrom-Json
  $ok = $pkg.scripts.'vercel-build' -ne $null
  @{ ok = $ok; detail = $pkg.scripts.'vercel-build'; reason = "Thiếu vercel-build script" }
}

Test-Check "@vercel/node trong devDependencies" {
  $pkg = Get-Content "$Project\package.json" | ConvertFrom-Json
  $ok = $pkg.devDependencies.'@vercel/node' -ne $null
  @{ ok = $ok; reason = "Thiếu @vercel/node — Vercel Function type declarations sẽ fail" }
}

# BUILD
Write-Host ""
Write-Host "--- Build ---" -ForegroundColor Magenta
Write-Host "Đang chạy ng build..." -ForegroundColor Yellow

Test-Check "ng build thành công" {
  $output = & ng build 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    $errLines = ($output | Where-Object { $_ -match 'error|Error' } | Select-Object -First 5) -join "`n"
    @{ ok = $false; reason = "Build fail (exit $exitCode). Errors:`n$errLines" }
  } else {
    @{ ok = $true; detail = "Build thành công" }
  }
}

# POST-BUILD CHECKS
Write-Host ""
Write-Host "--- Post-build output checks ---" -ForegroundColor Magenta

Test-Check "Copy index.csr.html → index.html" {
  $src = "$Project\dist\japanese-vocab-app\browser\index.csr.html"
  $dst = "$Project\dist\japanese-vocab-app\browser\index.html"
  if (-not (Test-Path $src)) {
    @{ ok = $false; reason = "index.csr.html không tồn tại sau build" }
  } else {
    Copy-Item $src $dst -Force
    @{ ok = $true; detail = "index.html đã được tạo từ index.csr.html" }
  }
}

Test-Check "dist/browser/manifest.webmanifest tồn tại" {
  $ok = Test-Path "$Project\dist\japanese-vocab-app\browser\manifest.webmanifest"
  @{ ok = $ok; reason = "manifest.webmanifest KHÔNG có trong build output — vẫn sẽ 404 trên Vercel!" }
}

Test-Check "dist/browser/favicon.ico tồn tại" {
  $ok = Test-Path "$Project\dist\japanese-vocab-app\browser\favicon.ico"
  @{ ok = $ok; reason = "favicon.ico thiếu trong build output" }
}

Test-Check "dist/browser/index.html tồn tại" {
  $ok = Test-Path "$Project\dist\japanese-vocab-app\browser\index.html"
  @{ ok = $ok; reason = "index.html thiếu — root path / sẽ 404" }
}

Test-Check "dist/browser/ngsw.json tồn tại" {
  $ok = Test-Path "$Project\dist\japanese-vocab-app\browser\ngsw.json"
  @{ ok = $ok; reason = "ngsw.json thiếu — Service Worker sẽ fail" }
}

Test-Check "ngsw.json compiled không còn /api/ai/chat" {
  $ngswPath = "$Project\dist\japanese-vocab-app\browser\ngsw.json"
  if (-not (Test-Path $ngswPath)) {
    @{ ok = $false; reason = "ngsw.json không tồn tại" }
  } else {
    $content = Get-Content $ngswPath -Raw
    $hasOld = $content -match '/api/ai/chat'
    @{ ok = (-not $hasOld); reason = "ngsw.json compiled vẫn còn /api/ai/chat" }
  }
}

# SUMMARY
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  KẾT QUẢ: $passed PASS / $failed FAIL" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

if ($failed -eq 0) {
  Write-Host ""
  Write-Host "✅ Sẵn sàng deploy lên Vercel!" -ForegroundColor Green
  Write-Host ""
  Write-Host "Chạy:" -ForegroundColor White
  Write-Host "  vercel deploy --prod" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Hoặc push lên git để Vercel auto-deploy:" -ForegroundColor White
  Write-Host "  git add vercel.json api/chat.ts angular.json ngsw-config.json package.json" -ForegroundColor Cyan
  Write-Host "  git commit -m 'fix: add Vercel config and api/chat serverless function'" -ForegroundColor Cyan
  Write-Host "  git push" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "⚠️ $failed vấn đề cần giải quyết trước khi deploy." -ForegroundColor Yellow
}
