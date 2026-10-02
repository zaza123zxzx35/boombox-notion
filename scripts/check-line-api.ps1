param(
  [string]$BaseUrl = "https://boombox-notion.vercel.app",
  [string]$AdminToken = ""
)

$ErrorActionPreference = "Stop"
$apiUrl = "$($BaseUrl.TrimEnd('/'))/api/integrations/line/orders"

Write-Host "ตรวจสอบ: $apiUrl" -ForegroundColor Cyan

$headers = @{}
if ($AdminToken) {
  $headers["X-Admin-Token"] = $AdminToken
  Write-Host "โหมด: ตรวจด้วย BACKOFFICE_ADMIN_TOKEN" -ForegroundColor DarkGray
} else {
  Write-Host "โหมด: ตรวจ route โดยไม่ส่ง Token" -ForegroundColor DarkGray
}

try {
  $response = Invoke-WebRequest `
    -Method Get `
    -Uri $apiUrl `
    -Headers $headers `
    -UseBasicParsing

  Write-Host "HTTP Status: $($response.StatusCode)" -ForegroundColor Green
  Write-Host "Response:" -ForegroundColor Yellow
  $response.Content

  if ($response.StatusCode -eq 200) {
    Write-Host "ผ่าน: API และสิทธิ์ใช้งานได้" -ForegroundColor Green
  }
}
catch {
  $webResponse = $_.Exception.Response
  if ($webResponse) {
    $statusCode = [int]$webResponse.StatusCode
    Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Dispose()
    Write-Host "Response:" -ForegroundColor Yellow
    $body

    switch ($statusCode) {
      401 { Write-Host "สรุป: route มีอยู่แล้ว แต่ Token ไม่ถูกต้องหรือยังไม่ได้ส่ง Token" -ForegroundColor Yellow }
      404 { Write-Host "สรุป: Vercel ยังไม่ได้ deploy api/integrations/line/orders.js หรือชี้ไปผิด Repository/Root Directory" -ForegroundColor Red }
      500 { Write-Host "สรุป: route มีอยู่ แต่ตรวจ Environment Variables และ Supabase migration" -ForegroundColor Red }
      default { Write-Host "สรุป: ตรวจรายละเอียด Response ด้านบน" -ForegroundColor Yellow }
    }
  } else {
    Write-Host "เชื่อมต่อไม่สำเร็จ: $($_.Exception.Message)" -ForegroundColor Red
  }
}

Write-Host "`nตรวจ source production เพิ่มเติม..." -ForegroundColor Cyan
try {
  $html = (Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/?check=line-api" -UseBasicParsing).Content
  if ($html -match "LINE OA") {
    Write-Host "พบเมนู LINE OA ใน production" -ForegroundColor Green
  } else {
    Write-Host "ไม่พบเมนู LINE OA: production ยังเป็น build เก่า" -ForegroundColor Red
  }
} catch {
  Write-Host "อ่านหน้าเว็บ production ไม่สำเร็จ: $($_.Exception.Message)" -ForegroundColor Yellow
}
