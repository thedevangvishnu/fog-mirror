/**
 * Vision Engine for Fog Mirror
 * Powered by MediaPipe Tasks Vision (FaceLandmarker + HandLandmarker)
 * Extracts:
 * 1. Normalized mouth openness ratio (for breath condensation)
 * 2. Mirrored 2D coordinates for mouth center
 * 3. Mirrored 2D coordinates for index fingertips and pinch state (for glass wiping)
 */

import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker
} from '@mediapipe/tasks-vision';

export interface BreathDetectionResult {
  isBlowing: boolean;
  opennessRatio: number; // 0.0 to 1.0
  mouthCenter: { x: number; y: number } | null;
}

export interface HandPointer {
  x: number;
  y: number;
  isPinching: boolean;
  pinchDistance: number;
}

export class VisionEngine {
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private isReady: boolean = false;
  private lastVideoTime: number = -1;

  public mouthThreshold: number = 0.16; // default sensitivity

  async init(onProgress?: (status: string) => void): Promise<void> {
    onProgress?.('Loading Vision WebAssembly...');
    const vision = await FilesetResolver.forVisionTasks('/wasm');

    onProgress?.('Initializing Face Mesh Landmarker...');
    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    onProgress?.('Initializing Hand Landmarker...');
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.isReady = true;
    onProgress?.('Vision models ready.');
  }

  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Process a video frame and extract both breath status and wiping pointers.
   */
  processFrame(video: HTMLVideoElement): {
    breath: BreathDetectionResult;
    pointers: HandPointer[];
  } {
    if (!this.isReady || !this.faceLandmarker || !this.handLandmarker) {
      return {
        breath: { isBlowing: false, opennessRatio: 0, mouthCenter: null },
        pointers: []
      };
    }

    if (video.currentTime === this.lastVideoTime) {
      return {
        breath: { isBlowing: false, opennessRatio: 0, mouthCenter: null },
        pointers: []
      };
    }
    this.lastVideoTime = video.currentTime;
    const nowMs = performance.now();

    // 1. Face landmarks for breath
    let breath: BreathDetectionResult = { isBlowing: false, opennessRatio: 0, mouthCenter: null };
    try {
      const faceResults = this.faceLandmarker.detectForVideo(video, nowMs);
      if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
        const landmarks = faceResults.faceLandmarks[0];

        // Key landmarks:
        // 13: Inner upper lip
        // 14: Inner lower lip
        // 10: Forehead top
        // 152: Chin bottom
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const forehead = landmarks[10];
        const chin = landmarks[152];

        const mouthDist = Math.hypot(topLip.x - bottomLip.x, topLip.y - bottomLip.y);
        const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y);

        const openness = faceHeight > 0.05 ? mouthDist / faceHeight : 0;
        const normalizedOpenness = Math.max(0, Math.min(1, (openness - 0.06) / 0.22));

        // Mirrored coordinate so it lines up with mirrored video view
        const mouthX = (1 - (topLip.x + bottomLip.x) * 0.5);
        const mouthY = (topLip.y + bottomLip.y) * 0.5;

        breath = {
          isBlowing: openness > this.mouthThreshold,
          opennessRatio: normalizedOpenness,
          mouthCenter: { x: mouthX, y: mouthY }
        };
      }
    } catch (err) {
      // Frame skip protection
    }

    // 2. Hand landmarks for wiping
    const pointers: HandPointer[] = [];
    try {
      const handResults = this.handLandmarker.detectForVideo(video, nowMs);
      if (handResults.landmarks && handResults.landmarks.length > 0) {
        for (const landmarks of handResults.landmarks) {
          // Landmark 8: Index finger tip
          // Landmark 4: Thumb tip
          const indexTip = landmarks[8];
          const thumbTip = landmarks[4];

          // Mirrored coordinate
          const x = 1 - indexTip.x;
          const y = indexTip.y;

          const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
          const isPinching = pinchDist < 0.09;

          pointers.push({
            x,
            y,
            isPinching,
            pinchDistance: pinchDist
          });
        }
      }
    } catch (err) {
      // Frame skip protection
    }

    return { breath, pointers };
  }
}
