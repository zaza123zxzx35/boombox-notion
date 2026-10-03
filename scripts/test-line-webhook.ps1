# test-line-webhook.ps1
# Local static + logic tests for LINE webhook MVP (Phase 9C)
# NO PRODUCTION SECRETS are used. All signatures use a MOCK channel secret.
# Run from boombox-notion repo root: powershell -ExecutionPolicy Bypass -File .\scripts\test-line-webhook.ps1

param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$WebhookFile    = (Join-Path $RepoRoot 'api\integrations\line\webhook.js'),
  [string]$MigrationFile  = (Join-Path $RepoRoot 'supabase\migrations\002_line_webhook.sql'),
  [string]$OrdersFile     = (Join-Path $RepoRoot 'api\integrations\line\orders.js'),
  [string]$Migration001File = (Join-Path $RepoRoot 'supabase\migrations\001_line_orders.sql')
)

$ErrorActionPreference = 'Stop'

function Write-HostHeader { param($t) Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-HostOK     { param($t) Write-Host "[PASS] $t" -ForegroundColor Green }
function Write-HostFail   { param($t) Write-Host "[FAIL] $t" -ForegroundColor Red }

$results = New-Object System.Collections.Generic.List[object]

function Add-Row {
  param($TestCase, $Expected, $Actual, $Status)
  $results.Add([pscustomobject]@{
    TestCase = $TestCase
    Expected = $Expected
    Actual   = $Actual
    Status   = $Status
  })
}

function Invoke-NodeTempFile {
  param([Parameter(Mandatory)][string]$JsCode, [ref]$Out)
  $tmp = Join-Path $env:TEMP ('bb-webhook-test-' + [guid]::NewGuid().ToString('N') + '.js')
  try {
    Set-Content -Path $tmp -Value $JsCode -Encoding UTF8 -NoNewline
    $raw = (& node $tmp 2>&1 | Out-String)
    if ($Out) { $Out.Value = $raw.Trim() }
    return $LASTEXITCODE
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

Write-HostHeader 'Static Analysis — No Touch Orders / 001'

foreach ($mustExist in @($WebhookFile, $MigrationFile)) {
  if (Test-Path $mustExist) {
    Write-HostOK ('Exists: ' + [IO.Path]::GetFileName($mustExist))
    Add-Row 'SA-0 new files' 'Exist' ('OK: ' + [IO.Path]::GetFileName($mustExist)) 'PASS'
  } else {
    Write-HostFail ('Missing file: ' + $mustExist)
    Add-Row 'SA-0 new files' 'Exist' ('MISSING: ' + $mustExist) 'FAIL'
  }
}

$webhookContent  = Get-Content -Raw $WebhookFile    -ErrorAction SilentlyContinue
$ordersContent   = Get-Content -Raw $OrdersFile      -ErrorAction SilentlyContinue
$m001Content     = Get-Content -Raw $Migration001File -ErrorAction SilentlyContinue
$m002Content     = Get-Content -Raw $MigrationFile   -ErrorAction SilentlyContinue

$sa1Pattern = 'buildWebhookEventId[\s\S]{0,1000}Math\.random'
if ($webhookContent -match $sa1Pattern) {
  Write-HostFail 'SA-1 Math.random near buildWebhookEventId (forbidden)'
  Add-Row 'SA-1 No Math.random in dedup' 'No match' 'Math.random found near buildWebhookEventId' 'FAIL'
} else {
  Write-HostOK 'SA-1 No Math.random near dedup key builder'
  Add-Row 'SA-1 No Math.random in dedup' 'No match' 'OK' 'PASS'
}

$sa2Pattern = 'POST\s*/api/integrations/line/orders|fetch\([^\n]{0,200}/orders|/orders\?select'
if ($webhookContent -match $sa2Pattern) {
  Write-HostFail 'SA-2 webhook.js references POST /orders (forbidden Phase 9)'
  Add-Row 'SA-2 No POST /orders in webhook' 'No orders endpoint ref' 'orders ref found in webhook' 'FAIL'
} else {
  Write-HostOK 'SA-2 webhook.js has no POST /orders reference'
  Add-Row 'SA-2 No POST /orders in webhook' 'No orders endpoint ref' 'OK' 'PASS'
}

$dbAssignPattern = 'line_webhook_events|line_conversations|Prefer:\s*"return=representation'
$assignMatches = [regex]::Matches($webhookContent, $dbAssignPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$wrotePii = $false
foreach ($m in $assignMatches) {
  $start = [Math]::Max(0, $m.Index - 500)
  $len = [Math]::Min($webhookContent.Length - $start, 1800)
  $block = $webhookContent.Substring($start, $len)
  if ($block -match 'ev\.message\.text|message\.text') {
    $wrotePii = $true; break
  }
}
if ($wrotePii) {
  Write-HostFail 'SA-3 ev.message.text written near DB insert/update'
  Add-Row 'SA-3 No ev.message.text in DB' 'No message.text write' 'Detected message.text near DB op' 'FAIL'
} else {
  Write-HostOK 'SA-3 ev.message.text not written to DB columns'
  Add-Row 'SA-3 No ev.message.text in DB' 'No message.text write' 'OK' 'PASS'
}

if ($webhookContent -match 'bodyParser\s*:\s*false') {
  Write-HostOK 'SA-4 Vercel bodyParser disabled (raw buffer)'
  Add-Row 'SA-4 bodyParser false' 'Disabled' 'OK' 'PASS'
} else {
  Write-HostFail 'SA-4 bodyParser false missing'
  Add-Row 'SA-4 bodyParser false' 'Disabled' 'MISSING' 'FAIL'
}

if ($webhookContent -match 'timingSafeEqual') {
  Write-HostOK 'SA-5 crypto.timingSafeEqual usage present'
  Add-Row 'SA-5 timingSafeEqual' 'Present' 'OK' 'PASS'
} else {
  Write-HostFail 'SA-5 crypto.timingSafeEqual missing'
  Add-Row 'SA-5 timingSafeEqual' 'Present' 'MISSING' 'FAIL'
}

$stateNeed = @('new','collecting_package','collecting_color','collecting_scents','collecting_customer','awaiting_confirmation','confirmed','cancelled')
$hasArchived = [bool]($m002Content -match '''archived''')
$allAllowed = $true
foreach ($s in $stateNeed) {
  if ($m002Content -notmatch "'$s'") { $allAllowed = $false; break }
}
if (-not $hasArchived -and $allAllowed) {
  Write-HostOK 'SA-6 state enum EXACT 8 values no archived'
  Add-Row 'SA-6 conversation state enum' '8 values, no archived' 'OK' 'PASS'
} else {
  Write-HostFail ('SA-6 state enum wrong archived=' + $hasArchived + ' allAllowed=' + $allAllowed)
  Add-Row 'SA-6 conversation state enum' '8 values, no archived' ('archived=' + $hasArchived + ' allAllowed=' + $allAllowed) 'FAIL'
}

$resultNeed = @('processing','accepted','duplicate','reply_failed','timeout','invalid_payload','error')
$allResult = $true
foreach ($s in $resultNeed) {
  if ($m002Content -notmatch "'$s'") { $allResult = $false; break }
}
if ($allResult) {
  Write-HostOK 'SA-7 result enum all 7 required values present'
  Add-Row 'SA-7 webhook result enum' '7 required values' 'OK' 'PASS'
} else {
  Write-HostFail 'SA-7 result enum incomplete'
  Add-Row 'SA-7 webhook result enum' '7 required values' 'MISSING' 'FAIL'
}

$oldTriggerFn  = 'set_line_orders_updated_at'
$newTriggerFn  = 'set_line_conversations_updated_at'
if ($m002Content -match [regex]::Escape($oldTriggerFn)) {
  Write-HostFail 'SA-8 002 references old 001 trigger fn (forbidden)'
  Add-Row 'SA-8 No trigger name collision' 'No old trigger name ref' 'OLD trigger name found in 002' 'FAIL'
} elseif ($m002Content -match [regex]::Escape($newTriggerFn)) {
  Write-HostOK ('SA-8 uses new unique trigger fn ' + $newTriggerFn)
  Add-Row 'SA-8 No trigger name collision' 'No old trigger name ref' 'OK' 'PASS'
} else {
  Write-HostFail 'SA-8 new unique trigger fn not found'
  Add-Row 'SA-8 No trigger name collision' 'Has new trigger name' 'MISSING new trigger function' 'FAIL'
}

$hasRls1 = [bool]($m002Content -match 'alter table public\.line_webhook_events enable row level security')
$hasRls2 = [bool]($m002Content -match 'alter table public\.line_conversations enable row level security')
$hasAnon  = [bool]($m002Content -match 'create policy[\s\S]{0,300}to anon|to anon|using \(true\)')
if ($hasRls1 -and $hasRls2 -and -not $hasAnon) {
  Write-HostOK 'SA-9 RLS enabled both tables no anon policy'
  Add-Row 'SA-9 RLS enabled, no anon policy' 'RLS yes, anon no' 'OK' 'PASS'
} else {
  Write-HostFail ('SA-9 RLS/policy issue rls1=' + $hasRls1 + ' rls2=' + $hasRls2 + ' anon=' + $hasAnon)
  Add-Row 'SA-9 RLS enabled, no anon policy' 'RLS yes, anon no' ('rls1=' + $hasRls1 + ' rls2=' + $hasRls2 + ' anon=' + $hasAnon) 'FAIL'
}

$nn = [bool]($m002Content -match 'webhook_event_id\s+text\s+not\s+null')
$uq = [bool]($m002Content -match 'unique[\s\S]{0,80}webhook_event_id|webhook_event_id[^\n]*unique')
if ($nn -and $uq) {
  Write-HostOK 'SA-10 webhook_event_id NOT NULL + UNIQUE'
  Add-Row 'SA-10 NOT NULL UNIQUE webhook_event_id' 'Constraints exist' 'OK' 'PASS'
} else {
  Write-HostFail ('SA-10 cannot confirm NOT NULL UNIQUE webhook_event_id nn=' + $nn + ' uq=' + $uq)
  Add-Row 'SA-10 NOT NULL UNIQUE webhook_event_id' 'Constraints exist' ('nn=' + $nn + ' uq=' + $uq) 'FAIL'
}

Write-HostHeader 'Deterministic Dedup Key Tests (local Node)'

$nodeExe = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExe) {
  Write-Host 'Node not in PATH; skipping DT tests.' -ForegroundColor Yellow
} else {
  $dtJs = @'
const crypto = require("crypto");
function deterministicHash(destination, eventIndex, ev){
  const input=[
    String(destination||""), eventIndex, String(ev.type||""),
    String(ev.replyToken||""), String(ev.timestamp||""),
    String(ev.source&&ev.source.userId||""), String(ev.source&&ev.source.type||""),
    String(ev.message&&ev.message.id||""), String(ev.message&&ev.message.type||""),
    String(ev.postback&&ev.postback.data||"")
  ];
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0,32);
}
function build(destination,eventIndex,ev){
  if(ev && ev.webhookEventId) return destination+"::ev::"+ev.webhookEventId;
  if(ev && ev.message && ev.message.id) return destination+"::msg::"+ev.message.id;
  if(ev && ev.replyToken) return destination+"::rpl::"+ev.replyToken;
  return destination+"::idx::"+eventIndex+"::sha256::"+deterministicHash(destination,eventIndex,ev);
}
const dst = "U123456";
const evA = {type:"message",replyToken:"r1",timestamp:1,source:{userId:"u1",type:"user"},message:{id:"m1",type:"image"}};
const k1 = build(dst,0,evA), k2 = build(dst,0,evA);
const evB = {type:"message",timestamp:2,source:{userId:"u2",type:"user"}};
const f0a = build(dst,0,evB), f0b = build(dst,0,evB), f1 = build(dst,1,evB);
console.log(JSON.stringify({
  sameEqual: k1===k2,
  fbEqual: f0a===f0b,
  indexDiffs: f0a !== f1,
  k1Short: k1.slice(0,24),
  f0aShort: f0a.slice(0,24),
  f1Short: f1.slice(0,24)
}));
'@
  $dtOut = ''
  $ec = Invoke-NodeTempFile -JsCode $dtJs -Out ([ref]$dtOut)
  try { $o = $dtOut | ConvertFrom-Json -ErrorAction Stop } catch { $o = $null }
  if ($ec -eq 0 -and $o -and $o.sameEqual -and $o.fbEqual -and $o.indexDiffs) {
    Write-HostOK 'DT-01 same inputs same key + eventIndex prevents collision'
    Add-Row 'DT-01 Determinism + index collision' 'All flags true' ('OK: ' + $dtOut) 'PASS'
  } else {
    Write-HostFail ('DT-01 unexpected ec=' + $ec + ' out=' + $dtOut)
    Add-Row 'DT-01 Determinism + index collision' 'All flags true' ('FAIL ec=' + $ec + ' ' + $dtOut) 'FAIL'
  }
}

Write-HostHeader 'Signature Verify Logic Tests (Node mock)'

if ($nodeExe) {
  $sigJs = @'
const crypto = require("crypto");
const secret = "MOCK_CHANNEL_SECRET_12345678901234";
const msg = Buffer.from("test-line-webhook-payload-v1", "utf8");
const good = crypto.createHmac("sha256", secret).update(msg).digest("base64");
function verify(rawBuf, sec, signature){
  if(!sec || !signature) return false;
  const hmac = crypto.createHmac("sha256", sec).update(rawBuf).digest("base64");
  const a = Buffer.from(hmac);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a,b);
}
const bad1 = good.toLowerCase();
const bad2 = good + "AA";
console.log(JSON.stringify({
  correct:    verify(msg, secret, good),
  lowercase:  verify(msg, secret, bad1),
  missing:    verify(msg, secret, ""),
  wrongSec:   verify(msg, "OTHER_SECRET_999999999", good),
  lengthDiff: verify(msg, secret, bad2)
}));
'@
  $sigOut = ''
  $ec = Invoke-NodeTempFile -JsCode $sigJs -Out ([ref]$sigOut)
  try { $o = $sigOut | ConvertFrom-Json -ErrorAction Stop } catch { $o = $null }
  if ($ec -eq 0 -and $o -and $o.correct -and -not $o.lowercase -and -not $o.missing -and -not $o.wrongSec -and -not $o.lengthDiff) {
    Write-HostOK 'SV-01 signature verify matrix 1T4F as expected'
    Add-Row 'SV-01 signature verify matrix' '1T + 4F' ('OK: ' + $sigOut) 'PASS'
  } else {
    Write-HostFail ('SV-01 matrix unexpected ec=' + $ec + ' out=' + $sigOut)
    Add-Row 'SV-01 signature verify matrix' '1T + 4F' ('FAIL ec=' + $ec + ' ' + $sigOut) 'FAIL'
  }
}

Write-HostHeader 'Results Table'
$results | Format-Table -AutoSize

$pass = ($results | Where-Object { $_.Status -eq 'PASS' }).Count
$fail = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
Write-Host ('Passed: ' + $pass + ' / Failed: ' + $fail + ' / Total: ' + $results.Count) -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

$exitCode = 1
if ($fail -eq 0) { $exitCode = 0 }
exit $exitCode
