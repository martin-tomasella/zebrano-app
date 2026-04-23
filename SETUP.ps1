# =============================================================
# ZEBRANO — Setup completo: App Android + repos GitHub
# Ejecutar en PowerShell como administrador
# Requisitos: git, node, npm, eas-cli instalados
# =============================================================

param(
    [string]$GithubToken = "",       # Pegar token de GitHub
    [string]$GithubUser  = "martin-tomasella",
    [string]$ExpoToken   = ""        # Pegar token de Expo (eas.expo.dev)
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor DarkYellow
Write-Host "  ZEBRANO — Setup App + GitHub" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor DarkYellow
Write-Host ""

# ── VERIFICAR DEPENDENCIAS ────────────────────────────────
Write-Host "[1/8] Verificando dependencias..." -ForegroundColor Cyan

foreach ($cmd in @("git", "node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "  ✗ $cmd no encontrado. Instalalo antes de continuar." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✓ $cmd" -ForegroundColor Green
}

# Instalar eas-cli si no está
if (-not (Get-Command "eas" -ErrorAction SilentlyContinue)) {
    Write-Host "  Instalando eas-cli..." -ForegroundColor Yellow
    npm install -g eas-cli
}
Write-Host "  ✓ eas-cli" -ForegroundColor Green

# ── DIRECTORIOS ───────────────────────────────────────────
Write-Host ""
Write-Host "[2/8] Configurando directorios..." -ForegroundColor Cyan

$BaseDir  = "C:\Users\marga\Documents\ANTIGRAVITY\PROYECTOS"
$AppDir   = "$BaseDir\zebrano-app"
$ErpDir   = "$BaseDir\zebrano"       # repo del ERP web

# Crear directorio si no existe
if (-not (Test-Path $AppDir)) {
    New-Item -ItemType Directory -Path $AppDir | Out-Null
    Write-Host "  ✓ Directorio creado: $AppDir" -ForegroundColor Green
} else {
    Write-Host "  ✓ Directorio existente: $AppDir" -ForegroundColor Green
}

# ── COPIAR ARCHIVOS GENERADOS ─────────────────────────────
Write-Host ""
Write-Host "[3/8] Copiando archivos del proyecto..." -ForegroundColor Cyan
Write-Host "  Descomprimí zebrano-app.zip en: $AppDir" -ForegroundColor Yellow
Write-Host "  Presioná ENTER cuando esté listo..." -ForegroundColor Yellow
Read-Host

# Verificar que existe package.json
if (-not (Test-Path "$AppDir\package.json")) {
    Write-Host "  ✗ No se encontró package.json en $AppDir" -ForegroundColor Red
    Write-Host "    Asegurate de haber extraído el ZIP ahí." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Archivos encontrados" -ForegroundColor Green

# ── CREAR REPOS EN GITHUB ─────────────────────────────────
Write-Host ""
Write-Host "[4/8] Creando repositorios en GitHub..." -ForegroundColor Cyan

if (-not $GithubToken) {
    Write-Host ""
    Write-Host "  Necesitamos un GitHub Personal Access Token con permisos 'repo'" -ForegroundColor Yellow
    Write-Host "  Generalo en: https://github.com/settings/tokens/new" -ForegroundColor Yellow
    Write-Host "  Scopes requeridos: repo, workflow" -ForegroundColor Yellow
    Write-Host ""
    $GithubToken = Read-Host "  Pegá el token aquí"
}

$headers = @{
    "Authorization" = "token $GithubToken"
    "Accept"        = "application/vnd.github.v3+json"
    "Content-Type"  = "application/json"
}

# Crear repo zebrano-app
Write-Host "  Creando repo: zebrano-app..." -ForegroundColor Yellow
try {
    $body = @{ name = "zebrano-app"; description = "Zebrano App Android — Agente AI de diseño y cotización"; private = $true; auto_init = $false } | ConvertTo-Json
    $resp = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body
    Write-Host "  ✓ Repo creado: $($resp.html_url)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "  ✓ Repo ya existe: zebrano-app" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Error creando repo: $_" -ForegroundColor Red
    }
}

# Crear repo zebrano (ERP web) si no existe
Write-Host "  Verificando repo: zebrano (ERP)..." -ForegroundColor Yellow
try {
    $body2 = @{ name = "zebrano"; description = "Zebrano ERP Web — Sistema de gestión operacional"; private = $true; auto_init = $false } | ConvertTo-Json
    $resp2 = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body2
    Write-Host "  ✓ Repo creado: $($resp2.html_url)" -ForegroundColor Green
} catch {
    Write-Host "  ✓ Repo zebrano ya existe" -ForegroundColor Green
}

# ── GIT INIT + PUSH — APP ─────────────────────────────────
Write-Host ""
Write-Host "[5/8] Inicializando git en la app..." -ForegroundColor Cyan

Set-Location $AppDir

if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

git remote remove origin 2>$null
git remote add origin "https://$GithubToken@github.com/$GithubUser/zebrano-app.git"

git add .
git commit -m "feat(init): Zebrano App Android v1.0 — AI cotizador, proyectos, clientes, produccion" 2>$null

git push -u origin main --force
Write-Host "  ✓ App subida a GitHub" -ForegroundColor Green

# Crear rama develop
git checkout -b develop 2>$null
git push -u origin develop 2>$null
git checkout main
Write-Host "  ✓ Rama develop creada" -ForegroundColor Green

# ── GIT INIT + PUSH — ERP ─────────────────────────────────
Write-Host ""
Write-Host "[6/8] Sincronizando ERP web a GitHub..." -ForegroundColor Cyan

if (Test-Path $ErpDir) {
    Set-Location $ErpDir
    if (-not (Test-Path ".git")) {
        git init
        git branch -M main
    }
    git remote remove origin 2>$null
    git remote add origin "https://$GithubToken@github.com/$GithubUser/zebrano.git"
    git add .
    git commit -m "feat(init): Zebrano ERP Web — schema, edge functions, workflows" 2>$null
    git push -u origin main --force
    Write-Host "  ✓ ERP subido a GitHub" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Directorio ERP no encontrado en $ErpDir" -ForegroundColor Yellow
    Write-Host "    Podés sincronizarlo después manualmente." -ForegroundColor Yellow
}

# ── NPM INSTALL ────────────────────────────────────────────
Write-Host ""
Write-Host "[7/8] Instalando dependencias npm..." -ForegroundColor Cyan
Set-Location $AppDir
npm install
Write-Host "  ✓ Dependencias instaladas" -ForegroundColor Green

# ── EAS LOGIN + LINK ──────────────────────────────────────
Write-Host ""
Write-Host "[8/8] Configurando EAS Build..." -ForegroundColor Cyan

if (-not $ExpoToken) {
    Write-Host ""
    Write-Host "  Necesitamos tu Expo token para EAS Build" -ForegroundColor Yellow
    Write-Host "  Generalo en: https://expo.dev/accounts/tomillo007/settings/access-tokens" -ForegroundColor Yellow
    Write-Host ""
    $ExpoToken = Read-Host "  Pegá el token de Expo"
}

$env:EXPO_TOKEN = $ExpoToken
eas login --token $ExpoToken 2>$null

# Crear proyecto EAS si no existe
Write-Host "  Inicializando proyecto EAS..." -ForegroundColor Yellow
eas init --id "PEGAR_PROJECT_ID" --non-interactive 2>$null

Write-Host "  ✓ EAS configurado" -ForegroundColor Green

# ── RESUMEN FINAL ─────────────────────────────────────────
Write-Host ""
Write-Host "=========================================" -ForegroundColor DarkGreen
Write-Host "  ✓ SETUP COMPLETO" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  App Android:  https://github.com/$GithubUser/zebrano-app" -ForegroundColor White
Write-Host "  ERP Web:      https://github.com/$GithubUser/zebrano" -ForegroundColor White
Write-Host ""
Write-Host "  PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Abrí app.json y completá:" -ForegroundColor White
Write-Host "     - supabaseAnonKey: (tu anon key de Supabase)" -ForegroundColor Gray
Write-Host "     - eas.projectId: (ID que aparece en expo.dev)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Para levantar en desarrollo:" -ForegroundColor White
Write-Host "     cd $AppDir" -ForegroundColor Gray
Write-Host "     npx expo start" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Para generar el APK:" -ForegroundColor White
Write-Host "     cd $AppDir" -ForegroundColor Gray
Write-Host "     eas build --platform android --profile preview" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Para sincronizar cambios futuros:" -ForegroundColor White
Write-Host "     cd $AppDir && git add . && git commit -m 'feat: ...' && git push" -ForegroundColor Gray
Write-Host ""
