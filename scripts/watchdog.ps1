# watchdog.ps1 - Mantiene el servidor de Minecraft y el tunel playit en linea 24/7.
# Lo ejecuta la tarea programada "SyntaaxMC-Watchdog" cada 5 minutos. Idempotente: solo actua si algo falla.
# Con la bandeja abierta, ella prende Java y playit; el watchdog revisa el tunel y abre la bandeja si se cerro.
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\comun.ps1"
$state = "$dir\scripts\watchdog.state"   # fallos seguidos del tunel

# Reinicia el contador de inactividad de Windows (la PC se suspende a los 10 min y esto corre cada 5).
Add-Type -Namespace SyntaaxMC -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[void][SyntaaxMC.Power]::SetThreadExecutionState(1)   # ES_SYSTEM_REQUIRED

$java    = Get-Process java
$playit  = Get-Process playit
$bandeja = Test-Bandeja

# 1. El servidor responde dentro de la PC pero no por el tunel dos veces seguidas: falla playit, se cierra.
#    Lo vuelve a prender la bandeja (en segundos) o el paso 2.
if ($java -and $playit -and (Test-Mc '127.0.0.1' 25565)) {
  if (Test-Mc $tunelHost $tunelPort) { $fails = 0 }
  else {
    $fails = [int](Get-Content $state) + 1
    Write-Log "Tunel sin respuesta ($fails seguidas)."
    if ($fails -ge 2) {
      Write-Log 'Reiniciando playit.'
      $playit | Stop-Process -Force
      Start-Sleep -Seconds 3
      $playit = $null
      $fails = 0
    }
  }
  Set-Content -Path $state -Value $fails
}

# 2. Sin bandeja: prende lo que falte (sin ventana) y la abre; ella adopta lo que ya corre.
if (-not $bandeja) {
  if (-not $playit) { Write-Log 'playit estaba cerrado: iniciado.'; Start-Playit }
  if (-not $java -and -not (Test-Path $flag)) { Write-Log 'Servidor cerrado: iniciado.'; Start-Servidor }
  Write-Log 'Bandeja cerrada: abierta.'
  Start-Bandeja
}
