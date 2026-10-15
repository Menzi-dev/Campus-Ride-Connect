package com.campusconnect.service;

import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

// Feature: Check reuse, automatic startup and cleanup without starting a real matcher.
class LocalFaceMatcherLifecycleTest {
    @Test
    void reusesExistingMatcherWithoutLaunchingOrStoppingIt() throws Exception {
        var lifecycle = spy(new LocalFaceMatcherLifecycle("", 1));
        doReturn(true).when(lifecycle).matcherReady();
        lifecycle.afterPropertiesSet();
        lifecycle.destroy();
        verify(lifecycle, never()).resolveRoot();
        verify(lifecycle, never()).launch(any());
    }

    @Test
    void startsMatcherAndStopsOwnedProcessOnShutdown() throws Exception {
        var lifecycle = spy(new LocalFaceMatcherLifecycle("", 1));
        var process = mock(Process.class);
        doReturn(false, true).when(lifecycle).matcherReady();
        doReturn(Path.of(".")).when(lifecycle).resolveRoot();
        doReturn(process).when(lifecycle).launch(any());
        when(process.isAlive()).thenReturn(true);
        when(process.waitFor(3, TimeUnit.SECONDS)).thenReturn(true);
        lifecycle.afterPropertiesSet();
        verify(process, never()).destroy();
        lifecycle.destroy();
        verify(process).destroy();
        lifecycle.destroy();
        verify(process, times(1)).destroy();
    }

    @Test
    void failedStartupCleansUpAndReportsTheLogLocation() throws Exception {
        var lifecycle = spy(new LocalFaceMatcherLifecycle("", 1));
        var process = mock(Process.class);
        doReturn(false).when(lifecycle).matcherReady();
        doReturn(Path.of(".")).when(lifecycle).resolveRoot();
        doReturn(process).when(lifecycle).launch(any());
        when(process.isAlive()).thenReturn(false);
        when(process.waitFor(3, TimeUnit.SECONDS)).thenReturn(true);
        var error = assertThrows(IOException.class, lifecycle::afterPropertiesSet);
        assertTrue(error.getMessage().contains("matcher-backend.log"));
        verify(process).destroy();
    }
}
