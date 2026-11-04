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
  private fistHoldCounts: number[] = [0, 0];

  public mouthThreshold: number = 0.14;
  public pinchThreshold: number = 0.040;

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

        // Invariant: The mouth MUST physically separate/open to blow steam.
        // Closed lips in resting position have verticalOpenness < 0.035.
        const isMouthOpen = verticalOpenness > 0.040;

        // Detection triggers:
        // Case A: Whistle / Small "O" posture (puckered lips with circular opening)
        const isPuckeredO = isMouthOpen && (
          (blendshapePucker > 0.45 || blendshapeFunnel > 0.40) ||
          (circularity > 0.50 && normalizedMouthWidth < 0.82 && verticalOpenness > 0.048)
        );

        // Case B: Wide open mouth "HA" posture (breathing out warm air onto glass)
        const isWideOpen = isMouthOpen && (verticalOpenness > 0.14 || blendshapeJawOpen > 0.38);

        const isBlowing = isPuckeredO || isWideOpen;

        // Calculate combined intensity (strictly 0 if mouth is closed)
        let opennessRatio = 0;
        if (isPuckeredO) {
          opennessRatio = Math.max(blendshapePucker, blendshapeFunnel, Math.min(1, (verticalOpenness - 0.04) / 0.14));
        } else if (isWideOpen) {
          opennessRatio = Math.min(1, Math.max(0, (verticalOpenness - 0.07) / 0.18));
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
          // Tuned: minCutOff=1.2 (zero jitter when still), beta=0.5 (high-speed pencil responsiveness, zero lag)
          if (!this.handFilters[handIdx]) {
            this.handFilters[handIdx] = Array.from({ length: 21 }, () => ({
              x: new OneEuroFilter(60, 1.2, 0.5),
              y: new OneEuroFilter(60, 1.2, 0.5)
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

          // 3D Euclidean distance helper
          const dist3D = (p1: { x: number; y: number; z?: number }, p2: { x: number; y: number; z?: number }) => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dz = (p1.z ?? 0) - (p2.z ?? 0);
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
          };

          const handScale = dist3D(wrist, indexMcp) || 0.1;

          // 1. PINCH DETECTION (AIR PENCIL)
          // Immediate pen-down on contact, immediate pen-up on liftoff to allow writing individual letters
          const pinchDist = dist3D(indexTip, thumbTip);

          const wasPinching = this.prevPinchingState[handIdx] ?? false;
          const onThreshold = this.pinchThreshold; // 0.040 for true fingertip contact
          const offThreshold = this.pinchThreshold * 1.25; // 0.050: lifts immediately upon finger release

          const isPinching = wasPinching
            ? pinchDist < offThreshold
            : pinchDist < onThreshold;
          this.prevPinchingState[handIdx] = isPinching;

          // 2. CLOSED FIST DETECTION (BROAD SQUEEGEE ERASER)
          // Perspective-invariant 3D geometry:
          // In a fist, all 4 fingers (index, middle, ring, pinky) are curled tightly into the palm.
          // We calculate the 3D chord-to-arc ratio: dist3D(tip, mcp) / totalBoneLength.
          // An open hand pointing at the camera has ratio > 0.80 (straight bones in 3D).
          // A closed fist has ratio < 0.58 (bones looped back into palm).
          let isFist = false;
          if (isPinching) {
            this.fistHoldCounts[handIdx] = 0;
            this.prevFistState[handIdx] = false;
          } else {
            const fingers3D = [
              [5, 6, 7, 8],     // index: MCP, PIP, DIP, TIP
              [9, 10, 11, 12],  // middle
              [13, 14, 15, 16], // ring
              [17, 18, 19, 20], // pinky
            ] as const;

            const curlRatios3D = fingers3D.map(([mcpIdx, pipIdx, dipIdx, tipIdx]) => {
              const mcp = landmarks[mcpIdx];
              const pip = landmarks[pipIdx];
              const dip = landmarks[dipIdx];
              const tip = landmarks[tipIdx];
              const boneArc = dist3D(mcp, pip) + dist3D(pip, dip) + dist3D(dip, tip);
              if (boneArc < 0.01) return 1.0;
              return dist3D(tip, mcp) / boneArc;
            });

            // In a closed fist, all 4 fingers are curled tight into the palm
            const allFingersCurled = curlRatios3D.every(r => r < 0.58);

            // In a closed fist, all 4 fingertips are drawn close to the palm/wrist in 3D
            const tipsNearPalm = [8, 12, 16, 20].every(tipIdx => dist3D(landmarks[tipIdx], wrist) < handScale * 1.35);

            // In a fist, thumb is folded against the fingers rather than extended wide
            const thumbFolded = dist3D(thumbTip, indexMcp) < handScale * 0.90;

            // Frame edge gating: hand must be inside camera view (not entering/exiting frame edge)
            const isFullyInFrame = wrist.x > 0.06 && wrist.x < 0.94 && wrist.y > 0.06 && wrist.y < 0.94;

            const isCandidateFist = isFullyInFrame &&
                                    allFingersCurled &&
                                    tipsNearPalm &&
                                    thumbFolded &&
                                    pinchDist > 0.050;

            // Require 3 consecutive confirmed frames to activate squeegee eraser (prevents frame-entry blips)
            if (isCandidateFist) {
              this.fistHoldCounts[handIdx] = Math.min(5, this.fistHoldCounts[handIdx] + 1);
            } else {
              this.fistHoldCounts[handIdx] = Math.max(0, this.fistHoldCounts[handIdx] - 1);
            }

            isFist = this.fistHoldCounts[handIdx] >= 3;
            this.prevFistState[handIdx] = isFist;
          }

          // Pointer position:
          // For air pencil writing, the index fingertip IS the pencil lead.
          // Keeping coordinate locked to indexTip gives zero jump between hover and drawing,
          // allowing 100% natural and precise handwriting in air.
          let targetX = indexTip.x;
          let targetY = indexTip.y;

          if (isFist) {
            // Squeegee eraser centers on knuckle palm pad
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
