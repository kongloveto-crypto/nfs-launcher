# SO PARA TESTE, nunca no motor do instalador: cria o dispositivo DirectX 11 sempre em nivel 11_0, para uma placa nova
# imitar uma antiga (ex.: GTX 550 Ti). A correcao de verdade (11_0 no modo completo) fica no aplicar-correcoes.py
# desde a 2.0.7. Usado em 05/11 para a versao separada "NFS Launcher DX11 Teste".
# Uso: python3 dx11-110.py aplicar | desfazer | ver   (depois de testar: desfazer, e recompilar o motor oficial)
import sys, pathlib

F = pathlib.Path(r'C:\e\src\third_party\dawn\src\dawn\native\d3d11\PhysicalDeviceD3D11.cpp')
TROCAS = [
    ('    const D3D_FEATURE_LEVEL featureLevels[] = {D3D_FEATURE_LEVEL_11_1, D3D_FEATURE_LEVEL_11_0};\n\n    ComPtr<ID3D11Device> d3d11Device;',
     '    const D3D_FEATURE_LEVEL featureLevels[] = {D3D_FEATURE_LEVEL_11_0};  // NFS-DX11-110\n\n    ComPtr<ID3D11Device> d3d11Device;'),
]

def main():
    acao = sys.argv[1] if len(sys.argv) > 1 else 'ver'
    t = F.read_text(encoding='utf-8')
    aplicado = 'NFS-DX11-110' in t
    if acao == 'ver':
        print('aplicado' if aplicado else 'original')
        return
    if acao == 'aplicar':
        if aplicado:
            print('ja aplicado'); return
        for a, b in TROCAS:
            if t.count(a) != 1:
                sys.exit('trecho nao encontrado: ' + a[:60])
            t = t.replace(a, b)
    elif acao == 'desfazer':
        if not aplicado:
            print('ja original'); return
        for a, b in TROCAS:
            if t.count(b) != 1:
                sys.exit('trecho nao encontrado: ' + b[:60])
            t = t.replace(b, a)
    else:
        sys.exit('uso: aplicar | desfazer | ver')
    F.write_text(t, encoding='utf-8', newline='\n')
    print('feito:', acao)

main()
