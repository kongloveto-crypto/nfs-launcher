# Running nfsu2-web on GPUs without DirectX 12 (D3D feature level 11_0)

## Problem
A player with a **GTX 550 Ti** (Fermi, D3D feature level 11_0, driver 391.35, the last one) got "WebGPU unavailable", in Chrome and in our launcher.
- Chrome on Windows only uses Dawn's D3D12 backend. Fermi has no usable D3D12 for WebGPU.
- Dawn's D3D11 backend exists (`--use-webgpu-adapter=d3d11`), but `PhysicalDevice::SupportsFeatureLevel` only offers **Core** at feature level **11_1**. At 11_0 it only offers **Compatibility**.
- The game requests a Core adapter, so no adapter is returned.
- Forcing compatibility (`--force-webgpu-compat`) is not enough. In compat, `maxStorageBuffersInVertexStage` defaults to 0, and the vertex shader reads a storage buffer (vsemu: `@group(0) @binding(0) var<storage, read> VB`).

## What we changed
Our launcher is Electron 45.1.0, Chromium 156, built from source. We patched Dawn in `third_party/dawn/src/dawn/native/d3d11/PhysicalDeviceD3D11.cpp`:

```diff
     case wgpu::FeatureLevel::Core: {
-        return mFeatureLevel >= D3D_FEATURE_LEVEL_11_1;
+        return mFeatureLevel >= D3D_FEATURE_LEVEL_11_0;
```

```diff
     limits->v1.maxStorageBuffersPerShaderStage = maxUAVsPerStage / 2;
+    // Core minimum at feature level 11_0; read-only storage buffers use SRVs, not UAVs.
+    limits->v1.maxStorageBuffersPerShaderStage = std::max(limits->v1.maxStorageBuffersPerShaderStage, 8u);
```

The launcher only uses the D3D11 backend when no D3D12 adapter is found (two failed WebGPU checks), with these switches:

```
--use-webgpu-adapter=d3d11
--disable-dawn-features=adapter_blocklist
```

On GPUs with D3D12 nothing changes.

## Results
- **GTX 550 Ti:** the player confirmed the game runs.
- **RTX 4060, device forced to 11_0 (to imitate an old GPU):** adapter found with no WebGPU errors; intro, videos and menus at ~230 FPS.
- **RTX 4060, D3D11 backend:** 13 features vs 21 on D3D12, including `texture-compression-bc` and `core-features-and-limits`, with the same limits.

## Caveats
- **Not spec-correct, so not something to upstream.** Feature level 11_0 lacks things Core assumes:
  - UAVs outside the pixel and compute stages;
  - only 8 UAV slots, shared by writable storage buffers and storage textures.
  - It works for this game because its vertex-stage storage buffers are read-only (SRVs).
  - A shader with many writable storage buffers or storage textures in one stage could fail on 11_0.
- **Untested:** performance on the old GPU, and full races on it beyond the player's report.
- **Probably excluded:** cards below feature level 11_0 (DX10.x).

## Suggestion for the game (no browser patch needed)
If the game could request a compatibility-mode adapter when Core isn't available, Chrome could run it on DX11 cards without any patch:
- `requestAdapter({ featureLevel: 'compatibility' })`;
- `requiredLimits: { maxStorageBuffersInVertexStage: N }` (and textures, if needed).

The vertex-stage limit is the one that blocked us. Chrome would still need `--use-webgpu-adapter=d3d11` on Windows unless Chrome falls back to D3D11 automatically in the future.
