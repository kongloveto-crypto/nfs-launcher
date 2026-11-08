"""Desfaz um `git am` que parou no meio e confere se as modificacoes do Electron estao aplicadas.

O codigo e baixado sem historico: em cada pasta, o numero de commits e o de modificacoes mais 1.
O apply_all_patches.py nao aceita rodar por cima de si mesmo, por isso o baixar.cmd so o roda uma vez.
"""
import json
import os
import subprocess
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else r"C:\e"


def git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, encoding="utf-8", errors="replace")


with open(os.path.join(ROOT, "src", "electron", "patches", "config.json"), encoding="utf-8") as f:
    config = json.load(f)

faltando = 0
for item in config:
    repo = os.path.join(ROOT, item["repo"])
    lista = os.path.join(ROOT, item["patch_dir"], ".patches")
    if not os.path.isdir(repo) or not os.path.isfile(lista):
        continue
    gitdir = git(repo, "rev-parse", "--absolute-git-dir").stdout.strip()
    if gitdir and os.path.isdir(os.path.join(gitdir, "rebase-apply")):
        git(repo, "am", "--abort")
    with open(lista, encoding="utf-8") as f:
        esperado = sum(1 for linha in f if linha.strip())
    if not esperado:
        continue
    commits = int(git(repo, "rev-list", "--count", "HEAD").stdout.strip() or 0)
    ok = commits == esperado + 1
    faltando += 0 if ok else 1
    print(f"{'ok ' if ok else 'ERRO'} {item['repo']}: {esperado} modificacoes, {commits} commits")

print("tudo aplicado" if not faltando else f"{faltando} pastas sem as modificacoes")
sys.exit(1 if faltando else 0)
