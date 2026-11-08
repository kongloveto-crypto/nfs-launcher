// ───────────────── NFS Launcher (1.6.4): texturas HD do NFSU2 no celular ─────────────────
// Mesmo caminho do app de PC (src/main/modFiles.js), dentro do motor: o jogo lê os arquivos pela lista do site
// (/data-manifest) e os baixa em blocos (/data-blocks/<v>/<caminho>?b&n&m&s) ou com Range (/data/<caminho>).
// Aqui, só nas páginas e workers do site do NFSU2, a lista ganha o pacote de texturas do APK
// (assets/nfs/texturas.ntxp, sem compressão) no lugar de TEXPACKS/detailed.pak, e os pedidos desse arquivo saem do APK.
// Todo o resto segue para o site sem mudança. Sem script na página. Com "--nfs-sem-texturas" (opção desligada no
// app) ou sem o pacote, nada passa por aqui. Qualquer falha: a lista do site segue como veio.
// Inserido em chrome/browser/chrome_content_browser_client.cc por mobile/make-patches.py (patch 0007).
#include <unistd.h>

#include "base/android/apk_assets.h"
#include "base/files/memory_mapped_file.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/escape.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/thread_pool.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/receiver_set.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "mojo/public/cpp/system/data_pipe.h"
#include "mojo/public/cpp/system/data_pipe_drainer.h"
#include "mojo/public/cpp/system/data_pipe_producer.h"
#include "mojo/public/cpp/system/string_data_source.h"
#include "net/base/url_util.h"
#include "net/http/http_request_headers.h"
#include "net/http/http_response_headers.h"
#include "net/http/http_util.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/url_loader_completion_status.h"
#include "services/network/public/mojom/early_hints.mojom.h"
#include "services/network/public/mojom/url_loader.mojom.h"
#include "services/network/public/mojom/url_loader_factory.mojom.h"
#include "services/network/public/mojom/url_response_head.mojom.h"

namespace nfs_tex {

constexpr char kAsset[] = "assets/nfs/texturas.ntxp";
constexpr char kPath[] = "TEXPACKS/detailed.pak";
constexpr int64_t kBlock = 1 << 20;

struct Pack {
  int fd = -1;
  int64_t offset = 0;
  int64_t size = 0;
  int64_t m = 0;  // "data" do arquivo para o jogo (ele guarda cópia por caminho.tamanho.data): fixa por pacote
};

Pack OpenPack() {
  Pack p;
  if (base::CommandLine::ForCurrentProcess()->HasSwitch("nfs-sem-texturas")) {
    return p;
  }
  base::MemoryMappedFile::Region region;
  int fd = base::android::OpenApkAsset(kAsset, &region);
  if (fd < 0) {
    return p;
  }
  uint8_t head[4096];
  ssize_t n = pread(fd, head, sizeof(head), region.offset);
  if (region.size < 64 || n < 16 || memcmp(head, "NTXP", 4) != 0) {
    close(fd);
    return p;
  }
  uint32_t h = 2166136261u;
  for (ssize_t i = 0; i < n; i++) {
    h = (h ^ head[i]) * 16777619u;
  }
  for (int i = 0; i < 8; i++) {
    h = (h ^ ((static_cast<uint64_t>(region.size) >> (i * 8)) & 0xff)) * 16777619u;
  }
  p.fd = fd;
  p.offset = region.offset;
  p.size = region.size;
  p.m = 1600000000 + (h % 100000000);
  return p;
}

const Pack& GetPack() {
  static const Pack pack = OpenPack();
  return pack;
}

// Caminho do pacote como a lista do site o escreve (pode mudar maiúsculas) e se a lista já foi trocada.
std::string& Served() {
  static base::NoDestructor<std::string> s(kPath);
  return *s;
}
bool g_patched = false;

bool IsGameUrl(const GURL& u) {
  return u.SchemeIs(url::kHttpsScheme) && (u.host() == "nfsu2.xyz" || u.host() == "www.nfsu2.xyz");
}

bool Wanted(const url::Origin& initiator) {
  return !initiator.opaque() && initiator.scheme() == url::kHttpsScheme &&
         (initiator.host() == "nfsu2.xyz" || initiator.host() == "www.nfsu2.xyz") && GetPack().fd >= 0;
}

std::optional<std::string> ReadSpan(int64_t start, int64_t end) {
  const Pack& p = GetPack();
  std::string out(static_cast<size_t>(end - start), '\0');
  size_t got = 0;
  while (got < out.size()) {
    ssize_t n = pread(p.fd, out.data() + got, out.size() - got, p.offset + start + static_cast<int64_t>(got));
    if (n <= 0) {
      return std::nullopt;
    }
    got += static_cast<size_t>(n);
  }
  return out;
}

struct Patched {
  std::string body;
  std::string served;
  bool ok = false;
};

// Lista do site com o pacote: troca tamanho e data de TEXPACKS/detailed.pak (ou o acrescenta, com a pasta).
Patched PatchManifest(std::string body, int64_t size, int64_t m) {
  Patched out;
  std::optional<base::Value> v = base::JSONReader::Read(body, base::JSON_PARSE_RFC);
  base::ListValue* files = v && v->is_dict() ? v->GetDict().FindList("files") : nullptr;
  if (!files) {
    out.body = std::move(body);
    return out;
  }
  bool dir = false;
  bool done = false;
  for (base::Value& f : *files) {
    if (!f.is_dict()) {
      continue;
    }
    base::DictValue& d = f.GetDict();
    const std::string* p = d.FindString("p");
    if (!p) {
      continue;
    }
    std::string low = base::ToLowerASCII(*p);
    if (low == "texpacks") {
      dir = true;
    }
    if (!done && low == "texpacks/detailed.pak" && !d.Find("d")) {
      d.Set("s", static_cast<int>(size));
      d.Set("m", static_cast<int>(m));
      out.served = *p;
      done = true;
    }
  }
  if (!done) {
    if (!dir) {
      base::DictValue d;
      d.Set("p", "TEXPACKS");
      d.Set("d", 1);
      files->Append(std::move(d));
    }
    base::DictValue f;
    f.Set("p", kPath);
    f.Set("s", static_cast<int>(size));
    f.Set("m", static_cast<int>(m));
    files->Append(std::move(f));
    out.served = kPath;
  }
  std::optional<std::string> json = base::WriteJson(*v);
  if (!json) {
    out.body = std::move(body);
    out.served.clear();
    return out;
  }
  out.body = std::move(*json);
  out.ok = true;
  return out;
}

network::mojom::URLResponseHeadPtr MakeHead(int code, int64_t len, const std::string& range) {
  auto head = network::mojom::URLResponseHead::New();
  std::string raw = "HTTP/1.1 " + base::NumberToString(code) +
                    (code == 200 ? " OK" : code == 206 ? " Partial Content" : " Error") + "\n";
  raw += "Content-Type: application/octet-stream\nCache-Control: no-store\n";
  raw += "Cross-Origin-Resource-Policy: same-origin\nAccept-Ranges: bytes\n";
  raw += "Content-Length: " + base::NumberToString(len) + "\n";
  if (!range.empty()) {
    raw += "Content-Range: " + range + "\n";
  }
  head->headers = base::MakeRefCounted<net::HttpResponseHeaders>(net::HttpUtil::AssembleRawHeaders(raw));
  head->mime_type = "application/octet-stream";
  head->content_length = len;
  head->request_time = base::Time::Now();
  head->response_time = base::Time::Now();
  return head;
}

// Manda corpo e fim ao cliente; apaga o dono (via `done`) quando termina.
class BodySender {
 public:
  explicit BodySender(mojo::Remote<network::mojom::URLLoaderClient>* client) : client_(client) {}

  void Send(network::mojom::URLResponseHeadPtr head, std::string data, base::OnceClosure done) {
    done_ = std::move(done);
    data_ = std::move(data);
    mojo::ScopedDataPipeProducerHandle prod;
    mojo::ScopedDataPipeConsumerHandle cons;
    if (mojo::CreateDataPipe(1 << 20, prod, cons) != MOJO_RESULT_OK) {
      (*client_)->OnComplete(network::URLLoaderCompletionStatus(net::ERR_INSUFFICIENT_RESOURCES));
      std::move(done_).Run();
      return;
    }
    (*client_)->OnReceiveResponse(std::move(head), std::move(cons), std::nullopt);
    if (data_.empty()) {
      prod.reset();
      Finish(MOJO_RESULT_OK);
      return;
    }
    producer_ = std::make_unique<mojo::DataPipeProducer>(std::move(prod));
    producer_->Write(std::make_unique<mojo::StringDataSource>(
                         base::span<const char>(data_.data(), data_.size()),
                         mojo::StringDataSource::AsyncWritingMode::STRING_STAYS_VALID_UNTIL_COMPLETION),
                     base::BindOnce(&BodySender::Finish, weak_.GetWeakPtr()));
  }

 private:
  void Finish(MojoResult r) {
    producer_.reset();
    network::URLLoaderCompletionStatus status(r == MOJO_RESULT_OK ? net::OK : net::ERR_FAILED);
    (*client_)->OnComplete(status);
    std::move(done_).Run();
  }

  raw_ptr<mojo::Remote<network::mojom::URLLoaderClient>> client_;
  std::string data_;
  std::unique_ptr<mojo::DataPipeProducer> producer_;
  base::OnceClosure done_;
  base::WeakPtrFactory<BodySender> weak_{this};
};

// Pedido de um trecho do pacote: lido do APK fora da tela principal e entregue como se viesse do site.
class FileLoader : public network::mojom::URLLoader {
 public:
  FileLoader(mojo::PendingReceiver<network::mojom::URLLoader> loader,
             mojo::PendingRemote<network::mojom::URLLoaderClient> client)
      : receiver_(this, std::move(loader)), client_(std::move(client)), sender_(&client_) {
    receiver_.set_disconnect_handler(base::BindOnce(&FileLoader::Done, base::Unretained(this)));
    client_.set_disconnect_handler(base::BindOnce(&FileLoader::Done, base::Unretained(this)));
  }

  void Start(int code, int64_t start, int64_t end, std::string range) {
    if (end <= start) {
      sender_.Send(MakeHead(code, 0, range), std::string(),
                   base::BindOnce(&FileLoader::Done, base::Unretained(this)));
      return;
    }
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
        base::BindOnce(&ReadSpan, start, end),
        base::BindOnce(&FileLoader::Got, weak_.GetWeakPtr(), code, std::move(range)));
  }

  void FollowRedirect(network::HttpRequestHeadersUpdateParams, const std::optional<GURL>&) override {}
  void SetPriority(net::RequestPriority, int32_t) override {}

 private:
  void Got(int code, std::string range, std::optional<std::string> data) {
    if (!data) {
      client_->OnComplete(network::URLLoaderCompletionStatus(net::ERR_FAILED));
      Done();
      return;
    }
    int64_t len = static_cast<int64_t>(data->size());
    sender_.Send(MakeHead(code, len, range), std::move(*data),
                 base::BindOnce(&FileLoader::Done, base::Unretained(this)));
  }

  void Done() { delete this; }

  mojo::Receiver<network::mojom::URLLoader> receiver_;
  mojo::Remote<network::mojom::URLLoaderClient> client_;
  BodySender sender_;
  base::WeakPtrFactory<FileLoader> weak_{this};
};

// A lista do site: vai ao site (sem compressão), volta com o pacote no lugar de TEXPACKS/detailed.pak.
class ManifestLoader : public network::mojom::URLLoader,
                       public network::mojom::URLLoaderClient,
                       public mojo::DataPipeDrainer::Client {
 public:
  ManifestLoader(mojo::PendingReceiver<network::mojom::URLLoader> loader,
                 mojo::PendingRemote<network::mojom::URLLoaderClient> client)
      : receiver_(this, std::move(loader)), client_(std::move(client)), sender_(&client_) {
    receiver_.set_disconnect_handler(base::BindOnce(&ManifestLoader::Done, base::Unretained(this)));
    client_.set_disconnect_handler(base::BindOnce(&ManifestLoader::Done, base::Unretained(this)));
  }

  void Start(network::mojom::URLLoaderFactory* target,
             int32_t request_id,
             uint32_t options,
             const network::ResourceRequest& original,
             const net::MutableNetworkTrafficAnnotationTag& annotation) {
    network::ResourceRequest request(original);
    request.headers.SetHeader(net::HttpRequestHeaders::kAcceptEncoding, "identity");
    target->CreateLoaderAndStart(target_.BindNewPipeAndPassReceiver(), request_id, options, request,
                                 client_receiver_.BindNewPipeAndPassRemote(), annotation);
    // O site fecha a ligação depois do fim (normal); antes do fim, é falha.
    client_receiver_.set_disconnect_handler(base::BindOnce(&ManifestLoader::OnSiteGone, base::Unretained(this)));
  }

  // URLLoader (o jogo pede): repassa ao site.
  void FollowRedirect(network::HttpRequestHeadersUpdateParams params, const std::optional<GURL>& url) override {
    target_->FollowRedirect(std::move(params), url);
  }
  void SetPriority(net::RequestPriority priority, int32_t value) override { target_->SetPriority(priority, value); }

  // URLLoaderClient (o site responde).
  void OnReceiveEarlyHints(network::mojom::EarlyHintsPtr hints) override {
    client_->OnReceiveEarlyHints(std::move(hints));
  }
  void OnReceiveResponse(network::mojom::URLResponseHeadPtr head,
                         mojo::ScopedDataPipeConsumerHandle body,
                         std::optional<mojo_base::BigBuffer> meta) override {
    if (head->headers && head->headers->response_code() == 200 && body &&
        head->client_side_content_decoding_types.empty()) {
      head_ = std::move(head);
      drainer_ = std::make_unique<mojo::DataPipeDrainer>(this, std::move(body));
      return;
    }
    client_->OnReceiveResponse(std::move(head), std::move(body), std::move(meta));
  }
  void OnReceiveRedirect(const net::RedirectInfo& info, network::mojom::URLResponseHeadPtr head) override {
    client_->OnReceiveRedirect(info, std::move(head));
  }
  void OnUploadProgress(int64_t current, int64_t total, OnUploadProgressCallback callback) override {
    client_->OnUploadProgress(current, total, std::move(callback));
  }
  void OnTransferSizeUpdated(int32_t diff) override { client_->OnTransferSizeUpdated(diff); }
  void OnComplete(const network::URLLoaderCompletionStatus& status) override {
    if (!head_) {
      client_->OnComplete(status);
      Done();
      return;
    }
    status_ = status;
    completed_ = true;
    MaybePatch();
  }

  // DataPipeDrainer::Client
  void OnDataAvailable(base::span<const uint8_t> data) override {
    body_.append(reinterpret_cast<const char*>(data.data()), data.size());
  }
  void OnDataComplete() override {
    drained_ = true;
    MaybePatch();
  }

 private:
  void MaybePatch() {
    if (!drained_ || !completed_ || patching_) {
      return;
    }
    patching_ = true;
    if (status_.error_code != net::OK) {
      client_->OnComplete(status_);
      Done();
      return;
    }
    const Pack& p = GetPack();
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::TaskPriority::USER_BLOCKING},
        base::BindOnce(&PatchManifest, std::move(body_), p.size, p.m),
        base::BindOnce(&ManifestLoader::Send, weak_.GetWeakPtr()));
  }

  void OnSiteGone() {
    if (completed_) {
      return;
    }
    client_->OnComplete(network::URLLoaderCompletionStatus(net::ERR_FAILED));
    Done();
  }

  void Send(Patched out) {
    if (out.ok) {
      Served() = out.served;
      g_patched = true;
    }
    for (const char* h : {"content-length", "content-encoding", "etag"}) {
      head_->headers->RemoveHeader(h);
    }
    head_->headers->AddHeader("Content-Length", base::NumberToString(out.body.size()));
    head_->content_length = static_cast<int64_t>(out.body.size());
    sender_.Send(std::move(head_), std::move(out.body), base::BindOnce(&ManifestLoader::Done, base::Unretained(this)));
  }

  void Done() { delete this; }

  mojo::Receiver<network::mojom::URLLoader> receiver_;
  mojo::Remote<network::mojom::URLLoaderClient> client_;
  BodySender sender_;
  mojo::Remote<network::mojom::URLLoader> target_;
  mojo::Receiver<network::mojom::URLLoaderClient> client_receiver_{this};
  network::mojom::URLResponseHeadPtr head_;
  std::unique_ptr<mojo::DataPipeDrainer> drainer_;
  std::string body_;
  network::URLLoaderCompletionStatus status_;
  bool drained_ = false;
  bool completed_ = false;
  bool patching_ = false;
  base::WeakPtrFactory<ManifestLoader> weak_{this};
};

// Fábrica intermediária, só para páginas e workers do site do NFSU2.
class Factory : public network::mojom::URLLoaderFactory {
 public:
  Factory(mojo::PendingReceiver<network::mojom::URLLoaderFactory> receiver,
          mojo::PendingRemote<network::mojom::URLLoaderFactory> target)
      : target_(std::move(target)) {
    receivers_.Add(this, std::move(receiver));
    receivers_.set_disconnect_handler(base::BindRepeating(&Factory::OnDisconnect, base::Unretained(this)));
    target_.set_disconnect_handler(base::BindOnce(&Factory::Done, base::Unretained(this)));
  }

  void CreateLoaderAndStart(mojo::PendingReceiver<network::mojom::URLLoader> loader,
                            int32_t request_id,
                            uint32_t options,
                            const network::ResourceRequest& request,
                            mojo::PendingRemote<network::mojom::URLLoaderClient> client,
                            const net::MutableNetworkTrafficAnnotationTag& annotation) override {
    const GURL& url = request.url;
    if (request.method == "GET" && IsGameUrl(url)) {
      const std::string path(url.path());
      if (path == "/data-manifest") {
        (new ManifestLoader(std::move(loader), std::move(client)))
            ->Start(target_.get(), request_id, options, request, annotation);
        return;
      }
      if (MaybeServe(request, path, loader, client)) {
        return;
      }
    }
    target_->CreateLoaderAndStart(std::move(loader), request_id, options, request, std::move(client), annotation);
  }

  void Clone(mojo::PendingReceiver<network::mojom::URLLoaderFactory> receiver) override {
    receivers_.Add(this, std::move(receiver));
  }

 private:
  // Pedido do pacote (com a lista já trocada): entrega do APK. false = segue para o site.
  bool MaybeServe(const network::ResourceRequest& request,
                  const std::string& path,
                  mojo::PendingReceiver<network::mojom::URLLoader>& loader,
                  mojo::PendingRemote<network::mojom::URLLoaderClient>& client) {
    if (!g_patched) {
      return false;
    }
    std::string rest;
    bool blocks = false;
    if (base::StartsWith(path, "/data-blocks/")) {
      size_t slash = path.find('/', 13);
      if (slash == std::string::npos) {
        return false;
      }
      rest = path.substr(slash + 1);
      blocks = true;
    } else if (base::StartsWith(path, "/data/")) {
      rest = path.substr(6);
    } else {
      return false;
    }
    if (base::UnescapeBinaryURLComponent(rest) != Served()) {
      return false;
    }
    const Pack& p = GetPack();
    int64_t start = 0;
    int64_t end = p.size;
    int code = 200;
    std::string range;
    if (blocks) {
      std::string b, n, m, s;
      int64_t bi = 0, ni = 0, mi = 0, si = 0;
      if (!net::GetValueForKeyInQuery(request.url, "b", &b) || !net::GetValueForKeyInQuery(request.url, "n", &n) ||
          !net::GetValueForKeyInQuery(request.url, "m", &m) || !net::GetValueForKeyInQuery(request.url, "s", &s) ||
          !base::StringToInt64(b, &bi) || !base::StringToInt64(n, &ni) || !base::StringToInt64(m, &mi) ||
          !base::StringToInt64(s, &si)) {
        return false;
      }
      if (mi != p.m || si != p.size) {
        return false;  // lista antiga: é o arquivo do site
      }
      if (bi < 0 || ni < 1 || ni > 64 || bi * kBlock >= p.size) {
        (new FileLoader(std::move(loader), std::move(client)))->Start(400, 0, 0, std::string());
        return true;
      }
      start = bi * kBlock;
      end = std::min(p.size, (bi + ni) * kBlock);
    } else {
      std::optional<std::string> header = request.headers.GetHeader(net::HttpRequestHeaders::kRange);
      if (header) {
        std::vector<net::HttpByteRange> ranges;
        if (!net::HttpUtil::ParseRangeHeader(*header, &ranges) || ranges.size() != 1 ||
            !ranges[0].ComputeBounds(p.size)) {
          (new FileLoader(std::move(loader), std::move(client)))->Start(416, 0, 0, std::string());
          return true;
        }
        start = ranges[0].first_byte_position();
        end = ranges[0].last_byte_position() + 1;
        code = 206;
        range = "bytes " + base::NumberToString(start) + "-" + base::NumberToString(end - 1) + "/" +
                base::NumberToString(p.size);
      }
    }
    (new FileLoader(std::move(loader), std::move(client)))->Start(code, start, end, std::move(range));
    return true;
  }

  void OnDisconnect() {
    if (receivers_.empty()) {
      Done();
    }
  }
  void Done() { delete this; }

  mojo::ReceiverSet<network::mojom::URLLoaderFactory> receivers_;
  mojo::Remote<network::mojom::URLLoaderFactory> target_;
};

}  // namespace nfs_tex
// ───────────────── fim: texturas HD do NFSU2 ─────────────────

