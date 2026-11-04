/**
 * Vision Engine for Fog Mirror
 * Powered by MediaPipe Tasks Vision (FaceLandmarker + GestureRecognizer)
 * Extracts:
 * 1. Normalized mouth openness ratio (for breath condensation)
 * 2. Mirrored 2D coordinates for mouth center
 * 3. Mirrored 2D coordinates for index fingertips and pinch state (for glass wiping)
 */

import {
  FilesetResolver,
  FaceLandmarker,
  GestureRecognizer
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
  slot: number;
}

interface PhotoHand {
  slot: number;
  corner: { x: number; y: number };
  thumbX: number;
  indexY: number;
  pinched: boolean;
}

interface LandmarkFilterPair {
  x: OneEuroFilter;
  y: OneEuroFilter;
}

export class VisionEngine {
  private faceLandmarker: FaceLandmarker | null = null;
  private gestureRecognizer: GestureRecognizer | null = null;
  private isReady: boolean = false;
  private lastVideoTime: number = -1;

  private pointerFilters: LandmarkFilterPair[] = Array.from({ length: 2 }, () => ({
    x: new OneEuroFilter(60, 7, 2),
    y: new OneEuroFilter(60, 7, 2)
  }));
  private tools: ('hover' | 'pencil' | 'fist')[] = ['hover', 'hover'];
  private fistSamples = [0, 0];
  private framingSince: number | null = null;
  private armedUntil = 0;
  private photoFrame: PhotoHand['corner'][] = [];
  private shutterLatched = false;

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

    onProgress?.('Initializing Hand Gesture Recognizer...');
    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/models/gesture_recognizer.task',
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
    photoFrame?: PhotoHand['corner'][];
    takePhoto?: boolean;
  } | null {
    if (!this.isReady || !this.faceLandmarker || !this.gestureRecognizer) {
      return {
        breath: { isBlowing: false, opennessRatio: 0, mouthCenter: null },
        pointers: []
      };
    }

    if (video.currentTime === this.lastVideoTime) {
      return null;
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

    const pointers: HandPointer[] = [];
    const photoHands: PhotoHand[] = [];
    try {
      const results = this.gestureRecognizer.recognizeForVideo(video, nowMs);
      const aspect = video.videoWidth / video.videoHeight || 1;

      for (const [index, landmarks] of results.landmarks.entries()) {
        const handedness = results.handedness[index]?.[0]?.categoryName;
        if (handedness !== 'Left' && handedness !== 'Right') continue;
        const slot = handedness === 'Left' ? 0 : 1;
        if (pointers.some(pointer => pointer.slot === slot)) continue;

        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexBase = landmarks[5];
        const indexTip = landmarks[8];
        const middleBase = landmarks[9];
        const pinkyBase = landmarks[17];

        // Compare distances in the same image units and normalize by palm size.
        const palmLength = Math.hypot((middleBase.x - wrist.x) * aspect, middleBase.y - wrist.y);
        const palmWidth = Math.hypot((pinkyBase.x - indexBase.x) * aspect, pinkyBase.y - indexBase.y);
        const palmScale = Math.max(palmLength, palmWidth, 0.025);
        const pinchGap = Math.hypot((indexTip.x - thumbTip.x) * aspect, indexTip.y - thumbTip.y) / palmScale;
        const inFrame = landmarks.every(point =>
          point.x > 0.01 && point.x < 0.99 && point.y > 0.01 && point.y < 0.99
        );

        if (inFrame) {
          const thumbX = (thumbTip.x - indexBase.x) * aspect / palmScale;
          const thumbY = (thumbTip.y - indexBase.y) / palmScale;
          const indexX = (indexTip.x - indexBase.x) * aspect / palmScale;
          const indexY = (indexTip.y - indexBase.y) / palmScale;
          const isL = Math.abs(thumbX) > 0.35 && Math.abs(thumbX) > Math.abs(thumbY) &&
            Math.abs(indexY) > 0.45 && Math.abs(indexY) > Math.abs(indexX);
          photoHands.push({
            slot,
            corner: { x: 1 - indexBase.x, y: thumbTip.y },
            thumbX: isL ? -thumbX : 0,
            indexY: isL ? indexY : 0,
            pinched: pinchGap < 0.24
          });
        }

        const previousTool = this.tools[slot];
        const gesture = results.gestures[index]?.[0];
        const fistScore = gesture?.categoryName === 'Closed_Fist' ? gesture.score : 0;
        const openPalm = gesture?.categoryName === 'Open_Palm' && gesture.score >= 0.7;
        const fistCandidate = inFrame && fistScore >= (previousTool === 'fist' ? 0.45 : 0.7);
        this.fistSamples[slot] = fistCandidate ? Math.min(this.fistSamples[slot] + 1, 2) : 0;

        const isFist = this.fistSamples[slot] >= 2;
        const contactThreshold = this.pinchThreshold * 5;
        const isPinching = inFrame && !fistCandidate && !openPalm &&
          pinchGap < contactThreshold * (previousTool === 'pencil' ? 1.25 : 1);
        const tool = isFist ? 'fist' : isPinching ? 'pencil' : 'hover';

        const filters = this.pointerFilters[slot];
        if ((previousTool === 'fist') !== isFist) {
          filters.x.reset();
          filters.y.reset();
        }
        this.tools[slot] = tool;

        const x = isFist ? (wrist.x + middleBase.x) / 2 : indexTip.x;
        const y = isFist ? (wrist.y + middleBase.y) / 2 : indexTip.y;
        pointers.push({
          slot,
          x: 1 - filters.x.filter(x, nowMs),
          y: filters.y.filter(y, nowMs),
          isPinching,
          isFist
        });
      }
    } catch {
      pointers.length = 0;
      photoHands.length = 0;
    }

    for (const [slot, filters] of this.pointerFilters.entries()) {
      if (pointers.some(pointer => pointer.slot === slot)) continue;
      filters.x.reset();
      filters.y.reset();
      this.tools[slot] = 'hover';
      this.fistSamples[slot] = 0;
    }

    const takePhoto = this.updateShutter(photoHands, nowMs);
    if (this.photoFrame.length || this.shutterLatched) {
      for (const pointer of pointers) {
        pointer.isPinching = false;
        pointer.isFist = false;
      }
    }
    return { breath, pointers, photoFrame: this.photoFrame, takePhoto };
  }

  private updateShutter(hands: PhotoHand[], now: number): boolean {
    const [left, right] = [...hands].sort((a, b) => a.corner.x - b.corner.x);
    const twoHands = left && right && left.slot !== right.slot;
    if (this.shutterLatched) {
      this.shutterLatched = hands.some(hand => hand.pinched);
      return false;
    }

    if (this.armedUntil > now && twoHands) {
      if (left.pinched && right.pinched) {
        this.photoFrame = [];
        this.armedUntil = 0;
        this.framingSince = null;
        this.shutterLatched = true;
        return true;
      }
      return false;
    }

    this.armedUntil = 0;
    this.photoFrame = [];
    const formsFrame = twoHands &&
      right.corner.x - left.corner.x > 0.18 &&
      Math.abs(right.corner.y - left.corner.y) > 0.13 &&
      left.thumbX > 0 && right.thumbX < 0 &&
      left.indexY * (right.corner.y - left.corner.y) > 0 &&
      right.indexY * (left.corner.y - right.corner.y) > 0;

    if (!formsFrame) {
      this.framingSince = null;
      return false;
    }
    this.framingSince ??= now;
    if (now - this.framingSince >= 350) {
      this.photoFrame = [left.corner, right.corner];
      this.armedUntil = now + 2000;
      this.framingSince = null;
    }
    return false;
  }
}
