param(
  [string]$BaseUrl = "https://boombox-notion.vercel.app",
  [string]$AdminToken = ""
)

$ErrorActionPreference = "Stop"
$baseUrlClean = $BaseUrl.TrimEnd("/")
$apiUrl = $baseUrlClean + "/api/integrations/line/orders"

Write-Host ("Checking API: " + $apiUrl) -ForegroundColor Cyan

$headers = @{}
if ($AdminToken) {
  $headers["Authorization"] = "Bearer " + $AdminToken.Trim()
  Write-Host "Mode: checking with admin token" -ForegroundColor DarkGray
} else {
  Write-Host "Mode: checking route without token" -ForegroundColor DarkGray
}

try {
  $response = Invoke-WebRequest `
    -Method Get `
    -Uri $apiUrl `
    -Headers $headers `
    -UseBasicParsing

  Write-Host ("HTTP Status: " + $response.StatusCode) -ForegroundColor Green
  Write-Host "Response:" -ForegroundColor Yellow
  $response.Content

  if ($response.StatusCode -eq 200) {
    Write-Host "PASS: API and authorization are working" -ForegroundColor Green
  }
}
catch {
  $webResponse = $_.Exception.Response
  if ($webResponse) {
    $statusCode = [int]$webResponse.StatusCode
    Write-Host ("HTTP Status: " + $statusCode) -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
    $body = $reader.ReadToEnd()
    $reader.Dispose()
    Write-Host "Response:" -ForegroundColor Yellow
    $body

    switch ($statusCode) {
      401 { Write-Host "RESULT: Route exists, but token is missing or invalid" -ForegroundColor Yellow }
      404 { Write-Host "RESULT: Vercel has not deployed the API route, or the project points to the wrong repository/root" -ForegroundColor Red }
      500 { Write-Host "RESULT: Route exists; check Vercel environment variables and Supabase migration" -ForegroundColor Red }
      default { Write-Host "RESULT: Read the response above" -ForegroundColor Yellow }
    }
  } else {
    Write-Host ("Connection failed: " + $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host "`nChecking production page..." -ForegroundColor Cyan
try {
  $pageUrl = $baseUrlClean + "/?check=line-api"
  $html = (Invoke-WebRequest -Uri $pageUrl -UseBasicParsing).Content
  if ($html -match "LINE OA") {
    Write-Host "PASS: LINE OA menu found in production" -ForegroundColor Green
  } else {
    Write-Host "RESULT: LINE OA menu not found; production is still an old build" -ForegroundColor Red
  }
} catch {
  Write-Host ("Could not read production page: " + $_.Exception.Message) -ForegroundColor Yellow
}
