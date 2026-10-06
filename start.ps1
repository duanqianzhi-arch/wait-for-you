$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$appServer = Join-Path $appRoot 'serve.py'
if (Test-Path -LiteralPath $appPython) {
  & $appPython $appServer
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  py -3 $appServer
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  python $appServer
} else {
  Write-Host '找不到 Python。你可以先打开单文件预览，或安装 Python 后再启动本地手机预览。'
  Read-Host '按回车退出'
}
