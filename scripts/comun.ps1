# comun.ps1 - Lo que comparten watchdog.ps1 y bandeja.ps1: rutas, arranque sin ventana, ping de Minecraft y RCON.
$dir       = 'C:\Minecraft\server'
$logFile   = "$dir\logs\watchdog.log"
$flag      = "$dir\scripts\apagado.flag"      # existe = se apago desde la bandeja: nadie lo prende solo
$tunelHost = 'molecule-darkness.tun.ply.gg'   # el mismo tunel del SRV de syntaaxmc.isaacyepez.com
$tunelPort = 44997

function Write-Log($m) { Add-Content -Path $logFile -Value ('[{0:yyyy-MM-dd HH:mm:ss}] {1}' -f (Get-Date), $m) }

function Start-Servidor {
  Start-Process -FilePath "$dir\runtime\jdk-25.0.5+8\bin\java.exe" -WindowStyle Hidden -WorkingDirectory $dir `
    -ArgumentList '-Xms2G','-Xmx6G','-jar',"$dir\paper-26.2-135.jar",'--nogui'
}
function Start-Playit { Start-Process -FilePath "$dir\playit\playit.exe" -WorkingDirectory "$dir\playit" -WindowStyle Hidden }

# La bandeja tiene un mutex propio mientras corre.
function Test-Bandeja {   # suelta el handle: si no, este proceso mantendria vivo el mutex aunque la bandeja se cierre
  $m = $null
  if ([Threading.Mutex]::TryOpenExisting('Local\SyntaaxMC-Bandeja', [ref]$m)) { $m.Dispose(); $true } else { $false }
}
function Start-Bandeja {
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',"`"$dir\scripts\bandeja.ps1`""
}

# Status ping de Minecraft: devuelve el JSON de estado, o $null si nadie responde en host:port.
function Get-McStatus([string]$h, [int]$port) {
  $c = New-Object Net.Sockets.TcpClient
  try {
    if (-not $c.ConnectAsync($h, $port).Wait(5000)) { return $null }
    $s = $c.GetStream(); $s.ReadTimeout = 5000
    $hb = [Text.Encoding]::UTF8.GetBytes($h)
    # handshake (id 0, protocolo 776 = 0x88 0x06, host, puerto, estado 1) + status request; longitudes < 128 caben en 1 byte
    $body = [byte[]](@(0, 0x88, 6, $hb.Length) + $hb + @([byte]($port -shr 8), [byte]($port -band 255), 1))
    $pkt = [byte[]](@($body.Length) + $body + @(1, 0))
    $s.Write($pkt, 0, $pkt.Length)
    $buf = New-Object byte[] 4096
    $n = $s.Read($buf, 0, $buf.Length)
    $t = [Text.Encoding]::UTF8.GetString($buf, 0, $n)
    if ($n -gt 0 -and $t.Contains('{')) { $t } else { $null }
  } catch { $null } finally { $c.Close() }
}
function Test-Mc([string]$h, [int]$port) { [bool](Get-McStatus $h $port) }

# Manda un comando por RCON y devuelve la respuesta. La clave se lee de server.properties en cada llamada.
function Send-Rcon([string]$cmd) {
  $p = @{}
  Get-Content "$dir\server.properties" | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { $p[$Matches[1].Trim()] = $Matches[2].Trim() } }
  $c = New-Object Net.Sockets.TcpClient('127.0.0.1', [int]$p['rcon.port'])
  try {
    $s = $c.GetStream(); $s.ReadTimeout = 5000; $br = New-Object IO.BinaryReader($s)
    function Send-Paquete([int]$type, [string]$body) {
      $b = [Text.Encoding]::UTF8.GetBytes($body)
      $ms = New-Object IO.MemoryStream; $w = New-Object IO.BinaryWriter($ms)
      $w.Write([int](10 + $b.Length)); $w.Write([int]7); $w.Write($type); $w.Write($b); $w.Write([byte[]](0, 0))
      $a = $ms.ToArray(); $s.Write($a, 0, $a.Length)
      $len = $br.ReadInt32(); $id = $br.ReadInt32(); $null = $br.ReadInt32()
      $txt = [Text.Encoding]::UTF8.GetString($br.ReadBytes($len - 10)); $null = $br.ReadBytes(2)
      if ($id -eq -1) { throw 'RCON rechazo la clave de server.properties' }
      $txt
    }
    $null = Send-Paquete 3 $p['rcon.password']
    (Send-Paquete 2 $cmd) -replace ([string][char]0xA7 + '.'), ''   # quita los codigos de color de Minecraft
  } finally { $c.Close() }
}
