import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BrowserMultiFormatReader } from "@zxing/library";
import {
  Camera, CheckCircle2, Keyboard, Loader2, QrCode,
  ScanLine, Volume2, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ScanResult = {
  type: "success" | "error" | "found";
  message: string;
  equipment?: {
    id: number;
    name: string;
    category: string | null;
    brand: string | null;
    model: string | null;
  };
};

type ActionType = "checkout" | "checkin";

// Feedback sonoro para scan rápido
function playBeep(success: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 300;
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.15 : 0.3));
  } catch {
    // Silenciosamente ignora se AudioContext não disponível
  }
}

export default function Scanner() {
  const { isAuthenticated } = useAuth();
  const [action, setAction] = useState<ActionType>("checkout");
  const [project, setProject] = useState("");
  const [hidInput, setHidInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"hid" | "camera">("hid");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hidInputRef = useRef<HTMLInputElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCooldownRef = useRef(false);
  // Worker OCR reutilizável — criado uma vez, usado muitas vezes
  const ocrWorkerRef = useRef<any>(null);

  const scanRegister = trpc.usage.scanRegister.useMutation();

  const focusHid = useCallback(() => {
    setTimeout(() => hidInputRef.current?.focus(), 100);
  }, []);

  // ── Processamento central de código ─────────────────────────────────────
  const processCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!isAuthenticated) {
        toast.error("Faca login para registrar.");
        return false;
      }
      setScanResult({ type: "found", message: `Codigo lido: ${code}` });
      try {
        const result = await scanRegister.mutateAsync({
          code,
          action,
          project: project || undefined,
        });
        setScanResult({
          type: "success",
          message: `${action === "checkout" ? "Retirada" : "Devolucao"} registrada!`,
          equipment: result.equipment as ScanResult["equipment"],
        });
        playBeep(true);
        toast.success(
          `${result.equipment.name} — ${action === "checkout" ? "retirada" : "devolucao"} registrada.`
        );
        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Equipamento nao encontrado.";
        setScanResult({ type: "error", message: msg });
        playBeep(false);
        toast.error(msg);
        return false;
      }
    },
    [isAuthenticated, action, project, scanRegister]
  );

  // ── HID: detecta Enter ──────────────────────────────────────────────────
  const handleHidKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && hidInput.trim()) {
        e.preventDefault();
        await processCode(hidInput.trim());
        setHidInput("");
      }
    },
    [hidInput, processCode]
  );

  // ── Câmera: ZXing para código de barras ─────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      reader.decodeFromStream(
        stream,
        videoRef.current!,
        async (result) => {
          if (result && !scanCooldownRef.current) {
            scanCooldownRef.current = true;
            await processCode(result.getText());
            // Cooldown reduzido para 1s — mais rápido para operação em lote
            setTimeout(() => {
              scanCooldownRef.current = false;
            }, 1000);
          }
        }
      );
    } catch {
      setCameraError(
        "Nao foi possivel acessar a camera. Verifique as permissoes."
      );
      setCameraActive(false);
    }
  }, [processCode]);

  const stopCamera = useCallback(() => {
    codeReaderRef.current?.reset();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    codeReaderRef.current = null;
    setCameraActive(false);
    setOcrActive(false);
  }, []);

  // ── OCR: Worker reutilizável ────────────────────────────────────────────
  const initOcrWorker = useCallback(async () => {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("por+eng");
    ocrWorkerRef.current = worker;
    return worker;
  }, []);

  const captureAndOcr = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setOcrProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      // Pre-processamento: converter para escala de cinza e aumentar contraste
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const val = gray > 128 ? 255 : 0; // Binarização
        data[i] = data[i + 1] = data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);

      const worker = await initOcrWorker();
      const {
        data: { text },
      } = await worker.recognize(canvas);

      // Extrai sequências alfanuméricas 4+ chars
      const matches = text.match(/[A-Z0-9\-]{4,}/gi) ?? [];
      const candidates = Array.from(
        new Set(matches.map((m: string) => m.trim()).filter((m: string) => m.length >= 4))
      );

      if (candidates.length === 0) {
        toast.warning(
          "Nenhum codigo identificado. Tente aproximar mais a camera."
        );
        setOcrProcessing(false);
        return;
      }

      // Tenta cada candidato
      for (const candidate of candidates.slice(0, 5)) {
        const found = await processCode(candidate as string);
        if (found) break;
      }
    } catch {
      toast.error("Erro no OCR. Tente novamente com melhor iluminacao.");
    }
    setOcrProcessing(false);
  }, [processCode, initOcrWorker]);

  // Limpa câmera e worker ao desmontar
  useEffect(
    () => () => {
      stopCamera();
      ocrWorkerRef.current?.terminate();
      ocrWorkerRef.current = null;
    },
    [stopCamera]
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ScanLine className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Faca login para usar o scanner.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scanner</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registre retiradas e devolucoes via codigo de barras, camera ou OCR.
        </p>
      </div>

      {/* Acao e Projeto */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de Acao</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAction("checkout")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${action === "checkout" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Retirada
            </button>
            <button
              onClick={() => setAction("checkin")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${action === "checkin" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              Devolucao
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Projeto / Evento{" "}
            <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <input
            placeholder="Ex: Gravacao PAN, Live Show..."
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
      </div>

      {/* Resultado do scan */}
      {scanResult && (
        <div
          className={`rounded-xl border p-3 flex items-start gap-3 ${
            scanResult.type === "success"
              ? "border-green-300 bg-green-50"
              : scanResult.type === "error"
                ? "border-red-300 bg-red-50"
                : "border-blue-300 bg-blue-50"
          }`}
        >
          {scanResult.type === "success" && (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          )}
          {scanResult.type === "error" && (
            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          {scanResult.type === "found" && (
            <Loader2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">{scanResult.message}</p>
            {scanResult.equipment && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {scanResult.equipment.name}
                {scanResult.equipment.brand &&
                  ` · ${scanResult.equipment.brand}`}
                {scanResult.equipment.model &&
                  ` ${scanResult.equipment.model}`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div>
        <div className="flex border-b">
          <button
            onClick={() => {
              setActiveTab("hid");
              stopCamera();
              focusHid();
            }}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "hid" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            <Keyboard className="h-4 w-4" /> Scanner Laser
          </button>
          <button
            onClick={() => setActiveTab("camera")}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "camera" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            <Camera className="h-4 w-4" /> Camera
          </button>
        </div>

        {/* HID tab */}
        {activeTab === "hid" && (
          <div className="rounded-xl border bg-card p-4 mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4" />
              Scanner Laser / Teclado
            </div>
            <p className="text-sm text-muted-foreground">
              Aponte o scanner para o codigo de barras. O registro é automatico.
              Tambem pode digitar manualmente e pressionar{" "}
              <kbd className="px-1.5 py-0.5 rounded border text-xs font-mono">
                Enter
              </kbd>
              .
            </p>
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={hidInputRef}
                autoFocus
                placeholder="Aguardando leitura do scanner..."
                value={hidInput}
                onChange={(e) => setHidInput(e.target.value)}
                onKeyDown={handleHidKeyDown}
                className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background font-mono text-sm"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Campo ativo — scanner HID pronto
            </p>
          </div>
        )}

        {/* Camera tab */}
        {activeTab === "camera" && (
          <div className="rounded-xl border bg-card p-4 mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4" />
              Camera do Dispositivo
            </div>

            {cameraError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {cameraError}
              </div>
            )}

            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                  <Camera className="h-10 w-10" />
                  <p className="text-sm">Camera desligada</p>
                </div>
              )}
              {cameraActive && !ocrActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-16 border-2 border-white/70 rounded-lg" />
                </div>
              )}
              {cameraActive && ocrActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-24 border-2 border-yellow-400/80 rounded-lg bg-yellow-400/10">
                    <p className="absolute -top-6 left-0 right-0 text-center text-xs text-yellow-300">
                      Aponte para o texto do patrimonio/serial
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
                  onClick={startCamera}
                >
                  <Camera className="h-4 w-4" /> Ligar Camera
                </button>
              ) : (
                <>
                  <button
                    className="flex-1 py-2 rounded-lg border text-sm font-medium"
                    onClick={stopCamera}
                  >
                    Desligar
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-lg text-sm font-medium ${ocrActive ? "bg-primary text-primary-foreground" : "border"}`}
                    onClick={() => {
                      if (!ocrActive) initOcrWorker(); // Pre-carregar worker
                      setOcrActive(!ocrActive);
                    }}
                  >
                    OCR
                  </button>
                  {ocrActive && (
                    <button
                      className="py-2 px-4 rounded-lg bg-yellow-500 text-white text-sm font-medium disabled:opacity-50"
                      onClick={captureAndOcr}
                      disabled={ocrProcessing}
                    >
                      {ocrProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Capturar"
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Codigo de barras:</strong> aponte a camera — leitura
                automatica.
              </p>
              <p>
                <strong>OCR:</strong> ative o modo OCR, aponte para o texto e
                toque em Capturar.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Historico recente */}
      <RecentScans />
    </div>
  );
}

function RecentScans() {
  const { data: history } = trpc.usage.myHistory.useQuery(
    { limit: 5 },
    { staleTime: 10_000 }
  );
  if (!history || history.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Ultimos registros
      </h2>
      <div className="space-y-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border bg-card text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{item.equipmentName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.usedAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${item.action === "checkout" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}
            >
              {item.action === "checkout" ? "Retirada" : "Devolucao"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
