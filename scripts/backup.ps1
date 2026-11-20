# backup.ps1 - Backup local y consistente del mundo de Minecraft (SyntaaxMC)
# Congela el guardado via RCON (si esta activo), comprime los 3 mundos y conserva los ultimos $Keep.
param(
  [string]$ServerDir = 'C:\Minecraft\server',
  [string]$BackupDir = 'C:\MinecraftBackups',
  [int]$Keep = 7
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
[System.IO.Directory]::CreateDirectory($BackupDir) | Out-Null
$log = Join-Path $BackupDir 'backup.log'
function Log($m){ $line = "$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))  $m"; Add-Content -Path $log -Value $line; Write-Output $line }

# --- Leer datos de RCON desde server.properties ---
$props = @{}
Get-Content (Join-Path $ServerDir 'server.properties') | ForEach-Object {
  if($_ -match '^\s*([^#=]+)=(.*)$'){ $props[$matches[1].Trim()] = $matches[2].Trim() }
}
$rconOn = ($props['enable-rcon'] -eq 'true') -and $props['rcon.password']
$rconPort = [int]($props['rcon.port']); if(-not $rconPort){ $rconPort = 25575 }
$rconPw = $props['rcon.password']

function Invoke-Rcon($cmd){
  $c = New-Object System.Net.Sockets.TcpClient
  $c.Connect('127.0.0.1',$rconPort); $c.ReceiveTimeout = 3000
  $s = $c.GetStream()
  function WritePkt($id,$type,$body){
    $b=[Text.Encoding]::ASCII.GetBytes($body)
    $ms=New-Object IO.MemoryStream; $bw=New-Object IO.BinaryWriter($ms)
    $bw.Write([int](4+4+$b.Length+2)); $bw.Write([int]$id); $bw.Write([int]$type); $bw.Write($b); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Flush()
    $a=$ms.ToArray(); $s.Write($a,0,$a.Length)
  }
  $buf=New-Object byte[] 4096
  WritePkt 1 3 $rconPw; Start-Sleep -Milliseconds 150; try{$s.Read($buf,0,4096)|Out-Null}catch{}
  WritePkt 2 2 $cmd;    Start-Sleep -Milliseconds 150; try{$s.Read($buf,0,4096)|Out-Null}catch{}
  $c.Close()
}

# --- Congelar guardado (si RCON esta disponible) ---
$flushed = $false
if($rconOn){
  try { Invoke-Rcon 'save-off'; Invoke-Rcon 'save-all flush'; Start-Sleep -Seconds 3; $flushed = $true; Log 'Guardado congelado via RCON (save-off + save-all).' }
  catch { Log "RCON no respondio, backup sin congelar: $($_.Exception.Message)" }
} else { Log 'RCON apagado (reinicia el servidor para backups 100% seguros). Backup sin congelar.' }

# --- Comprimir los 3 mundos (tolera archivos abiertos, salta session.lock) ---
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$zipPath = Join-Path $BackupDir "world-$stamp.zip"
$worlds = 'world','world_nether','world_the_end'
$skipped = 0
$zip = $null
try {
  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  foreach($w in $worlds){
    $root = Join-Path $ServerDir $w
    if(-not (Test-Path $root)){ continue }
    Get-ChildItem $root -Recurse -File | ForEach-Object {
      if($_.Name -eq 'session.lock'){ return }
      $rel = $_.FullName.Substring($ServerDir.Length+1).Replace('\','/')
      try{
        $fs=[IO.File]::Open($_.FullName,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
        $e=$zip.CreateEntry($rel); $es=$e.Open(); $fs.CopyTo($es); $es.Dispose(); $fs.Dispose()
      } catch { $skipped++; Log "Saltado (bloqueado): $rel" }
    }
  }
} finally {
  if($null -ne $zip){ $zip.Dispose() }
  if($flushed){ try{ Invoke-Rcon 'save-on' }catch{} }
}
$mb = [math]::Round((Get-Item $zipPath).Length/1MB,1)
Log "Backup creado: $zipPath ($mb MB, archivos saltados: $skipped)"

# --- Validar el backup (zip integro + overworld presente: level.dat sano + regiones) ---
$valid = $false
try {
  $za = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  $hasRegion = ($za.Entries | Where-Object { $_.FullName -like 'world/*' -and $_.FullName -like '*region/*.mca' } | Select-Object -First 1)
  $levelOk = $false
  $entry = $za.GetEntry('world/level.dat')
  if($entry -and $entry.Length -gt 100){
    $es = $entry.Open(); $raw = New-Object IO.MemoryStream; $es.CopyTo($raw); $es.Dispose()
    try {
      $gz = New-Object IO.Compression.GZipStream((New-Object IO.MemoryStream(,$raw.ToArray())), [IO.Compression.CompressionMode]::Decompress)
      $dec = New-Object IO.MemoryStream; $gz.CopyTo($dec); $gz.Dispose()
      $txt = [Text.Encoding]::ASCII.GetString($dec.ToArray())
      if($dec.Length -gt 200 -and $txt.Contains('LevelName')){ $levelOk = $true }
    } catch {}
  }
  $za.Dispose()
  $valid = ($null -ne $hasRegion) -and $levelOk
} catch { Log "Error al validar el zip: $($_.Exception.Message)" }

if($valid){
  Log 'Validacion OK: zip integro, level.dat sano y regiones del mundo presentes.'
  # Rotacion: conservar solo los ultimos $Keep backups BUENOS
  Get-ChildItem $BackupDir -Filter 'world-*.zip' | Where-Object { $_.Name -notlike '*-BAD.zip' } | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | ForEach-Object {
    Remove-Item $_.FullName -Force; Log "Rotado (borrado el mas viejo bueno): $($_.Name)"
  }
} else {
  $bad = $zipPath -replace '\.zip$','-BAD.zip'
  Rename-Item $zipPath $bad
  Log "ADVERTENCIA: backup con posible problema, marcado como $bad. NO se borro ningun backup bueno."
}
Log 'Backup terminado.'
