$ErrorActionPreference = 'Stop'

$pluginRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $pluginRoot 'Koha'
$archive = Join-Path $pluginRoot 'LiraReadingLists-1.0.1.kpz'

if (-not (Test-Path -LiteralPath (Join-Path $source 'Plugin/Com/Lira/ReadingLists.pm'))) {
    throw 'Plugin source is incomplete: Koha/Plugin/Com/Lira/ReadingLists.pm was not found.'
}

if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fileStream = [System.IO.File]::Open($archive, [System.IO.FileMode]::CreateNew)
try {
    $zip = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object {
            $relativePath = $_.FullName.Substring($source.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
            $entry = $zip.CreateEntry("Koha/$relativePath", [System.IO.Compression.CompressionLevel]::Optimal)
            $entryStream = $entry.Open()
            try {
                $inputStream = [System.IO.File]::OpenRead($_.FullName)
                try { $inputStream.CopyTo($entryStream) } finally { $inputStream.Dispose() }
            } finally {
                $entryStream.Dispose()
            }
        }
    } finally {
        $zip.Dispose()
    }
} finally {
    $fileStream.Dispose()
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
try {
    $requiredEntry = $zip.Entries | Where-Object { $_.FullName -eq 'Koha/Plugin/Com/Lira/ReadingLists.pm' }
    if (-not $requiredEntry) { throw 'KPZ archive layout is invalid; Koha/ is not at the archive root.' }
} finally {
    $zip.Dispose()
}

Write-Output "Built $archive"
