# Correções no código do Electron em C:\e\src\electron. Rodar de novo não muda nada (compilar.cmd chama sempre).
import pathlib
import sys

ROOT = pathlib.Path(r"C:\e\src\electron")

CORRECOES = [
    # Electron 45.1.0 não monta com enable_pdf_viewer = false: o arquivo pede o leitor de PDF com ENABLE_PDF,
    # que continua ligado por causa da impressão, mas o BUILD.gn só inclui o leitor com enable_pdf_viewer.
    ("shell/browser/extensions/electron_component_extension_resource_manager.cc", [
        ('#include "pdf/buildflags.h"', '#include "electron/buildflags/buildflags.h"\n#include "pdf/buildflags.h"'),
        ("#if BUILDFLAG(ENABLE_PDF)\n#include <utility>", "#if BUILDFLAG(ENABLE_PDF_VIEWER)\n#include <utility>"),
        ("#endif  // BUILDFLAG(ENABLE_PDF)", "#endif  // BUILDFLAG(ENABLE_PDF_VIEWER)"),
        ("#if BUILDFLAG(ENABLE_PDF)\n  AddComponentResourceEntries", "#if BUILDFLAG(ENABLE_PDF_VIEWER)\n  AddComponentResourceEntries"),
    ]),
]

COPIA = 'AddExtensionASCII("guardado-" + base::NumberToString(base::Time::Now().InMillisecondsSinceUnixEpoch()))'
SO_CORRUPCAO = (
    "  // NFS: erro de trava ou de disco nunca apaga nada; so a falta do MANIFEST e corrupcao de verdade.\n"
    "  if (!status.IsCorruption() &&\n"
    '      status.ToString().find("MANIFEST") == std::string::npos) {\n'
    "    return false;\n"
    "  }\n"
    "  // NFS: reparar e limpar apagam arquivos, entao antes fica uma copia. Sem copia, falha.\n"
    "  if (recovery_option != FAIL_ON_CORRUPTION &&\n"
    "      !base::CopyDirectory(PASTA, PASTA." + COPIA + ",\n"
    "                           true)) {\n"
    "    return false;\n"
    "  }\n\n"
    "  switch (recovery_option) {"
)
# O Chromium apaga os saves (OPFS) quando acha que o banco esta com defeito. Pedido do Bruno: nunca apagar.
# O caminho "..\storage" sai da pasta electron para o codigo do Chromium.
CORRECOES += [
    ("../storage/browser/file_system/sandbox_directory_database.cc", [
        ("  switch (recovery_option) {", SO_CORRUPCAO.replace("PASTA", "filesystem_data_directory_")),
    ]),
    ("../storage/browser/file_system/sandbox_origin_database.cc", [
        ("  switch (recovery_option) {", SO_CORRUPCAO.replace("PASTA", "file_system_directory_")),
    ]),
    # Pasta sem registro no banco nao e lixo: fica guardada com outro nome.
    ("../storage/browser/file_system/obfuscated_file_util.cc", [
        # Banco ocupado por outra copia fechando responde "nao tem" sem ter olhado. Com ele aberto, a resposta e verdadeira.
        ("  bool exists_in_db = origin_database_->HasOriginPath(id);",
         "  // NFS: banco ocupado (outra copia fechando): falha em vez de achar que a pasta e orfa.\n"
         "  std::vector<SandboxOriginDatabaseInterface::OriginRecord> origins;\n"
         "  if (!origin_database_->ListAllOrigins(&origins)) {\n"
         "    return base::unexpected(base::File::FILE_ERROR_FAILED);\n"
         "  }\n"
         "  bool exists_in_db = origin_database_->HasOriginPath(id);"),
        ("  if (!exists_in_db && exists_in_fs) {\n    if (!delegate_->DeleteFileOrDirectory(path, true)) {",
         "  if (!exists_in_db && exists_in_fs) {\n    // NFS: nunca apaga save; guarda com outro nome.\n"
         "    if (is_incognito() ? !delegate_->DeleteFileOrDirectory(path, true)\n"
         "                       : !base::Move(path, path." + COPIA + ")) {"),
    ]),
    # Configuracoes do site (localStorage): mesma regra. Sem banco nesta sessao, fica so na memoria e o disco nao muda.
    ("../components/services/storage/dom_storage/local_storage_impl.cc", [
        ('#include "base/files/file_path.h"', '#include "base/files/file_path.h"\n#include "base/files/file_util.h"'),
        ('#include "base/strings/strcat.h"',
         '#include "base/strings/strcat.h"\n#include "base/strings/string_number_conversions.h"\n#include "base/time/time.h"'),
        ("  if (!outcome.open_status.ok()) {\n",
         "  if (!outcome.open_status.ok()) {\n"
         "    // NFS: erro de trava ou de disco nunca apaga: nesta sessao fica so na memoria.\n"
         "    if (!in_memory_ && !outcome.open_status.IsCorruption()) {\n"
         "      database_.reset();\n"
         "      tried_to_recreate_during_open_ = true;\n"
         "      InitiateConnection(/*in_memory_only=*/true,\n"
         "                         /*destroy_existing_db_for_recovery=*/false);\n"
         "      return;\n"
         "    }\n"),
        ("  InitiateConnection(recreate_in_memory,\n                     /*destroy_existing_db_for_recovery=*/!in_memory_);",
         "  // NFS: destruir o banco apaga as configuracoes do site; antes fica uma copia. Sem copia, so na memoria.\n"
         "  bool destroy = !in_memory_;\n"
         "  if (destroy) {\n"
         '    const base::FilePath pasta = storage_partition_directory_.AppendASCII("Local Storage");\n'
         "    if (!base::CopyDirectory(pasta, pasta." + COPIA + ",\n"
         "                             true)) {\n"
         "      recreate_in_memory = true;\n"
         "      destroy = false;\n"
         "    }\n"
         "  }\n"
         "  InitiateConnection(recreate_in_memory, destroy);"),
    ]),
    # Placa sem DirectX 12 e com DirectX 11 nivel 11_0 (ex.: GTX 550 Ti, Fermi): o Dawn so da o WebGPU completo em 11_1,
    # e no 11_0 so o de compatibilidade, que o jogo nao pede. Aqui o 11_0 tambem entra no completo. So vale no modo
    # DirectX 11 do app (--use-webgpu-adapter=d3d11), que so liga sozinho quando a placa nao tem DirectX 12.
    # Jogador com GTX 550 Ti jogou com isto em 05/11 (versao de teste separada). O minimo de buffers do modo completo
    # cabe: buffer so de leitura usa SRV, nao UAV.
    ("../third_party/dawn/src/dawn/native/d3d11/PhysicalDeviceD3D11.cpp", [
        ("        case wgpu::FeatureLevel::Core: {\n            return mFeatureLevel >= D3D_FEATURE_LEVEL_11_1;",
         "        case wgpu::FeatureLevel::Core: {\n            return mFeatureLevel >= D3D_FEATURE_LEVEL_11_0;  // NFS: 11_0 tambem"),
        ("    limits->v1.maxStorageBuffersPerShaderStage = maxUAVsPerStage / 2;\n",
         "    limits->v1.maxStorageBuffersPerShaderStage = maxUAVsPerStage / 2;\n"
         "    // NFS: minimo do modo completo no nivel 11_0; buffer so de leitura usa SRV, nao UAV.\n"
         "    limits->v1.maxStorageBuffersPerShaderStage = std::max(limits->v1.maxStorageBuffersPerShaderStage, 8u);\n"),
    ]),
    # Disco quase cheio: o Chromium apagaria os dados do jogo sozinho. Melhor falhar ao gravar.
    ("../storage/browser/quota/quota_manager_impl.cc", [
        ("  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);\n\n  if (eviction_disabled_) {",
         "  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);\n\n"
         "  eviction_disabled_ = true;  // NFS: nunca apaga save para liberar disco.\n  if (eviction_disabled_) {"),
    ]),
]

# Anti-serrilhado (FXAA), desligado por padrao: o jogo na web nao tem nenhum. Roda sobre a imagem pronta, logo antes do passo
# de alfa, so com --enable-features=NfsAntiAlias. Encoder proprio: se falhar, o quadro sai sem filtro e o alfa continua.
# O shader e o do prototipo medido em 03/11 (RTX 4060, 1440p: ~0,21 ms por quadro; pior caso ~0,35 ms).
FXAA_WGSL = r'''
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(p[i], 0, 1);
}
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
const LIMIAR_MIN = 0.0312;
const LIMIAR = 0.125;
const SUBPIXEL = 0.5;
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
fn am(uv: vec2f) -> vec3f { return textureSampleLevel(src, smp, uv, 0.0).rgb; }
@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  var Q = array<f32, 10>(1.0, 1.0, 1.0, 1.0, 1.5, 2.0, 2.0, 2.0, 4.0, 8.0);
  let inv = 1.0 / vec2f(textureDimensions(src));
  let uv = pos.xy * inv;
  let cor = am(uv);
  let c = lum(cor);
  let n = lum(am(uv + vec2f(0.0, -inv.y)));
  let s = lum(am(uv + vec2f(0.0, inv.y)));
  let l = lum(am(uv + vec2f(inv.x, 0.0)));
  let o = lum(am(uv + vec2f(-inv.x, 0.0)));
  let mn = min(c, min(n, min(s, min(l, o))));
  let mx = max(c, max(n, max(s, max(l, o))));
  let faixa = mx - mn;
  if (faixa < max(LIMIAR_MIN, mx * LIMIAR)) { return vec4f(cor, 1.0); }
  let no = lum(am(uv + vec2f(-inv.x, -inv.y)));
  let ne = lum(am(uv + vec2f(inv.x, -inv.y)));
  let so = lum(am(uv + vec2f(-inv.x, inv.y)));
  let se = lum(am(uv + vec2f(inv.x, inv.y)));
  let bordaH = abs(-2.0 * o + no + so) + abs(-2.0 * c + n + s) * 2.0 + abs(-2.0 * l + ne + se);
  let bordaV = abs(-2.0 * n + no + ne) + abs(-2.0 * c + o + l) * 2.0 + abs(-2.0 * s + so + se);
  let horizontal = bordaH >= bordaV;
  var passo = select(inv.x, inv.y, horizontal);
  let l1 = select(o, n, horizontal);
  let l2 = select(l, s, horizontal);
  let g1 = l1 - c;
  let g2 = l2 - c;
  let forte1 = abs(g1) >= abs(g2);
  let gMin = 0.25 * max(abs(g1), abs(g2));
  var media = 0.5 * (l2 + c);
  if (forte1) { passo = -passo; media = 0.5 * (l1 + c); }
  var base = uv;
  if (horizontal) { base.y += passo * 0.5; } else { base.x += passo * 0.5; }
  let dir = select(vec2f(0.0, inv.y), vec2f(inv.x, 0.0), horizontal);
  var uv1 = base - dir;
  var uv2 = base + dir;
  var f1 = lum(am(uv1)) - media;
  var f2 = lum(am(uv2)) - media;
  var fim1 = abs(f1) >= gMin;
  var fim2 = abs(f2) >= gMin;
  for (var i = 1; i < 10 && !(fim1 && fim2); i++) {
    if (!fim1) { uv1 -= dir * Q[i]; f1 = lum(am(uv1)) - media; fim1 = abs(f1) >= gMin; }
    if (!fim2) { uv2 += dir * Q[i]; f2 = lum(am(uv2)) - media; fim2 = abs(f2) >= gMin; }
  }
  let d1 = select(uv.y - uv1.y, uv.x - uv1.x, horizontal);
  let d2 = select(uv2.y - uv.y, uv2.x - uv.x, horizontal);
  let perto1 = d1 < d2;
  let dist = min(d1, d2);
  let extremo = select(f2, f1, perto1);
  let certo = (extremo < 0.0) != (c < media);
  var desloc = select(0.0, 0.5 - dist / (d1 + d2), certo);
  let mediaTudo = (2.0 * (n + s + l + o) + no + ne + so + se) / 12.0;
  let sub1 = clamp(abs(mediaTudo - c) / faixa, 0.0, 1.0);
  let sub2 = (-2.0 * sub1 + 3.0) * sub1 * sub1;
  desloc = max(desloc, sub2 * sub2 * SUBPIXEL);
  var fim = uv;
  if (horizontal) { fim.y += desloc * passo; } else { fim.x += desloc * passo; }
  return vec4f(am(fim), 1.0);
}
'''
CLEARER_H = '#include "third_party/blink/renderer/platform/graphics/gpu/webgpu_texture_alpha_clearer.h"\n\n'
CORRECOES += [
    ("../third_party/blink/renderer/platform/graphics/gpu/webgpu_texture_alpha_clearer.h", [
        ("  void ClearAlpha(const wgpu::Texture& texture);\n",
         "  void ClearAlpha(const wgpu::Texture& texture);\n\n"
         "  // NFS: anti-serrilhado sobre a imagem pronta (NfsAntiAlias).\n"
         "  void AntiAlias(const wgpu::Texture& texture, const wgpu::TextureView& view);\n"),
        ("  wgpu::RenderPipeline alpha_to_one_pipeline_ = nullptr;\n",
         "  wgpu::RenderPipeline alpha_to_one_pipeline_ = nullptr;\n"
         "  wgpu::RenderPipeline fxaa_pipeline_ = nullptr;\n"
         "  wgpu::Sampler fxaa_sampler_ = nullptr;\n"
         "  wgpu::Texture fxaa_copy_ = nullptr;\n"
         "  wgpu::BindGroup fxaa_bind_group_ = nullptr;\n"),
    ]),
    ("../third_party/blink/renderer/platform/graphics/gpu/webgpu_texture_alpha_clearer.cc", [
        (CLEARER_H + "namespace blink {\n",
         CLEARER_H + '#include "base/feature_list.h"\n\nnamespace blink {\n\nnamespace {\n\n'
         "// NFS: anti-serrilhado do NFS Launcher, ligado pela opcao do app.\n"
         "BASE_FEATURE(kNfsAntiAlias, base::FEATURE_DISABLED_BY_DEFAULT);\n\n"
         'constexpr char kFxaaShader[] = R"(' + FXAA_WGSL + ')";\n\n'
         "}  // namespace\n"),
        ("  alpha_to_one_pipeline_ = device_.CreateRenderPipeline(&pipeline_desc);\n}\n",
         "  alpha_to_one_pipeline_ = device_.CreateRenderPipeline(&pipeline_desc);\n\n"
         "  if (base::FeatureList::IsEnabled(kNfsAntiAlias)) {\n"
         "    // NFS: erro aqui fica escondido do jogo; o quadro sai sem filtro.\n"
         "    device_.PushErrorScope(wgpu::ErrorFilter::Validation);\n"
         "    wgpu::ShaderSourceWGSL fxaa_wgsl = {};\n"
         "    fxaa_wgsl.code = kFxaaShader;\n"
         "    wgpu::ShaderModuleDescriptor fxaa_module_desc = {.nextInChain = &fxaa_wgsl};\n"
         "    wgpu::ShaderModule fxaa_module = device_.CreateShaderModule(&fxaa_module_desc);\n"
         "    wgpu::ColorTargetState fxaa_target = {.format = format};\n"
         "    wgpu::FragmentState fxaa_fragment = {\n"
         "        .module = fxaa_module,\n"
         "        .targetCount = 1,\n"
         "        .targets = &fxaa_target,\n"
         "    };\n"
         "    wgpu::RenderPipelineDescriptor fxaa_desc = {\n"
         "        .vertex = {.module = fxaa_module},\n"
         "        .primitive = {.topology = wgpu::PrimitiveTopology::TriangleList},\n"
         "        .multisample = {.count = 1, .mask = 0xFFFFFFFF},\n"
         "        .fragment = &fxaa_fragment,\n"
         "    };\n"
         "    fxaa_pipeline_ = device_.CreateRenderPipeline(&fxaa_desc);\n"
         "    wgpu::SamplerDescriptor sampler_desc = {};\n"
         "    sampler_desc.magFilter = wgpu::FilterMode::Linear;\n"
         "    sampler_desc.minFilter = wgpu::FilterMode::Linear;\n"
         "    fxaa_sampler_ = device_.CreateSampler(&sampler_desc);\n"
         "    device_.PopErrorScope(wgpu::CallbackMode::AllowSpontaneous,\n"
         "                          [](wgpu::PopErrorScopeStatus, wgpu::ErrorType,\n"
         "                             wgpu::StringView) {});\n"
         "  }\n}\n"),
        ("void WebGPUTextureAlphaClearer::ClearAlpha(const wgpu::Texture& texture) {\n",
         "void WebGPUTextureAlphaClearer::AntiAlias(const wgpu::Texture& texture,\n"
         "                                          const wgpu::TextureView& view) {\n"
         "  const uint32_t width = texture.GetWidth();\n"
         "  const uint32_t height = texture.GetHeight();\n"
         "  if (!fxaa_pipeline_ || width == 0 || height == 0) {\n"
         "    return;\n"
         "  }\n"
         "  if (!fxaa_copy_ || fxaa_copy_.GetWidth() != width ||\n"
         "      fxaa_copy_.GetHeight() != height) {\n"
         "    wgpu::TextureDescriptor copy_desc = {};\n"
         "    copy_desc.usage =\n"
         "        wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::CopyDst;\n"
         "    copy_desc.size = {width, height, 1};\n"
         "    copy_desc.format = format_;\n"
         "    fxaa_copy_ = device_.CreateTexture(&copy_desc);\n"
         "    wgpu::BindGroupEntry entries[2] = {};\n"
         "    entries[0].binding = 0;\n"
         "    entries[0].textureView = fxaa_copy_.CreateView();\n"
         "    entries[1].binding = 1;\n"
         "    entries[1].sampler = fxaa_sampler_;\n"
         "    wgpu::BindGroupDescriptor bind_group_desc = {};\n"
         "    bind_group_desc.layout = fxaa_pipeline_.GetBindGroupLayout(0);\n"
         "    bind_group_desc.entryCount = 2;\n"
         "    bind_group_desc.entries = entries;\n"
         "    fxaa_bind_group_ = device_.CreateBindGroup(&bind_group_desc);\n"
         "  }\n\n"
         "  wgpu::DawnEncoderInternalUsageDescriptor internal_usage_desc = {};\n"
         "  internal_usage_desc.useInternalUsages = true;\n"
         "  wgpu::CommandEncoderDescriptor command_encoder_desc = {\n"
         "      .nextInChain = &internal_usage_desc,\n"
         "  };\n"
         "  wgpu::CommandEncoder command_encoder =\n"
         "      device_.CreateCommandEncoder(&command_encoder_desc);\n"
         "  wgpu::TexelCopyTextureInfo source = {.texture = texture};\n"
         "  wgpu::TexelCopyTextureInfo destination = {.texture = fxaa_copy_};\n"
         "  wgpu::Extent3D copy_size = {width, height, 1};\n"
         "  command_encoder.CopyTextureToTexture(&source, &destination, &copy_size);\n"
         "  wgpu::RenderPassColorAttachment color_attachment = {\n"
         "      .view = view,\n"
         "      .depthSlice = wgpu::kDepthSliceUndefined,\n"
         "      .loadOp = wgpu::LoadOp::Load,\n"
         "      .storeOp = wgpu::StoreOp::Store,\n"
         "  };\n"
         "  wgpu::RenderPassDescriptor render_pass_desc = {\n"
         "      .colorAttachmentCount = 1,\n"
         "      .colorAttachments = &color_attachment,\n"
         "  };\n"
         "  wgpu::RenderPassEncoder pass =\n"
         "      command_encoder.BeginRenderPass(&render_pass_desc);\n"
         "  pass.SetPipeline(fxaa_pipeline_);\n"
         "  pass.SetBindGroup(0, fxaa_bind_group_);\n"
         "  pass.Draw(3, 1, 0, 0);\n"
         "  pass.End();\n"
         "  wgpu::CommandBuffer command_buffer = command_encoder.Finish();\n"
         "  device_.GetQueue().Submit(1, &command_buffer);\n"
         "}\n\n"
         "void WebGPUTextureAlphaClearer::ClearAlpha(const wgpu::Texture& texture) {\n"),
        ("  wgpu::TextureView attachment_view = texture.CreateView();\n",
         "  wgpu::TextureView attachment_view = texture.CreateView();\n"
         "  AntiAlias(texture, attachment_view);\n"),
    ]),
]


def main():
    for nome, trocas in CORRECOES:
        caminho = ROOT / nome
        with open(caminho, encoding="utf-8", newline="") as f:
            texto = f.read()
        fim = "\r\n" if "\r\n" in texto else "\n"
        novo = texto
        for antes, depois in trocas:
            antes, depois = antes.replace("\n", fim), depois.replace("\n", fim)
            if depois in novo:
                continue
            if novo.count(antes) != 1:
                sys.exit(f"Trecho nao encontrado em {nome}: {antes!r}")
            novo = novo.replace(antes, depois)
        if novo != texto:
            with open(caminho, "w", encoding="utf-8", newline="") as f:
                f.write(novo)
            print(f"corrigido: {nome}")
        else:
            print(f"ja estava: {nome}")


main()
