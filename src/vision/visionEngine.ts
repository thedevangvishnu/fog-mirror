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
import { OneEuroFilter } from './oneEuroFilter';

export interface BreathDetectionResult {
  isBlowing: boolean;
  opennessRatio: number; // 0.0 to 1.0
  mouthCenter: { x: number; y: number } | null;
}

export interface HandPointer {
  x: number;
  y: number;
  isPinching: boolean;
  isFist: boolean;
  pinchDistance: number;
}

interface LandmarkFilterPair {
  x: OneEuroFilter;
  y: OneEuroFilter;
}

export class VisionEngine {
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private isReady: boolean = false;
  private lastVideoTime: number = -1;

  // Smoothing filters: 21 landmarks per hand, 2 hands
  private handFilters: LandmarkFilterPair[][] = [];
  private prevPinchingState: boolean[] = [false, false];
  private prevFistState: boolean[] = [false, false];

  public mouthThreshold: number = 0.14;
  public pinchThreshold: number = 0.075;

  async init(onProgress?: (status: string) => void): Promise<void> {
    onProgress?.('Loading Vision WebAssembly...');
    const vision = await FilesetResolver.forVisionTasks('/wasm');

    onProgress?.('Initializing Face Mesh Landmarker...');
    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/face_landmarker.task',
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
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
        // 13: Inner upper lip, 14: Inner lower lip
        // 61: Left lip corner, 291: Right lip corner
        // 10: Forehead top, 152: Chin bottom
        // 33: Left eye inner, 263: Right eye inner
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        const mouthHeight = Math.hypot(topLip.x - bottomLip.x, topLip.y - bottomLip.y);
        const mouthWidth = Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y);
        const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y);
        const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);

        // Normalized metrics
        const verticalOpenness = faceHeight > 0.05 ? mouthHeight / faceHeight : 0;
        const normalizedMouthWidth = eyeDist > 0.05 ? mouthWidth / eyeDist : 1;

        // Circularity / Pucker ratio: as you make an "O", mouth narrows horizontally
        const circularity = mouthWidth > 0.01 ? mouthHeight / mouthWidth : 0;

        // Check MediaPipe blendshapes if available
        let blendshapePucker = 0;
        let blendshapeFunnel = 0;
        let blendshapeJawOpen = 0;

        if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
          const categories = faceResults.faceBlendshapes[0].categories;
          for (const cat of categories) {
            if (cat.categoryName === 'mouthPucker') blendshapePucker = cat.score;
            if (cat.categoryName === 'mouthFunnel') blendshapeFunnel = cat.score;
            if (cat.categoryName === 'jawOpen') blendshapeJawOpen = cat.score;
          }
        }

        // Detection triggers:
        // Case A: Whistle / Small "O" posture (puckered lips with circular opening)
        const isPuckeredO = (circularity > 0.42 && normalizedMouthWidth < 0.85 && mouthHeight > 0.012) ||
                            (blendshapePucker > 0.35 || blendshapeFunnel > 0.32);

        // Case B: Wide open mouth "HA" posture
        const isWideOpen = verticalOpenness > 0.16 || blendshapeJawOpen > 0.35;

        const isBlowing = isPuckeredO || isWideOpen;

        // Calculate combined intensity
        let opennessRatio = 0;
        if (isPuckeredO) {
          opennessRatio = Math.max(blendshapePucker, blendshapeFunnel, Math.min(1, circularity * 0.9));
        } else if (isWideOpen) {
          opennessRatio = Math.min(1, Math.max(0, (verticalOpenness - 0.08) / 0.18));
        }

        // Mirrored coordinate so it lines up with mirrored video view
        const mouthX = (1 - (topLip.x + bottomLip.x) * 0.5);
        const mouthY = (topLip.y + bottomLip.y) * 0.5;

        breath = {
          isBlowing,
          opennessRatio,
          mouthCenter: { x: mouthX, y: mouthY }
        };
      }
    } catch (err) {
      // Frame skip protection
    }

    // 2. Hand landmarks for intentional wiping (Pinch or Fist)
    const pointers: HandPointer[] = [];
    try {
      const handResults = this.handLandmarker.detectForVideo(video, nowMs);
      const detectedCount = handResults.landmarks ? handResults.landmarks.length : 0;

      // Reset filters for lost hands
      for (let h = detectedCount; h < this.handFilters.length; h++) {
        if (this.handFilters[h]) {
          this.handFilters[h].forEach(f => {
            f.x.reset();
            f.y.reset();
          });
        }
        this.prevPinchingState[h] = false;
        this.prevFistState[h] = false;
      }

      if (detectedCount > 0 && handResults.landmarks) {
        for (let handIdx = 0; handIdx < handResults.landmarks.length; handIdx++) {
          const rawLandmarks = handResults.landmarks[handIdx];

          // Initialize OneEuroFilter bank for this hand if needed
          if (!this.handFilters[handIdx]) {
            this.handFilters[handIdx] = Array.from({ length: 21 }, () => ({
              x: new OneEuroFilter(60, 0.9, 0.05),
              y: new OneEuroFilter(60, 0.9, 0.05)
            }));
          }

          // Smooth each landmark coordinate
          const filters = this.handFilters[handIdx];
          const landmarks = rawLandmarks.map((pt, i) => ({
            x: filters[i].x.filter(pt.x, nowMs),
            y: filters[i].y.filter(pt.y, nowMs),
            z: pt.z
          }));

          const wrist = landmarks[0];
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];

          // Knuckle joints
          const indexMcp = landmarks[5];
          const pinkyMcp = landmarks[17];

          // 1. Closed Fist detection — per-finger curl ratio (scale-invariant) with hysteresis
          const fingersCurledRatios = ([
            [5, 8],   // index  MCP → tip
            [9, 12],  // middle MCP → tip
            [13, 16], // ring   MCP → tip
            [17, 20], // pinky  MCP → tip
          ] as [number, number][]).map(([mcpIdx, tipIdx]) => {
            const mcp = landmarks[mcpIdx];
            const tip = landmarks[tipIdx];
            const tipToMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
            const mcpToWrist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
            if (mcpToWrist < 0.01) return 1.0;
            return tipToMcp / mcpToWrist;
          });

          const wasFist = this.prevFistState[handIdx] ?? false;
          // Fist hysteresis: enter at < 0.80, exit when any finger extends > 0.95
          let isFist = false;
          if (wasFist) {
            isFist = fingersCurledRatios.every(r => r < 0.95);
          } else {
            isFist = fingersCurledRatios.every(r => r < 0.80);
          }
          this.prevFistState[handIdx] = isFist;

          // 2. Pinch detection — 2D XY distance with hysteresis
          const pinchDist = Math.hypot(
            indexTip.x - thumbTip.x,
            indexTip.y - thumbTip.y
          );

          const wasPinching = this.prevPinchingState[handIdx] ?? false;
          const onThreshold = this.pinchThreshold; // e.g. 0.075
          const offThreshold = this.pinchThreshold * 1.35; // e.g. 0.10

          let isPinching = false;
          if (!isFist) {
            // Cannot pinch if all fingers are curled into a fist
            if (wasPinching) {
              isPinching = pinchDist < offThreshold;
            } else {
              isPinching = pinchDist < onThreshold;
            }
          }
          this.prevPinchingState[handIdx] = isPinching;

          // Pointer position: pinch midpoint if pinching, palm center if fist, else index tip for hover
          let targetX = indexTip.x;
          let targetY = indexTip.y;

          if (isPinching) {
            targetX = (indexTip.x + thumbTip.x) * 0.5;
            targetY = (indexTip.y + thumbTip.y) * 0.5;
          } else if (isFist) {
            targetX = (indexMcp.x + pinkyMcp.x) * 0.5;
            targetY = (indexMcp.y + pinkyMcp.y) * 0.5;
          }

          pointers.push({
            x: 1 - targetX, // Mirrored
            y: targetY,
            isPinching,
            isFist,
            pinchDistance: pinchDist
          });
        }
      }
    } catch {
      // Frame skip protection
    }

    return { breath, pointers };
  }
}
