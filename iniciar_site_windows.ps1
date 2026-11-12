$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$localPython = Join-Path $env:LOCALAPPDATA 'VirtumAgenda\Python312_Portatil\python.exe'
$academyPython = Join-Path $env:LOCALAPPDATA 'VirtumAcademy\Python312\python.exe'
$log = Join-Path $env:TEMP 'virtum-agenda-inicializador.log'
function Test-Python([string]$path) {
    if (-not $path -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $path
        $psi.Arguments = '-c "import sys,http.server;sys.exit(0 if sys.version_info >= (3,10) else 1)"'
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardOutput = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        if (-not $p.WaitForExit(10000)) { try { $p.Kill() } catch {}; return $false }
        $stderr = $p.StandardError.ReadToEnd()
        if ($p.ExitCode -ne 0) { Add-Content $log "Python rejeitado: $path - codigo $($p.ExitCode) - $stderr" }
        return ($p.ExitCode -eq 0)
    } catch { Add-Content $log "Python falhou: $path - $_"; return $false }
}
function Find-Python {
    $paths = New-Object System.Collections.Generic.List[string]
    $paths.Add($localPython); $paths.Add($academyPython)
    foreach ($root in @((Join-Path $env:LOCALAPPDATA 'Programs\Python'),(Join-Path $env:LOCALAPPDATA 'Python'))) {
        if (Test-Path $root) { Get-ChildItem $root -Filter python.exe -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $paths.Add($_.FullName) } }
    }
    foreach ($cmd in @(Get-Command python.exe,python3.exe -All -ErrorAction SilentlyContinue)) { if ($cmd.Source) { $paths.Add($cmd.Source) } }
    foreach ($p in ($paths | Select-Object -Unique)) { if (Test-Python $p) { return $p } }
    return $null
}
try {
    Write-Host '=========================================='
    Write-Host '      VIRTUM AGENDA - INICIALIZADOR'
    Write-Host '=========================================='
    Write-Host 'Verificando Python 3.10 ou superior...'
    "Inicio: $(Get-Date -Format o)" | Set-Content $log
    $python = Find-Python
    if (-not $python) {
        Write-Host 'Python compativel nao encontrado.'
        do { $answer = (Read-Host 'Deseja baixar o Python 3.12.10 portatil? [S/N]').Trim().ToUpperInvariant() } until ($answer -in @('S','N'))
        if ($answer -eq 'N') { Write-Host 'Operacao cancelada.'; exit 0 }
        & (Join-Path $PSScriptRoot 'instalar_python_windows.ps1')
        if (-not (Test-Python $localPython)) { throw "Python portatil nao passou na verificacao. Consulte $log" }
        $python = $localPython
    }
    Write-Host "Python funcional: $python" -ForegroundColor Green
    $configDir = Join-Path $env:LOCALAPPDATA 'VirtumAgenda'
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    $configFile = Join-Path $configDir 'banco_agenda.txt'
    $db = $null
    if (Test-Path -LiteralPath $configFile) {
        $saved = (Get-Content -LiteralPath $configFile -Raw -Encoding UTF8).Trim().Trim('"')
        if (Test-Path -LiteralPath $saved -PathType Leaf) { $db = $saved }
    }
    if (-not $db -and $env:VIRTUM_AGENDA_DB -and (Test-Path -LiteralPath $env:VIRTUM_AGENDA_DB -PathType Leaf)) { $db = $env:VIRTUM_AGENDA_DB }
    if (-not $db) {
        $candidates = @(
            (Join-Path $env:LOCALAPPDATA 'VirtumAcademy\virtum_academy.db'),
            (Join-Path $env:APPDATA 'VirtumAcademy\virtum_academy.db'),
            (Join-Path $PSScriptRoot 'virtum_academy.db')
        )
        foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate -PathType Leaf) { $db = $candidate; break } }
    }
    while (-not $db) {
        Write-Host ''
        Write-Host 'Informe o caminho COMPLETO do banco virtum_academy.db.' -ForegroundColor Yellow
        Write-Host 'Pode ser um caminho de rede (\\servidor\pasta\virtum_academy.db).'
        $entered = (Read-Host 'Caminho do banco [ENTER para cancelar]').Trim().Trim('"')
        if (-not $entered) { Write-Host 'Operacao cancelada.'; exit 0 }
        if (Test-Path -LiteralPath $entered -PathType Leaf) { $db = $entered }
        else { Write-Host 'Arquivo nao encontrado. Verifique o caminho e tente novamente.' -ForegroundColor Yellow }
    }
    $db = (Resolve-Path -LiteralPath $db).ProviderPath
    Write-Host "Banco selecionado: $db"
    # Nao salva o caminho ate validar esquema e leitura reais.
    & $python -c "import sys; sys.path.insert(0,sys.argv[2]); from exportar_agenda import carregar_agenda; d=carregar_agenda(sys.argv[1]); print('Banco validado:',len(d['eventos']),'atividades e',len(d['cursos']),'cursos')" $db $PSScriptRoot
    if ($LASTEXITCODE -ne 0) { throw 'O banco informado nao passou na validacao. Corrija o caminho e tente novamente.' }
    [System.IO.File]::WriteAllText($configFile, $db, (New-Object System.Text.UTF8Encoding($false)))
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $python
    $psi.Arguments = 'servidor_agenda.py --banco "' + $db.Replace('"','') + '" --porta 8080 --intervalo 30'
    $psi.WorkingDirectory = $PSScriptRoot
    $psi.UseShellExecute = $true
    $server = [System.Diagnostics.Process]::Start($psi)
    Start-Sleep -Seconds 2
    if ($server.HasExited) { throw "Servidor encerrou com codigo $($server.ExitCode). Porta 8080 pode estar ocupada." }
    Start-Process 'http://127.0.0.1:8080/'
    Write-Host 'Site iniciado. Feche a janela do servidor para encerrar.'
    exit 0
} catch {
    Add-Content $log "ERRO: $_"
    Write-Host "ERRO: $_" -ForegroundColor Red
    Write-Host "Diagnostico: $log"
    exit 1
}
