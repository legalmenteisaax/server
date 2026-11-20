# prueba-bandeja.ps1 - Revisa sin abrir ventanas lo que usan la bandeja y el watchdog.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File C:\Minecraft\server\scripts\prueba-bandeja.ps1
. "$PSScriptRoot\comun.ps1"
$script:mal = 0
function Assert-Prueba($nombre, $cond) { if ($cond) { "OK   $nombre" } else { $script:mal++; "MAL  $nombre" } }

Assert-Prueba 'ping local responde con jugadores' ((Get-McStatus '127.0.0.1' 25565) -match '"online"')
Assert-Prueba 'ping a puerto cerrado da $null' ($null -eq (Get-McStatus '127.0.0.1' 1))
Assert-Prueba 'ping a host inexistente da $null' ($null -eq (Get-McStatus 'no-existe.invalid' 25565))
Assert-Prueba 'túnel responde' (Test-Mc $tunelHost $tunelPort)
Assert-Prueba 'RCON contesta list' ((Send-Rcon 'list') -match '\d+ jugadores|\d+ .*players')
foreach ($n in 'servidor', 'servidor-ok', 'servidor-error', 'tunel', 'tunel-ok', 'tunel-error') {
  Assert-Prueba "ícono $n" (Test-Path "$dir\recursos\iconos\$n.ico")
}
foreach ($s in 'bandeja.ps1', 'watchdog.ps1', 'comun.ps1') {
  $err = $null; [void][Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot\$s", [ref]$null, [ref]$err)
  Assert-Prueba "$s sin errores de sintaxis" ($err.Count -eq 0)
}
"$script:mal fallas"; exit $script:mal
