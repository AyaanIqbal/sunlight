import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, Loader2, RotateCcw, Power } from "lucide-react";
import type { ConnectionStatus } from "../types";
import { connectLamp, disconnectLamp, getConnectionStatus, reconnectLamp } from "../lampApi";

interface ConnectionPanelProps {
  status: ConnectionStatus;
  onStatusChange: (status: ConnectionStatus) => void;
  error: string | null;
  onError: (e: string | null) => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  disconnected: "Disconnected",
  scanning: "Scanning…",
  connecting: "Connecting…",
  connected: "Connected",
  failed: "Connection failed",
};

const STATUS_COLOR: Record<ConnectionStatus, string> = {
  disconnected: "text-[#9090a0]",
  scanning: "text-[#facc15]",
  connecting: "text-[#facc15]",
  connected: "text-[#4ade80]",
  failed: "text-[#f87171]",
};

const POLL_MS = 2000;

export function ConnectionPanel({
  status,
  onStatusChange,
  error,
  onError,
}: ConnectionPanelProps) {
  const [busy, setBusy] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollerRef.current = setInterval(async () => {
      try {
        const s = await getConnectionStatus();
        onStatusChange(s);
      } catch {
        // ignore poll errors
      }
    }, POLL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [onStatusChange]);

  const handleConnect = async () => {
    setBusy(true);
    onError(null);
    onStatusChange("scanning");
    try {
      await connectLamp();
      onStatusChange("connected");
    } catch (e: unknown) {
      onStatusChange("failed");
      onError(typeof e === "string" ? e : "Could not connect to SSL-99A4C3. Make sure the lamp is on and the iStrip app is closed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectLamp();
      onStatusChange("disconnected");
      onError(null);
    } catch {
      onError("Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const handleReconnect = async () => {
    setBusy(true);
    onError(null);
    onStatusChange("connecting");
    try {
      await reconnectLamp();
      onStatusChange("connected");
    } catch (e: unknown) {
      onStatusChange("failed");
      onError(typeof e === "string" ? e : "Reconnect failed. Close the iStrip app and try again.");
    } finally {
      setBusy(false);
    }
  };

  const isConnected = status === "connected";
  const isAnimating = status === "scanning" || status === "connecting";

  return (
    <div className="rounded-xl border border-[#2e2e38] bg-[#18181c] p-4">
      <div className="flex items-center gap-2 min-w-0">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isAnimating ? (
            <Loader2 size={14} className="text-[#facc15] animate-spin" />
          ) : isConnected ? (
            <Wifi size={14} className="text-[#4ade80]" />
          ) : (
            <WifiOff size={14} className="text-[#9090a0]" />
          )}
        </div>

        {/* Status label */}
        <span className={`text-xs font-semibold flex-shrink-0 ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status]}
        </span>

        <div className="flex-1" />

        {/* Action buttons — always right-aligned, never overflow */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {(status === "failed" || status === "disconnected") && (
            <button
              onClick={handleConnect}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-[#ff8040]/15 px-2.5 py-1 text-xs font-medium text-[#ff8040] hover:bg-[#ff8040]/25 disabled:opacity-50 transition-colors"
            >
              <Power size={11} />
              Connect
            </button>
          )}
          {isConnected && (
            <>
              <button
                onClick={handleReconnect}
                disabled={busy}
                title="Reconnect"
                className="flex items-center rounded-lg px-2 py-1 text-xs font-medium text-[#9090a0] hover:bg-[#2e2e38] disabled:opacity-50 transition-colors"
              >
                <RotateCcw size={11} />
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-medium text-[#f87171] hover:bg-red-500/25 disabled:opacity-50 transition-colors"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-[#f87171] leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
