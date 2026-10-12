package com.campusconnect;

import com.campusconnect.controller.AuthController;
import com.campusconnect.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.junit.jupiter.api.Assertions.*;

class FaceEnrollmentTest {
    @Test
    void arbitraryImagesNeverPassLegacyVerification() {
        var controller = new AuthController();
        var image = new MockMultipartFile("image", "photo.jpg", "image/jpeg", new byte[]{1, 2, 3});
        assertEquals(410, controller.verifyFaceDirection("left", image).getStatusCode().value());
        assertEquals(410, controller.verifyFace("someone@spu.ac.za", image).getStatusCode().value());
    }

    @Test
    void enrollmentIsNotIdentityVerificationAndIsExcludedFromAccountResponses() throws Exception {
        var user = new User();
        user.setFaceEnrollmentPhoto("private-image");
        user.setFaceScanMetadata("private-scan");
        user.setApplicationDocuments("private-documents");
        var json = new ObjectMapper().writeValueAsString(user);
        assertFalse(json.contains("private-image"));
        assertFalse(json.contains("private-scan"));
        assertFalse(json.contains("private-documents"));
        assertFalse(json.contains("faceEnrollmentPhoto"));
        assertFalse(Boolean.TRUE.equals(user.getFaceVerified()));
    }
}
