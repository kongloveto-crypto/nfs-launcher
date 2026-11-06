#!/usr/bin/env python3
"""Coloca o NFS Launcher (tela inicial, bolha e guia) dentro do código do Chromium, em chrome/android/nfs/.

Uso (no Linux do WSL, depois dos patches):  python3 setup.py
- Java de android-motor/app/java; telas de android-motor/app/assets (home.*);
- dicas, sons, ícone, CDs e fundos do app de PC (src/renderer: tips.js, sounds.js, icon.png, games/, bg/);
- guias e catálogo de jogos em JSON (scripts/export-guides.js, com o Node que vem no Chromium).
Tudo vai para assets/nfs/ no APK. O BUILD.gn é gerado com a lista exata dos arquivos.
"""
import pathlib
import shutil
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
PROJ = HERE.parent.parent
SRC = pathlib.Path.home() / 'chromium' / 'src'
DEST = SRC / 'chrome' / 'android' / 'nfs'
NODE = SRC / 'third_party' / 'node' / 'linux' / 'node-linux-x64' / 'bin' / 'node'

if DEST.exists():
    shutil.rmtree(DEST)
java_dir = DEST / 'java' / 'src' / 'xyz' / 'nfs' / 'launcher'
assets = DEST / 'assets'
java_dir.mkdir(parents=True)
assets.mkdir(parents=True)

for f in sorted((HERE / 'java' / 'xyz' / 'nfs' / 'launcher').glob('*.java')):
    shutil.copy(f, java_dir / f.name)
for f in sorted((HERE / 'assets').glob('home.*')):
    shutil.copy(f, assets / f.name)
renderer = PROJ / 'src' / 'renderer'
for name in ('tips.js', 'sounds.js', 'icon.png'):
    shutil.copy(renderer / name, assets / name)
shutil.copytree(renderer / 'games', assets / 'games')
shutil.copytree(renderer / 'bg', assets / 'bg')
shutil.copytree(HERE / 'res', DEST / 'res')  # res/xml/nfs_game_mode_config.xml (modo de jogo do Android)
subprocess.run([str(NODE), str(PROJ / 'scripts' / 'export-guides.js'),
                str(assets / 'guides.json'), str(assets / 'catalog.json')], check=True)

# Texturas HD do NFSU2 (1.6.4): só o NextGen, com até 2x o lado das originais (pedido do Bruno, 06/11; build.js com
# ESCALA_MAX=2), montado no Windows (C:\e\texturas\celular).
# Nome .ntxp de propósito: com ".pak" no nome, a montagem o trata como pacote do Chromium e pede um .pak.info.
# Fica fora de assets/ comum: vai SEM compressão, para o motor ler só os trechos que o jogo pede (patch 0007).
TEX = pathlib.Path('/mnt/c/e/texturas/celular/detailed.pak')
tex_dir = DEST / 'texturas'
if TEX.exists():
    tex_dir.mkdir()
    shutil.copy(TEX, tex_dir / 'texturas.ntxp')

java = sorted(p.relative_to(DEST).as_posix() for p in java_dir.glob('*.java'))
files = sorted(p.relative_to(DEST).as_posix() for p in assets.rglob('*') if p.is_file())
res = sorted(p.relative_to(DEST).as_posix() for p in (DEST / 'res').rglob('*') if p.is_file())
q = lambda xs: '\n'.join(f'    "{x}",' for x in xs)

(DEST / 'proguard.flags').write_text(
    '# NFS Launcher: classes pequenas, chamadas pelo manifesto e pela página local (JavascriptInterface).\n'
    '-keep class xyz.nfs.launcher.** { *; }\n')
(DEST / 'BUILD.gn').write_text(f'''# Gerado por android-motor/app/setup.py (NFS Launcher dentro do motor). Não editar aqui.
import("//build/config/android/rules.gni")

android_library("java") {{
  sources = [
{q(java)}
  ]
  deps = [
    ":resources",
    "//third_party/androidx:androidx_annotation_annotation_java",
    "//third_party/androidx:androidx_browser_browser_java",
  ]
  proguard_configs = [ "proguard.flags" ]
}}

android_resources("resources") {{
  sources = [
{q(res)}
  ]
}}

android_assets("assets") {{
  renaming_sources = [
{q(files)}
  ]
  renaming_destinations = [
{q('nfs/' + f[len('assets/'):] for f in files)}
  ]
{'  deps = [ ":texturas_assets" ]' if (tex_dir / 'texturas.ntxp').exists() else ''}
}}
''' + ('''
android_assets("texturas_assets") {
  renaming_sources = [ "texturas/texturas.ntxp" ]
  renaming_destinations = [ "nfs/texturas.ntxp" ]
  disable_compression = true
}
''' if (tex_dir / 'texturas.ntxp').exists() else ''))
print(f'NFS Launcher colocado em {DEST}: {len(java)} arquivos Java, {len(files)} arquivos de tela')
