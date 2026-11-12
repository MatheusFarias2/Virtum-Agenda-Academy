$ErrorActionPreference = 'Stop'
$version = '3.12.10'
$url = "https://www.python.org/ftp/python/$version/python-$version-embed-amd64.zip"
$archive = Join-Path $env:TEMP "virtum-agenda-python-$version-embed.zip"
$target = Join-Path $env:LOCALAPPDATA 'VirtumAgenda\Python312_Portatil'
$exe = Join-Path $target 'python.exe'
$log = Join-Path $env:TEMP 'virtum-agenda-inicializador.log'
function Check-Embedded([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $false }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $path
        $psi.Arguments = '-c "import sys,http.server;sys.exit(0 if sys.version_info >= (3,10) else 1)"'
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardOutput = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        if (-not $p.WaitForExit(10000)) { $p.Kill(); return $false }
        $err = $p.StandardError.ReadToEnd()
        if ($p.ExitCode -ne 0) { Add-Content $log "Portatil invalido: $path - $err" }
        return ($p.ExitCode -eq 0)
    } catch { Add-Content $log "Portatil invalido: $path - $_"; return $false }
}
if (Check-Embedded $exe) {
    Write-Host "Python portatil existente e validado: $exe" -ForegroundColor Green
} else {
    Write-Host "Baixando Python portatil oficial: $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $names = @($zip.Entries | ForEach-Object { $_.FullName })
        if ('python.exe' -notin $names -or 'python312.zip' -notin $names) { throw 'ZIP oficial nao contem os arquivos esperados.' }
    } finally { $zip.Dispose() }
    $parent = Split-Path $target -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $stage = Join-Path $parent ('Python312_tmp_' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    try {
        [IO.Compression.ZipFile]::ExtractToDirectory($archive,$stage)
        $candidate = Join-Path $stage 'python.exe'
        if (-not (Check-Embedded $candidate)) { throw "Python extraido falhou no teste. Consulte $log" }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        Move-Item -LiteralPath $stage -Destination $target
        if (-not (Check-Embedded $exe)) { throw "Python nao funciona no destino $exe" }
        Write-Host "Python portatil instalado e validado: $exe" -ForegroundColor Green
    } finally {
        if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
        Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
    }
}
