"use client";

import type { GameSummary } from "@/games/registry";
import type { CameraService } from "@/games/core/camera";
import type { MicService } from "@/games/core/mic";
import { Button } from "@/components/ui/Button";

export type PermissionState =
  | { kind: "none" }
  | { kind: "camera" | "mic"; status: "explain" | "requesting" | "denied" | "unsupported" };

/**
 * Explains WHY we need the camera / mic before the browser prompt appears,
 * requests it only on an explicit tap, and always offers a touch fallback.
 * The device services are lazily imported here — never on the homepage.
 */
export function PermissionGate({
  game,
  perm,
  setPerm,
  onResolved,
  onCancel,
}: {
  game: GameSummary;
  perm: Exclude<PermissionState, { kind: "none" }>;
  setPerm: (p: PermissionState) => void;
  onResolved: (o: { camera?: CameraService; mic?: MicService; denied?: boolean }) => void;
  onCancel: () => void;
}) {
  const isCam = perm.kind === "camera";
  const request = async () => {
    setPerm({ kind: perm.kind, status: "requesting" });
    try {
      if (isCam) {
        const { CameraService } = await import("@/games/core/camera");
        onResolved({ camera: await CameraService.request() });
      } else {
        const { MicService } = await import("@/games/core/mic");
        onResolved({ mic: await MicService.request() });
      }
    } catch (e) {
      const name = (e as DOMException)?.name;
      setPerm({ kind: perm.kind, status: name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported" });
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 px-6 text-center backdrop-blur" role="dialog" aria-label={isCam ? "Camera permission" : "Microphone permission"}>
      <div className="mb-4 grid h-20 w-20 place-items-center rounded-[28px] bg-white/10 text-4xl">{isCam ? "📸" : "🎤"}</div>
      {perm.status === "denied" || perm.status === "unsupported" ? (
        <>
          <h2 className="font-display text-2xl font-black uppercase text-white">{isCam ? "Camera" : "Mic"} {perm.status === "denied" ? "blocked" : "unavailable"}</h2>
          <p className="mt-2 max-w-xs text-sm text-white/75">
            {perm.status === "denied"
              ? `No problem. You can allow it later in your browser's site settings.`
              : `This browser can't use the ${isCam ? "camera" : "microphone"}.`}{" "}
            Play with touch controls instead — scores still count.
          </p>
          <div className="mt-6 flex w-64 flex-col gap-2">
            <Button size="lg" onClick={() => onResolved({ denied: true })}>
              👆 Play with touch
            </Button>
            {perm.status === "denied" && (
              <Button size="md" variant="secondary" onClick={request}>
                Try again
              </Button>
            )}
            <Button size="md" variant="ghost" onClick={onCancel}>
              Back
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl font-black uppercase text-white">{isCam ? "Use your face" : "Use your voice"}</h2>
          <p className="mt-2 max-w-xs text-sm text-white/80">
            {isCam
              ? `${game.name} tracks your head movement to control the game.`
              : `${game.name} listens to your pitch / volume to control the game.`}
          </p>
          <ul className="mt-4 space-y-1.5 text-left text-xs text-white/70">
            <li>🔒 Processed live on your device</li>
            <li>🚫 Never recorded, stored or uploaded</li>
            <li>⏹ Stop anytime with the “Stop {isCam ? "camera" : "mic"}” button</li>
          </ul>
          <div className="mt-6 flex w-64 flex-col gap-2">
            <Button size="lg" onClick={request} disabled={perm.status === "requesting"}>
              {perm.status === "requesting" ? "Waiting for permission…" : `Allow ${isCam ? "camera" : "microphone"}`}
            </Button>
            <Button size="md" variant="secondary" onClick={() => onResolved({ denied: true })}>
              Play with touch instead
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
