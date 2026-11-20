# bandeja.ps1 - Íconos de SyntaaxMC junto al reloj (servidor y túnel) con consola propia.
# Arranca Java y playit sin ventana, los vuelve a prender si se cierran y muestra su estado.
# Lo abre el acceso directo de Inicio al iniciar sesión, y el watchdog si se cerró. Una sola copia a la vez (mutex).
# -Captura <png>: arma la consola con el estado real, la guarda como imagen y sale (para revisarla sin tocar nada).
param([string]$Captura)
. "$PSScriptRoot\comun.ps1"
$mutex = New-Object Threading.Mutex($false, 'Local\SyntaaxMC-Bandeja')
if (-not $Captura -and -not $mutex.WaitOne(0)) { exit }

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

$panel   = 'https://syntaaxmc.isaacyepez.com/admin/'
$negro   = [Drawing.ColorTranslator]::FromHtml('#121417')
$gris    = [Drawing.ColorTranslator]::FromHtml('#d9dce1')
$naranja = [Drawing.ColorTranslator]::FromHtml('#ff5a1f')
$fondo2  = [Drawing.ColorTranslator]::FromHtml('#1b1e22')
$rojo    = [Drawing.ColorTranslator]::FromHtml('#ff6b6b')
$ambar   = [Drawing.ColorTranslator]::FromHtml('#f5c04a')
$ico = @{}
foreach ($n in 'servidor', 'servidor-ok', 'servidor-error', 'tunel', 'tunel-ok', 'tunel-error') { $ico[$n] = New-Object Drawing.Icon("$dir\recursos\iconos\$n.ico") }
$letra = if ((New-Object Drawing.Text.InstalledFontCollection).Families.Name -contains 'Montserrat') { 'Montserrat' } else { 'Segoe UI' }

$script:modo = if (Test-Path $flag) { 'apagado' } else { 'encendido' }   # encendido | reiniciando | apagado
$script:ultimoArranque = [datetime]::MinValue
$script:paradaDesde = $null
$script:javaPid = 0
$script:pos = 0L
$script:tick = 0
$script:chequeo = $null
$script:h = $null

# --- Menú (el mismo en los dos íconos) ---
$menu = New-Object Windows.Forms.ContextMenuStrip
$miConsola = New-Object Windows.Forms.ToolStripMenuItem('Abrir consola')
$miConsola.Font = New-Object Drawing.Font($miConsola.Font, [Drawing.FontStyle]::Bold)
$miPanel = New-Object Windows.Forms.ToolStripMenuItem('Abrir panel')
$miReiniciar = New-Object Windows.Forms.ToolStripMenuItem('Reiniciar')
$miApagar = New-Object Windows.Forms.ToolStripMenuItem('Apagar')
$menu.Items.AddRange([Windows.Forms.ToolStripItem[]]@($miConsola, $miPanel, (New-Object Windows.Forms.ToolStripSeparator), $miReiniciar, $miApagar))

function New-Icono($icono, $texto) {
  $n = New-Object Windows.Forms.NotifyIcon
  $n.Icon = $ico[$icono]; $n.Text = $texto; $n.ContextMenuStrip = $menu
  $n.add_MouseDoubleClick({ Show-Consola })
  $n
}
$niServidor = New-Icono 'servidor' 'SyntaaxMC'
$niTunel = New-Icono 'tunel' 'Túnel playit'

# --- Consola ---
$form = New-Object Windows.Forms.Form
$form.Text = 'SyntaaxMC · Consola'
$form.Icon = $ico['servidor']; $form.BackColor = $negro; $form.ForeColor = $gris
$form.ClientSize = New-Object Drawing.Size(960, 560); $form.MinimumSize = New-Object Drawing.Size(520, 320)
$form.StartPosition = 'CenterScreen'
Add-Type -Namespace SyntaaxMC -Name Dwm -MemberDefinition '[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, int a, ref int v, int s);'
$form.add_HandleCreated({ $v = 1; [void][SyntaaxMC.Dwm]::DwmSetWindowAttribute($form.Handle, 20, [ref]$v, 4) })   # barra de título oscura

$txtLog = New-Object Windows.Forms.RichTextBox
$txtLog.Dock = 'Fill'; $txtLog.ReadOnly = $true; $txtLog.DetectUrls = $false; $txtLog.BorderStyle = 'None'
$txtLog.BackColor = $negro; $txtLog.ForeColor = $gris; $txtLog.Font = New-Object Drawing.Font('Consolas', 10)

$lblEstado = New-Object Windows.Forms.Label
$lblEstado.Dock = 'Top'; $lblEstado.Height = 38; $lblEstado.TextAlign = 'MiddleLeft'
$lblEstado.Padding = New-Object Windows.Forms.Padding(12, 0, 12, 0)
$lblEstado.BackColor = $fondo2; $lblEstado.ForeColor = $gris; $lblEstado.Font = New-Object Drawing.Font($letra, 10, [Drawing.FontStyle]::Bold)
$lblEstado.Text = 'Revisando…'

$abajo = New-Object Windows.Forms.Panel
$abajo.Dock = 'Bottom'; $abajo.Height = 46; $abajo.Padding = New-Object Windows.Forms.Padding(10, 9, 10, 9); $abajo.BackColor = $fondo2
$txtCmd = New-Object Windows.Forms.TextBox
$txtCmd.Dock = 'Fill'; $txtCmd.BorderStyle = 'FixedSingle'; $txtCmd.BackColor = $negro; $txtCmd.ForeColor = $gris
$txtCmd.Font = New-Object Drawing.Font('Consolas', 11)
$btnEnviar = New-Object Windows.Forms.Button
$btnEnviar.Text = 'Enviar'; $btnEnviar.Dock = 'Right'; $btnEnviar.Width = 100; $btnEnviar.FlatStyle = 'Flat'
$btnEnviar.FlatAppearance.BorderSize = 0; $btnEnviar.BackColor = $naranja; $btnEnviar.ForeColor = $negro
$btnEnviar.Font = New-Object Drawing.Font($letra, 10, [Drawing.FontStyle]::Bold)
$abajo.Controls.Add($txtCmd); $abajo.Controls.Add($btnEnviar)

# El control que llena va primero: WinForms acomoda los anclados en orden inverso.
$form.Controls.Add($txtLog); $form.Controls.Add($lblEstado); $form.Controls.Add($abajo)
$form.AcceptButton = $btnEnviar

function Add-Texto([string]$t, $color) {
  if ($txtLog.TextLength -gt 1000000) { $txtLog.Clear() }
  $txtLog.SelectionStart = $txtLog.TextLength; $txtLog.SelectionLength = 0
  $txtLog.SelectionColor = $color; $txtLog.AppendText($t)
}

# Lo nuevo de logs\latest.log desde la última lectura.
function Update-Log {
  $f = "$dir\logs\latest.log"
  if (-not (Test-Path $f)) { return }
  $fs = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite, Delete')
  try {
    if ($fs.Length -lt $script:pos -or $fs.Length - $script:pos -gt 262144) { $txtLog.Clear(); $script:pos = [math]::Max(0, $fs.Length - 65536) }
    if ($fs.Length -eq $script:pos) { return }
    $fs.Position = $script:pos
    $nuevo = (New-Object IO.StreamReader($fs, [Text.Encoding]::UTF8)).ReadToEnd()
    $script:pos = $fs.Position
  } finally { $fs.Dispose() }
  foreach ($l in ($nuevo -split '(?<=\n)')) {
    if ($l) { Add-Texto $l $(if ($l -match '/ERROR\]') { $rojo } elseif ($l -match '/WARN\]') { $ambar } else { $gris }) }
  }
  $txtLog.ScrollToCaret()
}

function Show-Consola {
  Update-Log
  $form.Show(); $form.WindowState = 'Normal'; $form.Activate(); $txtCmd.Focus() | Out-Null
}

function Send-Comando {
  $t = $txtCmd.Text.Trim().TrimStart('/'); $txtCmd.Clear()
  if (-not $t) { return }
  if ($t -eq 'stop') { if ($script:modo -ne 'apagado') { Invoke-Apagar }; return }   # así la bandeja no lo vuelve a prender sola
  Add-Texto "> $t`n" $naranja
  try { $r = Send-Rcon $t; if ($r) { Add-Texto ($r.TrimEnd() + "`n") $naranja } }
  catch { Add-Texto "No se pudo mandar (¿el servidor está prendido?): $($_.Exception.Message)`n" $rojo }
  $txtLog.ScrollToCaret()
}

# --- Acciones del menú ---
function Confirm-Accion($texto) {
  [Windows.Forms.MessageBox]::Show($texto, 'SyntaaxMC', 'YesNo', 'Question', 'Button2', 'DefaultDesktopOnly') -eq 'Yes'
}
function Update-Menu { $miApagar.Text = if ($script:modo -eq 'apagado') { 'Encender' } else { 'Apagar' } }
function Stop-Servidor {   # parada ordenada; si en 90 s no se cerró, Update-Procesos lo cierra a la fuerza
  $script:paradaDesde = Get-Date
  try { Send-Rcon 'stop' | Out-Null } catch {}
}
function Invoke-Reiniciar {
  if (-not (Confirm-Accion '¿Reiniciar el servidor? Los jugadores se desconectan cerca de un minuto.')) { return }
  Write-Log 'Bandeja: reinicio pedido.'
  Remove-Item $flag -ErrorAction SilentlyContinue
  $script:modo = 'reiniciando'; Update-Menu; Stop-Servidor
}
function Invoke-Apagar {
  if ($script:modo -eq 'apagado') {   # con el servidor apagado, el mismo botón dice «Encender»
    Write-Log 'Bandeja: encendido pedido.'
    Remove-Item $flag -ErrorAction SilentlyContinue
    $script:modo = 'encendido'; $script:paradaDesde = $null; $script:ultimoArranque = [datetime]::MinValue; Update-Menu
    return
  }
  if (-not (Confirm-Accion '¿Apagar el servidor? Queda apagado hasta que elijas Encender en este menú.')) { return }
  Write-Log 'Bandeja: apagado pedido.'
  Set-Content -Path $flag -Value (Get-Date)
  $script:modo = 'apagado'; Update-Menu; Stop-Servidor
}

# --- Vigilancia ---
function Update-Procesos {
  # apagado.flag manda: también se puede poner o quitar desde afuera (watchdog, mantenimiento, el panel web).
  $hayFlag = Test-Path $flag
  if ($hayFlag -and $script:modo -ne 'apagado') { $script:modo = 'apagado'; Update-Menu }
  elseif (-not $hayFlag -and $script:modo -eq 'apagado') { $script:modo = 'encendido'; $script:ultimoArranque = [datetime]::MinValue; Update-Menu }
  $j = Get-Process java -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($j -and $j.Id -ne $script:javaPid) { $script:javaPid = $j.Id; $script:pos = 0L; $txtLog.Clear() }   # servidor nuevo = registro nuevo
  if ($j -and $script:paradaDesde -and ((Get-Date) - $script:paradaDesde).TotalSeconds -gt 90) {
    Write-Log 'Bandeja: el servidor no se detuvo en 90 s; cerrado a la fuerza.'
    $j | Stop-Process -Force; $script:paradaDesde = $null
  }
  if (-not $j) {
    $script:paradaDesde = $null
    if ($script:modo -ne 'apagado' -and ((Get-Date) - $script:ultimoArranque).TotalSeconds -gt 90) {
      Write-Log $(if ($script:modo -eq 'reiniciando') { 'Bandeja: servidor reiniciado.' } else { 'Bandeja: servidor cerrado: iniciado.' })
      $script:modo = 'encendido'; $script:ultimoArranque = Get-Date; Update-Menu; Start-Servidor
    }
  }
  if (-not (Get-Process playit -ErrorAction SilentlyContinue)) { Write-Log 'Bandeja: playit cerrado: iniciado.'; Start-Playit }
}

# Los pings van en otro hilo: el del túnel sale a internet y puede tardar hasta 10 s.
function Start-Chequeo {
  if (-not $script:chequeo) {
    $script:chequeo = [powershell]::Create()
    [void]$script:chequeo.AddScript(". '$PSScriptRoot\comun.ps1'; " + '@{ Local = (Get-McStatus ''127.0.0.1'' 25565); Tunel = (Test-Mc $tunelHost $tunelPort) }')
  }
  $script:h = $script:chequeo.BeginInvoke()
}

function Show-Estado($local, [bool]$tunelOk) {
  $java = [bool](Get-Process java -ErrorAction SilentlyContinue)
  if ($script:modo -eq 'apagado') { $s = 'servidor-error'; $ts = 'Servidor: apagado' }
  elseif ($local) {
    $n = if ($local -match '"online"\s*:\s*(\d+)') { $Matches[1] } else { '?' }
    $s = 'servidor-ok'; $ts = "Servidor: en línea · $n " + $(if ($n -eq '1') { 'jugador' } else { 'jugadores' })
  }
  elseif ($script:modo -eq 'reiniciando') { $s = 'servidor'; $ts = 'Servidor: reiniciando…' }
  elseif ($java) { $s = 'servidor'; $ts = 'Servidor: arrancando…' }
  else { $s = 'servidor-error'; $ts = 'Servidor: caído' }

  if (-not $local) { $t = 'tunel'; $tt = 'Túnel: esperando al servidor' }
  elseif ($tunelOk) { $t = 'tunel-ok'; $tt = 'Túnel playit: en línea' }
  else { $t = 'tunel-error'; $tt = 'Túnel playit: sin respuesta' }

  $niServidor.Icon = $ico[$s]; $niServidor.Text = "SyntaaxMC · $ts"
  $niTunel.Icon = $ico[$t]; $niTunel.Text = $tt
  $form.Icon = $ico[$s]; $lblEstado.Text = "$ts       $tt"
}

if ($Captura) {
  Show-Estado (Get-McStatus '127.0.0.1' 25565) (Test-Mc $tunelHost $tunelPort)
  $form.Show(); Update-Log; [Windows.Forms.Application]::DoEvents()
  $bmp = New-Object Drawing.Bitmap($form.Width, $form.Height)
  $form.DrawToBitmap($bmp, (New-Object Drawing.Rectangle(0, 0, $form.Width, $form.Height)))
  $bmp.Save($Captura); "Líneas en la consola: $($txtLog.Lines.Count)"; $form.Close(); exit
}

$form.add_Resize({ if ($form.WindowState -eq 'Minimized') { $form.Hide() } })
$form.add_FormClosing({ param($s, $e) if ($e.CloseReason -eq 'UserClosing') { $e.Cancel = $true; $form.Hide() } })
$btnEnviar.add_Click({ Send-Comando })
$miConsola.add_Click({ Show-Consola })
$miPanel.add_Click({ Start-Process $panel })
$miReiniciar.add_Click({ Invoke-Reiniciar })
$miApagar.add_Click({ Invoke-Apagar })

$tEstado = New-Object Windows.Forms.Timer; $tEstado.Interval = 5000
$tEstado.add_Tick({
  try {
    $script:tick++
    Update-Procesos
    if ($script:h -and $script:h.IsCompleted) { $r = $script:chequeo.EndInvoke($script:h)[0]; $script:h = $null; Show-Estado $r.Local $r.Tunel }
    if (-not $script:h -and $script:tick % 4 -eq 0) { Start-Chequeo }   # cada 20 s
  } catch { Write-Log "Bandeja: error $($_.Exception.Message)" }
})
$tLog = New-Object Windows.Forms.Timer; $tLog.Interval = 1000
$tLog.add_Tick({ if ($form.Visible -and $form.WindowState -ne 'Minimized') { try { Update-Log } catch {} } })

Write-Log 'Bandeja: abierta.'
$niServidor.Visible = $true; $niTunel.Visible = $true
Update-Menu; Update-Procesos; Start-Chequeo
$tEstado.Start(); $tLog.Start()
[Windows.Forms.Application]::Run()
