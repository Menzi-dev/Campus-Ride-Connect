# Local face comparison: load YuNet and SFace models and expose a loopback HTTP endpoint for the
# Java backend. Decode each request in memory; compare similarity rather than claiming spoof-proof
# identity checks.
# Where: feature(), Handler.do_POST() and HTTPServer startup in backend/face-matcher/server.py.
# How: OpenCV detects/aligns each JPEG with YuNet, extracts SFace vectors and compares cosine
# similarity. Java RideFaceVerificationService calls /compare and receives matched/similarity JSON.
"""Loopback-only YuNet/SFace inference. Images exist only in request memory."""
import base64
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import cv2
import numpy as np

MODEL_DIR = Path(__file__).resolve().parents[2] / '.local-face' / 'models'
detector = cv2.FaceDetectorYN.create(str(MODEL_DIR / 'yunet.onnx'), '', (320, 320), 0.85)
recognizer = cv2.FaceRecognizerSF.create(str(MODEL_DIR / 'sface.onnx'), '')
THRESHOLD = float(os.environ.get('FACE_MATCH_THRESHOLD', '0.45'))


# Feature: Require one usable JPEG face, align it and calculate the SFace feature vector for
# comparison.
# Where: feature() below.
# How: Base64/NumPy decode the JPEG, detector.detect() requires one face and
# recognizer.alignCrop()/feature() return its vector.
def feature(data_url):
    """Validate one JPEG face, align it, and return the SFace vector used for comparison."""
    if not isinstance(data_url, str) or not data_url.startswith('data:image/jpeg;base64,'):
        raise ValueError('Use a JPEG camera image.')
    data = base64.b64decode(data_url.split(',', 1)[1], validate=True)
    if len(data) > 2 * 1024 * 1024:
        raise ValueError('Camera image is too large.')
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or max(image.shape[:2]) > 4096:
        raise ValueError('Camera image could not be read.')
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    if faces is None or len(faces) != 1:
        raise ValueError('Exactly one clear face must be visible. Improve the lighting and try again.')
    face = faces[0]
    if min(face[2:4]) < 70:
        raise ValueError('Move closer so your face is clear enough to compare.')
    return recognizer.feature(recognizer.alignCrop(image, face))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Do not log biometric request bodies or account information.

    def send_json(self, status, body):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    # Feature: Return the matcher readiness response for the health endpoint.
    # Where: do_GET() below.
    # How: Handler.do_GET() checks self.path and send_json() returns ready for /health.
    def do_GET(self):
        self.send_json(200 if self.path == '/health' else 404, {'ready': self.path == '/health'})

    # Feature: Read the two images, calculate cosine similarity and return whether it reaches the
    # configured threshold. Return helpful errors for invalid images.
    # Where: do_POST() below.
    # How: Handler.do_POST() calls feature() for reference/probe, then recognizer.match() compares
    # cosine similarity against THRESHOLD.
    def do_POST(self):
        # Only the loopback backend calls this endpoint; images are decoded in memory.
        if self.path != '/compare':
            return self.send_json(404, {'error': 'Not found'})
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0 or length > 6 * 1024 * 1024:
            return self.send_json(413, {'error': 'Invalid image request size'})
        try:
            body = json.loads(self.rfile.read(length))
            reference, probe = feature(body.get('reference')), feature(body.get('probe'))
            similarity = float(recognizer.match(reference, probe, cv2.FaceRecognizerSF_FR_COSINE))
            self.send_json(200, {'matched': similarity >= THRESHOLD, 'similarity': similarity,
                                 'method': 'opencv-sface-v1', 'threshold': THRESHOLD})
        except (ValueError, TypeError, cv2.error):
            self.send_json(422, {'error': 'Could not compare a clear, single face in both images. Please retry or contact support about your enrollment.'})
        except Exception:
            self.send_json(500, {'error': 'Face comparison is temporarily unavailable.'})


# Feature: Start the local service on port 8090; the public preview does not expose this port.
if __name__ == '__main__':
    print('Local face matcher ready on 127.0.0.1:8090', flush=True)
    HTTPServer(('127.0.0.1', 8090), Handler).serve_forever()
