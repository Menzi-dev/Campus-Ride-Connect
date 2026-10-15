package com.campusconnect.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

// Feature: Start the local face matcher when Spring creates this backend component.
// How: Check /health first; otherwise launch the project's Python environment and wait
// for readiness. On shutdown, stop only the process started by this backend instance.
@Component
@ConditionalOnProperty(prefix = "app.face-matcher", name = "auto-start", havingValue = "true", matchIfMissing = true)
public class LocalFaceMatcherLifecycle implements InitializingBean, DisposableBean {
    private static final Logger LOG = LoggerFactory.getLogger(LocalFaceMatcherLifecycle.class);
    private final String configuredRoot;
    private final long timeoutSeconds;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(500)).build();
    private Process ownedProcess;

    public LocalFaceMatcherLifecycle(
            @Value("${app.face-matcher.project-root:}") String configuredRoot,
            @Value("${app.face-matcher.startup-timeout-seconds:20}") long timeoutSeconds) {
        this.configuredRoot = configuredRoot;
        this.timeoutSeconds = Math.max(1, timeoutSeconds);
    }

    // Where: Spring calls afterPropertiesSet() during backend startup, before accepting bookings.
    // How: Reuse a ready service; otherwise find the source/models, launch Python and check readiness.
    @Override
    public void afterPropertiesSet() throws Exception {
        if (matcherReady()) {
            LOG.info("Face matcher is already ready on port 8090; reusing it.");
            return;
        }
        Path root = resolveRoot();
        ownedProcess = launch(root);
        try {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            while (System.nanoTime() < deadline) {
                if (!ownedProcess.isAlive()) {
                    // Another backend may have started the matcher at the same time.
                    if (matcherReady()) {
                        ownedProcess = null;
                        LOG.info("Face matcher is ready on port 8090; reusing it.");
                        return;
                    }
                    throw new IOException("Face matcher exited. Check .local-face/matcher-backend.log.");
                }
                if (matcherReady()) {
                    LOG.info("Face matcher started automatically and is ready on port 8090.");
                    return;
                }
                Thread.sleep(100);
            }
            throw new IOException("Face matcher did not become ready. Check .local-face/matcher-backend.log.");
        } catch (Exception error) {
            destroy();
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            throw error;
        }
    }

    boolean matcherReady() {
        try {
            var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8090/health"))
                    .timeout(Duration.ofMillis(750)).GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200 && response.body().matches("(?s).*\"ready\"\\s*:\\s*true.*");
        } catch (Exception error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            return false;
        }
    }

    // Where: resolveRoot() supports running Maven from backend or the project directory.
    // How: Walk upward to the matcher source; FACE_MATCHER_PROJECT_ROOT can override the search.
    Path resolveRoot() throws IOException {
        Path candidate = configuredRoot.isBlank() ? Path.of("").toAbsolutePath() : Path.of(configuredRoot).toAbsolutePath();
        for (Path directory = candidate.normalize(); directory != null; directory = directory.getParent()) {
            if (Files.isRegularFile(directory.resolve("backend/face-matcher/server.py"))) return directory;
            if (!configuredRoot.isBlank()) break;
        }
        throw new IOException("Cannot find backend/face-matcher/server.py. Run from the project/backend directory or set FACE_MATCHER_PROJECT_ROOT.");
    }

    Process launch(Path root) throws IOException {
        boolean windows = System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("win");
        Path python = root.resolve(windows ? ".local-face/venv/Scripts/python.exe" : ".local-face/venv/bin/python");
        for (Path required : new Path[]{python, root.resolve(".local-face/models/yunet.onnx"), root.resolve(".local-face/models/sface.onnx")}) {
            if (!Files.isRegularFile(required)) {
                throw new IOException("Face matcher setup is missing: " + required.getFileName() + ". Follow the README face-matcher installation steps.");
            }
        }
        // ProcessBuilder passes paths as arguments, so spaces in the project path are safe.
        return new ProcessBuilder(python.toString(), "-u", root.resolve("backend/face-matcher/server.py").toString())
                .directory(root.toFile()).redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.appendTo(root.resolve(".local-face/matcher-backend.log").toFile()))
                .start();
    }

    // Feature: Release an automatically started matcher when this backend stops/restarts.
    // An independently started matcher is never assigned to ownedProcess and is left running.
    @Override
    public void destroy() {
        Process process = ownedProcess;
        ownedProcess = null;
        if (process == null) return;
        process.destroy();
        try {
            if (!process.waitFor(3, TimeUnit.SECONDS)) process.destroyForcibly();
        } catch (InterruptedException error) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
        }
    }
}
