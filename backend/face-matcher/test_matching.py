# Face matcher tests: use public sample images to check same-face matching, different-face
# rejection, missing/multiple faces and invalid image data. These fixtures are not student
# enrollments.
# Where: MatchingTest test methods and jpeg() in backend/face-matcher/test_matching.py.
# How: unittest calls feature()/OpenCV comparison with public sample fixtures and asserts accepted
# matches or expected rejection errors.
import base64
import importlib.util
import unittest
from pathlib import Path
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('matcher', Path(__file__).with_name('server.py'))
matcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matcher)
fixtures = Path(__file__).resolve().parents[2] / '.local-face'


def jpeg(image):
    ok, data = cv2.imencode('.jpg', image)
    assert ok
    return 'data:image/jpeg;base64,' + base64.b64encode(data).decode()


class MatchingTest(unittest.TestCase):
    def test_same_face_under_compression_and_resize_matches(self):
        reference = cv2.imread(str(fixtures / 'lena.jpg'))
        probe = cv2.resize(reference, (400, 400))
        score = matcher.recognizer.match(matcher.feature(jpeg(reference)), matcher.feature(jpeg(probe)), cv2.FaceRecognizerSF_FR_COSINE)
        self.assertGreaterEqual(score, matcher.THRESHOLD)

    def test_different_faces_do_not_match(self):
        reference = cv2.imread(str(fixtures / 'lena.jpg'))
        probe = cv2.imread(str(fixtures / 'messi5.jpg'))
        probe = cv2.resize(probe, None, fx=4, fy=4)
        score = matcher.recognizer.match(matcher.feature(jpeg(reference)), matcher.feature(jpeg(probe)), cv2.FaceRecognizerSF_FR_COSINE)
        self.assertLess(score, matcher.THRESHOLD)

    def test_no_face_is_rejected(self):
        with self.assertRaises(ValueError):
            matcher.feature(jpeg(np.zeros((480, 640, 3), dtype=np.uint8)))

    def test_multiple_faces_are_rejected(self):
        image = cv2.imread(str(fixtures / 'lena.jpg'))
        with self.assertRaises(ValueError):
            matcher.feature(jpeg(np.hstack((image, image))))

    def test_invalid_data_is_rejected(self):
        with self.assertRaises(ValueError):
            matcher.feature('data:image/jpeg;base64,not-an-image')


if __name__ == '__main__':
    unittest.main()
