//@@ h-publico
  void ClearAlpha(const wgpu::Texture& texture);

  // NFS: pacote de imagem do NFS Launcher: o valor de --nfs-image no canvas
  // do jogo (14 numeros; vazio ou invalido = nada roda).
  void SetNfsImage(const std::string& spec);
//@@ h-privado
  wgpu::RenderPipeline alpha_to_one_pipeline_ = nullptr;

  // NFS: pacote de imagem (nfs-imagem.wgsl), sobre a imagem pronta.
  void NfsImage(const wgpu::Texture& texture, const wgpu::TextureView& view);
  void NfsImagePrepare(uint32_t width, uint32_t height);
  std::string nfs_spec_;
  std::array<float, 16> nfs_params_ = {};
  bool nfs_fxaa_ = false;
  bool nfs_grade_ = false;
  bool nfs_bloom_ = false;
  bool nfs_dirty_ = false;
  bool nfs_unsupported_ = false;
  wgpu::RenderPipeline nfs_fxaa_pipeline_ = nullptr;
  wgpu::RenderPipeline nfs_down_pipeline_ = nullptr;
  std::array<wgpu::RenderPipeline, 4> nfs_blur_pipelines_ = {};
  wgpu::RenderPipeline nfs_grade_pipeline_ = nullptr;
  wgpu::Sampler nfs_sampler_ = nullptr;
  wgpu::Buffer nfs_params_buffer_ = nullptr;
  wgpu::Texture nfs_t0_ = nullptr;
  wgpu::Texture nfs_t1_ = nullptr;
  wgpu::Texture nfs_b0_ = nullptr;
  wgpu::Texture nfs_b1_ = nullptr;
  wgpu::TextureView nfs_t1_view_ = nullptr;
  wgpu::TextureView nfs_b0_view_ = nullptr;
  wgpu::TextureView nfs_b1_view_ = nullptr;
  wgpu::BindGroup nfs_fxaa_group_ = nullptr;
  std::array<wgpu::BindGroup, 2> nfs_down_groups_ = {};
  std::array<wgpu::BindGroup, 4> nfs_blur_groups_ = {};
  std::array<wgpu::BindGroup, 2> nfs_grade_groups_ = {};
//@@ cc-funcoes
void WebGPUTextureAlphaClearer::SetNfsImage(const std::string& spec) {
  if (spec == nfs_spec_) {
    return;
  }
  nfs_spec_ = spec;
  // fxaa nitidez saturacao vibrance contraste brilho gama vinheta r g b bloom
  // limiar sepia
  static constexpr std::array<float, 14> kNeutral = {
      0.f, 0.f, 1.f, 0.f, 1.f, 1.f, 1.f, 0.f, 1.f, 1.f, 1.f, 0.f, 0.7f, 0.f};
  static constexpr std::array<float, 14> kMin = {
      0.f, 0.f, 0.f, -1.f, 0.5f, 0.5f, 0.5f, 0.f, 0.5f, 0.5f, 0.5f, 0.f, 0.f, 0.f};
  static constexpr std::array<float, 14> kMax = {
      1.f, 1.f, 2.f, 1.f, 1.5f, 1.5f, 2.f, 1.f, 1.5f, 1.5f, 1.5f, 2.f, 0.99f, 1.f};
  std::array<float, 14> v = kNeutral;
  const std::vector<std::string_view> parts = base::SplitStringPiece(
      spec, " ", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);
  bool ok = parts.size() == v.size();
  for (size_t i = 0; ok && i < v.size(); ++i) {
    double d = 0;
    ok = base::StringToDouble(parts[i], &d) && d >= kMin[i] && d <= kMax[i];
    v[i] = static_cast<float>(d);
  }
  if (!ok) {
    v = kNeutral;
  }
  nfs_params_ = {};
  for (size_t i = 0; i < v.size(); ++i) {
    nfs_params_[i] = v[i];
  }
  nfs_fxaa_ = v[0] > 0.5f;
  nfs_bloom_ = v[11] > 0.f;
  nfs_grade_ = false;
  for (size_t i = 1; i < v.size(); ++i) {
    // O limiar (12) sozinho nao muda a imagem.
    nfs_grade_ = nfs_grade_ || (i != 12 && v[i] != kNeutral[i]);
  }
  nfs_dirty_ = true;
}

void WebGPUTextureAlphaClearer::NfsImagePrepare(uint32_t width,
                                                uint32_t height) {
  if (!nfs_grade_pipeline_) {
    wgpu::ShaderSourceWGSL wgsl = {};
    wgsl.code = kNfsImageShader;
    wgpu::ShaderModuleDescriptor module_desc = {.nextInChain = &wgsl};
    wgpu::ShaderModule shader_module =
        device_.CreateShaderModule(&module_desc);
    wgpu::ColorTargetState target = {.format = format_};
    auto make = [&](const char* entry) {
      wgpu::FragmentState fragment = {
          .module = shader_module,
          .entryPoint = entry,
          .targetCount = 1,
          .targets = &target,
      };
      wgpu::RenderPipelineDescriptor desc = {
          .vertex = {.module = shader_module, .entryPoint = "vs"},
          .primitive = {.topology = wgpu::PrimitiveTopology::TriangleList},
          .multisample = {.count = 1, .mask = 0xFFFFFFFF},
          .fragment = &fragment,
      };
      return device_.CreateRenderPipeline(&desc);
    };
    nfs_fxaa_pipeline_ = make("fs_fxaa");
    nfs_down_pipeline_ = make("fs_down");
    nfs_blur_pipelines_[0] = make("fs_blur_h");
    nfs_blur_pipelines_[1] = make("fs_blur_v");
    nfs_blur_pipelines_[2] = make("fs_blur_h2");
    nfs_blur_pipelines_[3] = make("fs_blur_v2");
    nfs_grade_pipeline_ = make("fs_grade");
    wgpu::SamplerDescriptor sampler_desc = {};
    sampler_desc.magFilter = wgpu::FilterMode::Linear;
    sampler_desc.minFilter = wgpu::FilterMode::Linear;
    nfs_sampler_ = device_.CreateSampler(&sampler_desc);
    wgpu::BufferDescriptor buffer_desc = {};
    buffer_desc.usage = wgpu::BufferUsage::Uniform | wgpu::BufferUsage::CopyDst;
    buffer_desc.size = sizeof(float) * nfs_params_.size();
    nfs_params_buffer_ = device_.CreateBuffer(&buffer_desc);
    nfs_dirty_ = true;
  }

  // A segunda imagem inteira so existe quando o FXAA e a cor rodam juntos.
  const bool need_t1 = nfs_fxaa_ && nfs_grade_;
  if (nfs_t0_ && nfs_t0_.GetWidth() == width && nfs_t0_.GetHeight() == height &&
      (nfs_t1_ || !need_t1)) {
    return;
  }
  auto make_texture = [&](uint32_t w, uint32_t h, wgpu::TextureUsage usage) {
    wgpu::TextureDescriptor desc = {};
    desc.usage = usage;
    desc.size = {w, h, 1};
    desc.format = format_;
    return device_.CreateTexture(&desc);
  };
  auto bind = [&](const wgpu::RenderPipeline& pipeline,
                  const wgpu::Texture& source, bool params,
                  const wgpu::TextureView* glow) {
    std::array<wgpu::BindGroupEntry, 4> entries = {};
    size_t count = 0;
    entries[count].binding = 0;
    entries[count++].textureView = source.CreateView();
    entries[count].binding = 1;
    entries[count++].sampler = nfs_sampler_;
    if (params) {
      entries[count].binding = 2;
      entries[count++].buffer = nfs_params_buffer_;
    }
    if (glow) {
      entries[count].binding = 3;
      entries[count++].textureView = *glow;
    }
    wgpu::BindGroupDescriptor desc = {};
    desc.layout = pipeline.GetBindGroupLayout(0);
    desc.entryCount = count;
    desc.entries = entries.data();
    return device_.CreateBindGroup(&desc);
  };
  const wgpu::TextureUsage target_usage =
      wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::RenderAttachment;
  nfs_t0_ = make_texture(
      width, height,
      wgpu::TextureUsage::TextureBinding | wgpu::TextureUsage::CopyDst);
  nfs_b0_ = make_texture((width + 3) / 4, (height + 3) / 4, target_usage);
  nfs_b1_ = make_texture((width + 3) / 4, (height + 3) / 4, target_usage);
  nfs_b0_view_ = nfs_b0_.CreateView();
  nfs_b1_view_ = nfs_b1_.CreateView();
  nfs_fxaa_group_ = bind(nfs_fxaa_pipeline_, nfs_t0_, false, nullptr);
  nfs_down_groups_[0] = bind(nfs_down_pipeline_, nfs_t0_, true, nullptr);
  nfs_grade_groups_[0] = bind(nfs_grade_pipeline_, nfs_t0_, true, &nfs_b0_view_);
  nfs_blur_groups_[0] = bind(nfs_blur_pipelines_[0], nfs_b0_, false, nullptr);
  nfs_blur_groups_[1] = bind(nfs_blur_pipelines_[1], nfs_b1_, false, nullptr);
  nfs_blur_groups_[2] = bind(nfs_blur_pipelines_[2], nfs_b0_, false, nullptr);
  nfs_blur_groups_[3] = bind(nfs_blur_pipelines_[3], nfs_b1_, false, nullptr);
  nfs_t1_ = nullptr;
  nfs_t1_view_ = nullptr;
  nfs_down_groups_[1] = nullptr;
  nfs_grade_groups_[1] = nullptr;
  if (need_t1) {
    nfs_t1_ = make_texture(width, height, target_usage);
    nfs_t1_view_ = nfs_t1_.CreateView();
    nfs_down_groups_[1] = bind(nfs_down_pipeline_, nfs_t1_, true, nullptr);
    nfs_grade_groups_[1] =
        bind(nfs_grade_pipeline_, nfs_t1_, true, &nfs_b0_view_);
  }
}

// Roda dentro do escopo de erro do ClearAlpha: se algo falhar, o quadro sai
// sem o pacote de imagem e o jogo nao ve o erro.
void WebGPUTextureAlphaClearer::NfsImage(const wgpu::Texture& texture,
                                         const wgpu::TextureView& view) {
  if ((!nfs_fxaa_ && !nfs_grade_) || nfs_unsupported_) {
    return;
  }
  // As contas valem para imagem comum de 8 bits (a do jogo); HDR fica de fora.
  if (format_ != wgpu::TextureFormat::BGRA8Unorm &&
      format_ != wgpu::TextureFormat::RGBA8Unorm) {
    nfs_unsupported_ = true;
    return;
  }
  const uint32_t width = texture.GetWidth();
  const uint32_t height = texture.GetHeight();
  if (width == 0 || height == 0) {
    return;
  }
  NfsImagePrepare(width, height);
  if (nfs_dirty_) {
    device_.GetQueue().WriteBuffer(nfs_params_buffer_, 0, nfs_params_.data(),
                                   sizeof(float) * nfs_params_.size());
    nfs_dirty_ = false;
  }

  wgpu::DawnEncoderInternalUsageDescriptor internal_usage_desc = {};
  internal_usage_desc.useInternalUsages = true;
  wgpu::CommandEncoderDescriptor command_encoder_desc = {
      .nextInChain = &internal_usage_desc,
  };
  wgpu::CommandEncoder command_encoder =
      device_.CreateCommandEncoder(&command_encoder_desc);
  wgpu::TexelCopyTextureInfo source = {.texture = texture};
  wgpu::TexelCopyTextureInfo destination = {.texture = nfs_t0_};
  wgpu::Extent3D copy_size = {width, height, 1};
  command_encoder.CopyTextureToTexture(&source, &destination, &copy_size);
  auto draw = [&](const wgpu::TextureView& target,
                  const wgpu::RenderPipeline& pipeline,
                  const wgpu::BindGroup& group) {
    wgpu::RenderPassColorAttachment color_attachment = {
        .view = target,
        .depthSlice = wgpu::kDepthSliceUndefined,
        .loadOp = wgpu::LoadOp::Load,
        .storeOp = wgpu::StoreOp::Store,
    };
    wgpu::RenderPassDescriptor render_pass_desc = {
        .colorAttachmentCount = 1,
        .colorAttachments = &color_attachment,
    };
    wgpu::RenderPassEncoder pass =
        command_encoder.BeginRenderPass(&render_pass_desc);
    pass.SetPipeline(pipeline);
    pass.SetBindGroup(0, group);
    pass.Draw(3, 1, 0, 0);
    pass.End();
  };
  size_t from = 0;
  if (nfs_fxaa_) {
    draw(nfs_grade_ ? nfs_t1_view_ : view, nfs_fxaa_pipeline_, nfs_fxaa_group_);
    from = nfs_grade_ ? 1 : 0;
  }
  if (nfs_grade_) {
    if (nfs_bloom_) {
      draw(nfs_b0_view_, nfs_down_pipeline_, nfs_down_groups_[from]);
      draw(nfs_b1_view_, nfs_blur_pipelines_[0], nfs_blur_groups_[0]);
      draw(nfs_b0_view_, nfs_blur_pipelines_[1], nfs_blur_groups_[1]);
      draw(nfs_b1_view_, nfs_blur_pipelines_[2], nfs_blur_groups_[2]);
      draw(nfs_b0_view_, nfs_blur_pipelines_[3], nfs_blur_groups_[3]);
    }
    draw(view, nfs_grade_pipeline_, nfs_grade_groups_[from]);
  }
  wgpu::CommandBuffer command_buffer = command_encoder.Finish();
  device_.GetQueue().Submit(1, &command_buffer);
}

void WebGPUTextureAlphaClearer::ClearAlpha(const wgpu::Texture& texture) {
//@@ canvas
  // NFS: pacote de imagem do NFS Launcher. O app poe --nfs-image no canvas do
  // jogo por CSS (sem script); aqui o valor segue para o passo de imagem.
  if (alpha_clearer_ && !Host()->IsOffscreenCanvas()) {
    DEFINE_STATIC_LOCAL(const AtomicString, nfs_image_name, ("--nfs-image"));
    const ComputedStyle* nfs_style =
        static_cast<HTMLCanvasElement*>(Host())->GetComputedStyle();
    CSSVariableData* nfs_data =
        nfs_style ? nfs_style->GetVariableData(nfs_image_name) : nullptr;
    alpha_clearer_->SetNfsImage(nfs_data ? nfs_data->Serialize().Utf8()
                                         : std::string());
  }
  mailbox_texture->SetAlphaClearer(alpha_clearer_);
