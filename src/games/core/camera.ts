import type { CameraApi, FaceInput } from "./types";

/**
 * Camera + on-device face tracking for camera games.
 *
 * Privacy: frames go from the camera to MediaPipe's WASM model running in
 * this tab. Nothing is recorded, stored or uploaded. The model + runtime are
 * fetched once (CDN by default, self-hostable via env).
 *
 * The MediaPipe bundle is dynamically imported, so it is downloaded only when
 * a camera game actually starts tracking.
 */
const WASM_URL = process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_URL || "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  process.env.NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL_URL ||
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Head movement (as a fraction of frame width) that maps to full -1…1 input. */
const HEAD_RANGE_X = 0.18;
const HEAD_RANGE_Y = 0.14;
const SMOOTHING = 0.45;

export type TrackerStatus = "idle" | "loading" | "ready" | "failed";

type Landmarker = {
  detectForVideo: (v: HTMLVideoElement, t: number) => {
    faceLandmarks?: Array<Array<{ x: number; y: number }>>;
    faceBlendshapes?: Array<{ categories: Array<{ categoryName: string; score: number }> }>;
  };
  close: () => void;
};

export class CameraService implements CameraApi {
  readonly video: HTMLVideoElement;
  status: TrackerStatus = "idle";
  private stream: MediaStream;
  private landmarker: Landmarker | null = null;
  private raf = 0;
  private lastVideoTime = -1;
  private face: FaceInput = { x: 0, y: 0, mouthOpen: 0, blink: 0, present: false };
  private centre = { x: 0.5, y: 0.5, calibrated: false };
  private stopped = false;

  private constructor(stream: MediaStream) {
    this.stream = stream;
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.srcObject = stream;
    this.video.setAttribute("aria-label", "Your camera preview (processed on this device only)");
  }

  /** Prompts for permission. Throws DOMException (NotAllowedError…) when denied. */
  static async request(): Promise<CameraService> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera not supported on this browser");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    const svc = new CameraService(stream);
    await svc.video.play().catch(() => {});
    return svc;
  }

  get active() {
    return !this.stopped && this.status === "ready";
  }

  readFace(): FaceInput {
    return this.face;
  }

  /** Re-centre "neutral" on the current head position. */
  calibrate() {
    this.centre.calibrated = false;
  }

  async startTracking(onStatus?: (s: TrackerStatus) => void) {
    if (this.status === "loading" || this.status === "ready") return;
    this.status = "loading";
    onStatus?.(this.status);
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      })) as unknown as Landmarker;
      if (this.stopped) return;
      this.status = "ready";
      onStatus?.(this.status);
      this.loop();
    } catch (e) {
      console.warn("[camera] face tracking unavailable", e);
      this.status = "failed";
      onStatus?.(this.status);
    }
  }

  private loop = () => {
    if (this.stopped || !this.landmarker) return;
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const res = this.landmarker.detectForVideo(v, performance.now());
    const lm = res.faceLandmarks?.[0];
    if (!lm) {
      this.face = { ...this.face, present: false };
      return;
    }
    // Landmark 1 ≈ nose tip. Mirror x so moving your head right moves the player right.
    const nose = lm[1];
    if (!this.centre.calibrated) {
      this.centre = { x: nose.x, y: nose.y, calibrated: true };
    }
    const rawX = Math.max(-1, Math.min(1, (this.centre.x - nose.x) / HEAD_RANGE_X));
    const rawY = Math.max(-1, Math.min(1, (nose.y - this.centre.y) / HEAD_RANGE_Y));
    const shapes = res.faceBlendshapes?.[0]?.categories ?? [];
    const get = (n: string) => shapes.find((c) => c.categoryName === n)?.score ?? 0;
    this.face = {
      x: this.face.x + (rawX - this.face.x) * SMOOTHING,
      y: this.face.y + (rawY - this.face.y) * SMOOTHING,
      mouthOpen: get("jawOpen"),
      blink: Math.max(get("eyeBlinkLeft"), get("eyeBlinkRight")),
      present: true,
    };
  };

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.stream.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.video.remove();
    try {
      this.landmarker?.close();
    } catch {
      /* ignore */
    }
    this.landmarker = null;
  }
}
