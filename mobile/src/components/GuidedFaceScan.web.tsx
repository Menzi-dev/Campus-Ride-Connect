// Browser face capture: registration keeps its turns/blink; ride actions capture one front face.
// Both return a JPEG with scan details. The backend compares ride images with saved enrollment;
// a face match alone cannot prove that a live account owner is present.
// Where: mobile/src/components/GuidedFaceScan.web.tsx.
// How: GuidedFaceScan() uses FaceLandmarker, getUserMedia() and its tick() loop to check
// challenges. onComplete returns the canvas JPEG/metadata to registration or RideFaceVerification.
/** Keeps guided registration movements; ride checks capture one clear front-facing image. */
import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceScanResult } from './GuidedFaceScan';

type Challenge = 'center' | 'left' | 'right' | 'blink' | 'finish';
const instructions: Record<Challenge, string> = {
  center: 'Look straight ahead', left: 'Slowly turn your head to your left',
  right: 'Slowly turn your head to your right', blink: 'Blink both eyes, then open them',
  finish: 'Face forward and hold still',
};
export default function GuidedFaceScan({ onComplete, purpose = 'enrollment' }: { onComplete: (result: FaceScanResult) => void; purpose?: 'enrollment' | 'ride' }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onComplete); callback.current = onComplete;
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('Find a well-lit place and remove anything covering your face.');
  const [index, setIndex] = useState(0);
  const [sequence, setSequence] = useState<Challenge[]>([]);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  // Feature: Start one camera session for each scan attempt. Choose a movement order,
  // load the face tracker and release the camera when the scan ends or this screen closes.
  // Where: the effect that depends on run, with start(), tick() and release() inside it.
  // How: start() loads FaceLandmarker and opens getUserMedia(); tick() checks frames.
  // The effect cleanup calls release() and detector.close() when this attempt ends.
  useEffect(() => {
    if (!run) return;
    let disposed = false, frame = 0, stream: MediaStream | undefined, detector: FaceLandmarker | undefined;
    let position = 0, heldSince = 0, samples = 0, lastTime = -1, lastCheck = 0;
    let baseline = 0, baselineTotal = 0, baselineSamples = 0, closed = false, blinkReady = false;
    // Ride requests and driver acceptance need only one front-facing capture.
    // Registration keeps its original five movement/blink steps and saved enrollment metadata.
    const turns: Challenge[] = purpose === 'enrollment'
      ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? ['left', 'right'] : ['right', 'left']) : [];
    const steps: Challenge[] = purpose === 'ride' ? ['center'] : ['center', ...turns, 'blink', 'finish'];
    setSequence(steps); setIndex(0); setError(''); setActive(true); setMessage('Preparing face detector…');
    // Release both the camera and animation loop on completion, failure or unmount.
    const release = () => { stream?.getTracks().forEach(track => track.stop()); cancelAnimationFrame(frame); };
    const fail = (text: string) => { release(); setError(text); setActive(false); };
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Open the HTTPS link to use your camera.');
        const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
        detector = await FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
          runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.7, minFacePresenceConfidence: 0.7, minTrackingConfidence: 0.7,
        });
        if (disposed) { detector.close(); return; }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (disposed) { release(); detector.close(); return; }
        const element = video.current;
        if (!element) throw new Error('Camera preview unavailable. Please retry.');
        element.srcObject = stream; await element.play();
        const started = performance.now();
        function tick(now: number) {
          if (disposed || !detector || !video.current) return;
          try {
            if (now - started > 90000) { fail('The scan timed out. Improve your lighting and try again.'); return; }
            const v = video.current;
            if (v.readyState < 2 || v.currentTime === lastTime || now - lastCheck < 100) { frame = requestAnimationFrame(tick); return; }
            lastTime = v.currentTime; lastCheck = now;
            const result = detector.detectForVideo(v, now);
            const resetHold = () => { heldSince = 0; samples = 0; };
            // Feature: Accept one centred face of a suitable size before checking movements.
            // Missing, extra or badly positioned faces reset the current hold period.
            // Where: tick(), after detector.detectForVideo() returns result.faceLandmarks.
            // How: check the face count and landmark bounds; resetHold() clears step progress
            // and setMessage() tells the user how to reposition before the next frame.
            if (result.faceLandmarks.length !== 1) {
              resetHold(); closed = false; blinkReady = false;
              setMessage(result.faceLandmarks.length ? 'Only one person should be in the frame' : 'Place your face inside the oval');
              frame = requestAnimationFrame(tick); return;
            }
            const points = result.faceLandmarks[0];
            const xs = points.map(p => p.x), ys = points.map(p => p.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
            const size = maxY - minY;
            if (size < 0.35 || size > 0.86 || minX < 0.05 || maxX > 0.95 || minY < 0.03 || maxY > 0.97) {
              resetHold(); closed = false; blinkReady = false; setMessage(size < 0.35 ? 'Move a little closer' : 'Move back and center your face');
              frame = requestAnimationFrame(tick); return;
            }
            // Feature: Use face points and blink scores to check the requested turn or blink.
            // Require repeated passing samples so a single camera frame cannot finish a step.
            // Where: tick(), from eyeMid/yaw calculation through the passed/samples checks.
            // How: yaw measures the head turn, faceBlendshapes scores measure blinking and
            // steps[position] selects the challenge. samples and heldSince confirm a steady pass.
            const eyeMid = (points[33].x + points[263].x) / 2;
            const eyeWidth = Math.abs(points[263].x - points[33].x);
            const yaw = (points[1].x - eyeMid) / Math.max(eyeWidth, 0.01);
            const categories = result.faceBlendshapes[0]?.categories || [];
            const score = (name: string) => categories.find(c => c.categoryName === name)?.score || 0;
            const shut = score('eyeBlinkLeft') > 0.55 && score('eyeBlinkRight') > 0.55;
            const open = score('eyeBlinkLeft') < 0.25 && score('eyeBlinkRight') < 0.25;
            const challenge = steps[position];
            let passed = false;
            if (challenge === 'center') {
              passed = Math.abs(yaw) < 0.15 && open;
              if (passed) { baselineTotal += yaw; baselineSamples++; }
            } else if (challenge === 'blink') {
              if (!closed && open) blinkReady = true;
              if (blinkReady && shut) closed = true;
              passed = closed && open;
            } else if (challenge === 'finish') passed = Math.abs(yaw - baseline) < 0.12 && open;
            else passed = challenge === 'left' ? yaw - baseline > 0.20 : yaw - baseline < -0.20;
            setMessage(instructions[challenge]);
            if (!passed) resetHold();
            else { if (!heldSince) heldSince = now; samples++; }
            if (passed && ((challenge === 'blink' && samples >= 2) || (samples >= 5 && now - heldSince >= 650))) {
              if (challenge === 'center') baseline = baselineTotal / Math.max(1, baselineSamples);
              position++; resetHold();
              // Feature: After every step passes, capture a JPEG and return its scan details.
              // The parent saves enrollment or requests server comparison, depending on the flow.
              // Where: tick(), when position reaches steps.length.
              // How: drawImage() copies the camera frame into a canvas; toDataURL() makes the JPEG.
              // callback.current() sends it to the parent's onComplete action after release().
              if (position === steps.length) {
                const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
                const context = canvas.getContext('2d'); if (!context) throw new Error('Could not save enrollment image.');
                context.drawImage(v, 0, 0); const image = canvas.toDataURL('image/jpeg', 0.8);
                release(); setActive(false); setMessage(purpose === 'ride' ? 'Front-face scan complete' : 'Guided scan complete');
                callback.current({ image, method: purpose === 'ride' ? 'mediapipe-front-face-v1' : 'mediapipe-guided-movement-v1', completedAt: new Date().toISOString(), challenges: steps });
                return;
              }
              setIndex(position);
            }
            frame = requestAnimationFrame(tick);
          } catch { fail('Face tracking stopped. Please restart the scan.'); }
        }
        frame = requestAnimationFrame(tick);
      } catch (cause) {
        if (!disposed) fail(cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Allow camera access in your browser settings, then try again.'
          : cause instanceof Error ? cause.message : 'Could not start the face scan.');
      }
    }
    start();
    return () => { disposed = true; release(); detector?.close(); };
  }, [run, purpose]);
  return <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', fontFamily: 'system-ui', color: '#19352a' }}>
    <div style={{ position: 'relative', height: 320, background: '#122b22', borderRadius: 24, overflow: 'hidden' }}>
      <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
      <div style={{ position: 'absolute', top: '12%', left: '24%', width: '52%', height: '76%', border: `3px solid ${active ? '#50df91' : '#e3efe8'}`, borderRadius: '50%', pointerEvents: 'none' }} />
      <span style={{ position: 'absolute', bottom: 12, left: 16, color: 'white', fontSize: 13 }}>Camera stays on only during your scan</span>
    </div>
    <h3 aria-live="polite" style={{ textAlign: 'center', fontSize: 20 }}>{message}</h3>
    {active && <><progress value={index} max={sequence.length} style={{ width: '100%', accentColor: '#00a651' }} /><p style={{ textAlign: 'center' }}>{purpose === 'ride' ? 'Look straight ahead and hold briefly for one photo' : `Step ${index + 1} of ${sequence.length} · Follow the instruction and hold briefly`}</p></>}
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    {!active && <><label style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: '21px', margin: '18px 0' }}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{purpose === 'ride'
      ? 'I agree to compare this scan with my account enrollment photo to confirm this ride request. This scan photo is not saved.'
      : 'I agree to save an enrollment photo and the scan completion details with my account. This local movement check does not verify my identity.'}</label>
    <button disabled={!consent} onClick={() => setRun(r => r + 1)} style={{ width: '100%', border: 0, borderRadius: 12, padding: 16, background: consent ? '#00a651' : '#d1d9d4', color: 'white', fontWeight: 700, fontSize: 16, cursor: consent ? 'pointer' : 'default' }}>{purpose === 'ride' ? 'Scan front face' : 'Start guided scan'}</button></>}
  </div>;
}
