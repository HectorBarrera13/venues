$projectRoot = Split-Path -Parent $PSScriptRoot
$localMongo = Join-Path $projectRoot '.local/mongodb-win32-x86_64-windows-8.0.32/bin/mongod.exe'
$installedMongo = Get-Command mongod -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $localMongo) {
    $mongoExe = $localMongo
} elseif ($installedMongo) {
    $mongoExe = $installedMongo.Source
} else {
    throw 'mongod was not found. Install MongoDB Community Server or place the portable binary in .local.'
}

$dataPath = Join-Path $projectRoot '.local/mongo-data'
$logPath = Join-Path $projectRoot '.local/mongod.log'
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null

& $mongoExe --dbpath $dataPath --bind_ip 127.0.0.1 --port 27017 --replSet rs0 --logpath $logPath --logappend
