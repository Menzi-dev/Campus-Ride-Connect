// Rider API: handle booking, trip retrieval, dispatch, cancellation, feedback and SOS evidence. Use
// the signed-in account when checking access to ride data.
// Where: RideController handles /api/rides; @GetMapping/@PostMapping/@PutMapping identify the
// actions below.
// How: Spring reads request fields/path IDs, invokes these controller methods and returns their
// ResponseEntity. Service/repository/JDBC calls inside the methods perform the actual work.
package com.campusconnect.controller;

import com.campusconnect.dto.RideRequest;
import com.campusconnect.entity.Ride;
import com.campusconnect.entity.SosAlert;
import com.campusconnect.repository.DriverRepository;
import com.campusconnect.repository.SosAlertRepository;
import com.campusconnect.repository.UserRepository;
import com.campusconnect.service.RideService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/** Provides rider booking, trip lookup, ratings and SOS evidence endpoints with account ownership checks. */
@RestController
@RequestMapping("/api/rides")
@CrossOrigin(origins = "*")
public class RideController {

    @Autowired
    private RideService rideService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private SosAlertRepository sosAlertRepository;


    @Autowired
    private JdbcTemplate jdbcTemplate;

    // Feature: Create a ride only after checking its face confirmation. Save its pending payment in
    // the same transaction so a failed insert does not leave half a booking.
    // Where: RideController.requestRide() below.
    // How: requestRide() takes riderId from currentUserId() and calls rideService.requestRide(). It
    // returns the saved Ride or an HTTP 400 error message.
    /**
     * POST /api/rides/request
     * Request a new ride
     */
    @PostMapping("/request")
    public ResponseEntity<?> requestRide(@RequestBody RideRequest request) {
        try {
            Long riderId = currentUserId();
            Ride ride = rideService.requestRide(riderId, request);
            return ResponseEntity.ok(ride);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * POST /api/rides
     * Backward compatibility endpoint for ride creation
     */
    @PostMapping
    public ResponseEntity<?> createRide(@RequestBody RideRequest request) {
        return requestRide(request);
    }

    // Feature: Retrieve the signed-in rider active trip, or return an empty result when there is
    // none.
    // Where: RideController.getActiveRide() below.
    // How: getActiveRide() uses rideService.getActiveRideForRider() to read, validate or save the
    // data for this operation. The return/exception handling below supplies its result to the
    // caller.
    /**
     * GET /api/rides/active
     * Get the currently active ride for the rider
     */
    @GetMapping("/active")
    public ResponseEntity<?> getActiveRide() {
        try {
            Long riderId = currentUserId();
            Optional<Ride> rideOpt = rideService.getActiveRideForRider(riderId);
            if (rideOpt.isPresent()) {
                return ResponseEntity.ok(rideResponse(rideOpt.get()));
            } else {
                return ResponseEntity.noContent().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Look up one ride by its identifier and handle the result in the surrounding service
    // or API.
    // Where: RideController.getRideById() below.
    // How: getRideById() uses rideService.getRideById() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    /**
     * GET /api/rides/{id}
     * Get a specific ride by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getRideById(@PathVariable Long id) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isPresent()) {
                return ResponseEntity.ok(rideOpt.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Return the selected ride progress information after checking access.
    // Where: RideController.getRideStatus() below.
    // How: getRideStatus() uses rideService.getRideById() to read, validate or save the data for
    // this operation. The return/exception handling below supplies its result to the caller.
    /**
     * GET /api/rides/{id}/status
     * Get the current status of a ride
     */
    @GetMapping("/{id}/status")
    public ResponseEntity<?> getRideStatus(@PathVariable Long id) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isPresent()) {
                Map<String, Object> response = new HashMap<>();
                Ride ride = rideOpt.get();
                response.put("id", ride.getId());
                response.put("status", ride.getStatus());
                response.put("driverId", ride.getDriverId());
                response.put("createdAt", ride.getCreatedAt());
                response.put("cancellationReason", ride.getCancellationReason());
                response.put("cancelledBy", ride.getCancelledBy());
                addDriverDetails(response, ride.getDriverId());
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Retrieve the signed-in rider saved trips in newest-first order.
    // Where: RideController.getHistory() below.
    // How: getHistory() uses rideService.getHistory() to read, validate or save the data for this
    // operation. The return/exception handling below supplies its result to the caller.
    /**
     * GET /api/rides/history
     * Get ride history for the rider
     */
    @GetMapping("/history")
    public ResponseEntity<?> getHistory() {
        Long riderId = currentUserId();
        List<Ride> rides = rideService.getHistory(riderId);
        return ResponseEntity.ok(rides);
    }

    // Feature: Retrieve the rider bookings handled by the scheduled ride flow.
    // Where: RideController.getScheduledRides() below.
    // How: getScheduledRides() uses rideService.getScheduledRidesForRider() to read, validate or
    // save the data for this operation. The return/exception handling below supplies its result to
    // the caller.
    @GetMapping("/scheduled")
    public ResponseEntity<?> getScheduledRides() {
        try {
            Long riderId = currentUserId();
            return ResponseEntity.ok(rideService.getScheduledRidesForRider(riderId));
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Check ownership, face verification and timing before releasing a booking to the
    // driver queue.
    // Where: RideController.dispatchRide() below.
    // How: dispatchRide() uses rideService.getRideById() and rideService.saveRide() to read,
    // validate or save the data for this operation. The return/exception handling below supplies
    // its result to the caller.
    @PostMapping("/{id}/dispatch")
    public ResponseEntity<?> dispatchRide(@PathVariable Long id) {
        try {
            Ride ride = rideService.getRideById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));

            if (!currentUserId().equals(ride.getRiderId()))
                return ResponseEntity.status(403).body(Map.of("error", "Only the rider can dispatch this ride"));
            if (ride.getFaceMatchedAt() == null)
                return ResponseEntity.badRequest().body(Map.of("error", "This ride has no completed account face match. Please make a new verified booking."));
            if (ride.getScheduledAt() != null && ride.getScheduledAt().isAfter(java.time.LocalDateTime.now()))
                return ResponseEntity.badRequest().body(Map.of("error", "This scheduled ride is not due yet"));

            if (ride.getStatus() == Ride.RideStatus.ACCEPTED || ride.getStatus() == Ride.RideStatus.ENROUTE
                    || ride.getStatus() == Ride.RideStatus.ARRIVED || ride.getStatus() == Ride.RideStatus.STARTED
                    || ride.getStatus() == Ride.RideStatus.COMPLETED || ride.getStatus() == Ride.RideStatus.CANCELLED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Ride is not in a dispatchable state"));
            }

            ride.setStatus(Ride.RideStatus.PENDING);
            Ride saved = rideService.saveRide(ride);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Find the selected ride and record cancellation using the checks and fields in this
    // block.
    // Where: RideController.cancelRide() below.
    // How: cancelRide() uses rideService.getRideById() and rideService.saveRide() to read, validate
    // or save the data for this operation. The return/exception handling below supplies its result
    // to the caller.
    /**
     * POST /api/rides/{id}/cancel
     * Cancel a ride
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelRide(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> request) {
        try {
            Long userId = currentUserId();
            Ride ride = rideService.getRideById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));
            if (!userId.equals(ride.getRiderId()) && !userId.equals(ride.getDriverId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You cannot cancel this ride"));
            }
            if (ride.getStatus() == Ride.RideStatus.COMPLETED || ride.getStatus() == Ride.RideStatus.CANCELLED) {
                return ResponseEntity.status(409).body(Map.of("error", "This ride can no longer be cancelled"));
            }

            String reason = request == null ? null : request.get("reason");
            reason = reason == null ? "" : reason.trim();
            if (reason.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "A cancellation reason is required"));
            }
            if (reason.length() > 500) {
                return ResponseEntity.badRequest().body(Map.of("error", "Cancellation reason must be 500 characters or fewer"));
            }

            ride.setStatus(Ride.RideStatus.CANCELLED);
            ride.setCancellationReason(reason);
            ride.setCancelledBy(userId);
            Ride saved = rideService.saveRide(ride);
            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("status", saved.getStatus());
            response.put("cancellationReason", saved.getCancellationReason());
            response.put("cancelledBy", saved.getCancelledBy());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(e.getMessage() != null && e.getMessage().equals("Ride not found") ? 404 : 400).body(error);
        }
    }

    // Feature: Handle the completion request for the selected ride and return the updated result.
    // Where: RideController.completeRide() below.
    // How: completeRide() uses rideService.updateRideStatus() to read, validate or save the data
    // for this operation. The return/exception handling below supplies its result to the caller.
    /**
     * POST /api/rides/{id}/complete
     * Mark a ride as completed
     */
    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRide(@PathVariable Long id) {
        try {
            Ride ride = rideService.updateRideStatus(id, Ride.RideStatus.COMPLETED);
            return ResponseEntity.ok(ride);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // Feature: Check the rider feedback request and store the driver rating and optional comment.
    // Where: RideController.rateDriver() below.
    // How: rateDriver() uses rideService.getRideById(), rideService.saveRide() and
    // driverRepository.findByUserId() to read, validate or save the data for this operation. The
    // return/exception handling below supplies its result to the caller.
    @PostMapping("/{id}/rating")
    public ResponseEntity<?> rateDriver(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            Long riderId = currentUserId();
            Ride ride = rideService.getRideById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));

            if (!riderId.equals(ride.getRiderId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You cannot rate this ride"));
            }
            if (ride.getStatus() != Ride.RideStatus.COMPLETED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only completed rides can be rated"));
            }
            if (ride.getDriverId() == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "This ride has no driver to rate"));
            }
            if (ride.getRiderRating() != null) {
                return ResponseEntity.badRequest().body(Map.of("error", "This ride has already been rated"));
            }

            Object rawRating = request.get("rating");
            int rating = rawRating instanceof Number
                    ? ((Number) rawRating).intValue()
                    : Integer.parseInt(String.valueOf(rawRating));
            if (rating < 1 || rating > 5) {
                return ResponseEntity.badRequest().body(Map.of("error", "Rating must be between 1 and 5"));
            }

            ride.setRiderRating(rating);
            Object comment = request.get("comment");
            ride.setRiderRatingComment(comment == null ? null : String.valueOf(comment).trim());
            rideService.saveRide(ride);

            driverRepository.findByUserId(ride.getDriverId()).ifPresent(driver -> {
                int completedRatings = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM rides WHERE driver_id = ? AND status = 'COMPLETED' AND rider_rating IS NOT NULL",
                        Integer.class,
                        ride.getDriverId());
                BigDecimal currentTotal = driver.getRating() == null
                        ? BigDecimal.ZERO
                        : driver.getRating().multiply(BigDecimal.valueOf(Math.max(0, completedRatings - 1)));
                BigDecimal average = currentTotal.add(BigDecimal.valueOf(rating))
                        .divide(BigDecimal.valueOf(completedRatings), 2, RoundingMode.HALF_UP);
                driver.setRating(average);
                driverRepository.save(driver);
            });

            return ResponseEntity.ok(Map.of("success", true, "rating", rating));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rating must be a number from 1 to 5"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Feature: Check the driver feedback request and store the rider rating and optional comment.
    // Where: RideController.rateRider() below.
    // How: rateRider() uses rideService.getRideById(), rideService.saveRide() and
    // jdbcTemplate.queryForObject() to read, validate or save the data for this operation. The
    // return/exception handling below supplies its result to the caller.
    @PostMapping("/{id}/rider-rating")
    public ResponseEntity<?> rateRider(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            Long driverId = currentUserId();
            Ride ride = rideService.getRideById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Ride not found"));

            if (!driverId.equals(ride.getDriverId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You cannot rate this ride"));
            }
            if (ride.getStatus() != Ride.RideStatus.COMPLETED) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only completed rides can be rated"));
            }
            if (ride.getDriverRating() != null) {
                return ResponseEntity.badRequest().body(Map.of("error", "This rider has already been rated for this ride"));
            }

            Object rawRating = request.get("rating");
            int rating = rawRating instanceof Number
                    ? ((Number) rawRating).intValue()
                    : Integer.parseInt(String.valueOf(rawRating));
            if (rating < 1 || rating > 5) {
                return ResponseEntity.badRequest().body(Map.of("error", "Rating must be between 1 and 5"));
            }

            Object comment = request.get("comment");
            String ratingComment = comment == null ? null : String.valueOf(comment).trim();
            if (ratingComment != null && ratingComment.length() > 500) {
                return ResponseEntity.badRequest().body(Map.of("error", "Comment must be 500 characters or fewer"));
            }

            ride.setDriverRating(rating);
            ride.setDriverRatingComment(ratingComment);
            rideService.saveRide(ride);

            Double averageRating = jdbcTemplate.queryForObject(
                    "SELECT AVG(driver_rating) FROM rides WHERE rider_id = ? AND status = 'COMPLETED'",
                    Double.class, ride.getRiderId());
            return ResponseEntity.ok(Map.of("success", true, "rating", rating,
                    "riderRating", averageRating == null ? 0.0 : averageRating));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rating must be a number from 1 to 5"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Feature: Check that the reporter belongs to the ride, then save the SOS alert and available
    // coordinates.
    // Where: RideController.sosAlert() below.
    // How: sosAlert() loads the ride, checks its rider/assigned driver against currentUserId(),
    // copies available GPS into SosAlert and saves it through sosAlertRepository.
    /**
     * POST /api/rides/{id}/sos
     * Send SOS alert for a ride
     */
    @PostMapping("/{id}/sos")
    public ResponseEntity<?> sosAlert(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> request) {
        try {
            Optional<Ride> rideOpt = rideService.getRideById(id);
            if (rideOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Long userId = currentUserId();
            Ride ride = rideOpt.get();
            if (!userId.equals(ride.getRiderId()) && !userId.equals(ride.getDriverId())) {
                return ResponseEntity.status(403).body(Map.of("error", "You are not part of this ride"));
            }

            SosAlert alert = new SosAlert();
            alert.setRideId(id);
            alert.setTriggeredBy(userId);
            if (request != null) {
                alert.setGpsLat(asDouble(request.get("gpsLat")));
                alert.setGpsLng(asDouble(request.get("gpsLng")));
            }
            SosAlert saved = sosAlertRepository.save(alert);
            Map<String, Object> response = new HashMap<>();
            response.put("alertId", saved.getId());
            response.put("message", "SOS alert has been dispatched");
            response.put("rideId", id);
            response.put("status", saved.getStatus());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    private Double asDouble(Object value) {
        if (value == null) return null;
        try { return Double.valueOf(value.toString()); } catch (NumberFormatException ignored) { return null; }
    }

    // Feature: Check access to the ride alert and save the uploaded audio evidence and duration.
    // Where: RideController.uploadSosAudio() below.
    // How: uploadSosAudio() uses rideService.getRideById(), sosAlertRepository.findById() and
    // sosAlertRepository.save() to read, validate or save the data for this operation. The
    // return/exception handling below supplies its result to the caller.
    @PutMapping("/{id}/sos/{alertId}/audio")
    public ResponseEntity<?> uploadSosAudio(@PathVariable Long id, @PathVariable Long alertId,
                                            @RequestParam("audio") MultipartFile audio,
                                            @RequestParam("duration") Integer duration) {
        try {
            Long userId = currentUserId();
            Ride ride = rideService.getRideById(id).orElse(null);
            SosAlert alert = sosAlertRepository.findById(alertId).orElse(null);
                boolean isRideParticipant = ride != null
                    && (userId.equals(ride.getRiderId()) || userId.equals(ride.getDriverId()));
                boolean isAlertOwner = alert != null && userId.equals(alert.getTriggeredBy());
            if (ride == null || alert == null || !id.equals(alert.getRideId())
                    || (!isRideParticipant && !isAlertOwner)) {
                return ResponseEntity.status(403).body(Map.of("error", "SOS alert is not accessible"));
            }
            if (audio == null || audio.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Audio file is required"));
            if (audio.getSize() > 2 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of("error", "Audio file must be 2 MB or smaller"));
            }
            if (duration == null || duration < 1 || duration > 60) {
                return ResponseEntity.badRequest().body(Map.of("error", "Audio duration must be between 1 and 60 seconds"));
            }

            Path directory = Paths.get("uploads", "sos");
            Files.createDirectories(directory);

            String extension = audio.getOriginalFilename() != null && audio.getOriginalFilename().contains(".")
                    ? audio.getOriginalFilename().substring(audio.getOriginalFilename().lastIndexOf('.')) : ".m4a";
            Path target = directory.resolve("sos-" + alertId + extension);
            Path previousPath = alert.getAudioFilePath() != null ? Paths.get(alert.getAudioFilePath()) : null;
            if (previousPath != null && !previousPath.equals(target) && Files.exists(previousPath)) {
                Files.deleteIfExists(previousPath);
            }

            try (var inputStream = audio.getInputStream();
                 var outputStream = Files.newOutputStream(target, Files.exists(target) ? java.nio.file.StandardOpenOption.APPEND : java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.WRITE)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                outputStream.flush();
            }

            alert.setAudioFilePath(target.toString());
            alert.setRecordingDuration(Math.max(0, duration == null ? 0 : duration));
            sosAlertRepository.save(alert);
            return ResponseEntity.ok(Map.of("alertId", alertId, "audioFilePath", target.toString(), "recordingDuration", alert.getRecordingDuration()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // Utility method to get the current user ID from security context
    // Feature: Read the signed-in account identifier from Spring Security instead of trusting a
    // client-supplied identity.
    // Where: RideController.currentUserId() below.
    // How: currentUserId() uses SecurityContextHolder.getContext() and Long.valueOf() to
    // build/check the result returned by the code below.
    private Long currentUserId() {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return Long.valueOf(userId);
    }

    // Feature: Build the client ride response and include the related driver details when
    // available.
    // Where: RideController.rideResponse() below.
    // How: rideResponse() calls addDriverDetails() in this class to carry out the operation. Any
    // failed checks stop the operation with the exception shown below.
    private Map<String, Object> rideResponse(Ride ride) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", ride.getId());
        response.put("riderId", ride.getRiderId());
        response.put("driverId", ride.getDriverId());
        response.put("pickupLocation", ride.getPickupLocation());
        response.put("destination", ride.getDestination());
        response.put("pickupLat", ride.getPickupLat());
        response.put("pickupLng", ride.getPickupLng());
        response.put("destLat", ride.getDestLat());
        response.put("destLng", ride.getDestLng());
        response.put("currentLat", ride.getCurrentLat());
        response.put("currentLng", ride.getCurrentLng());
        response.put("fare", ride.getFare());
        response.put("distanceKm", ride.getDistanceKm());
        response.put("durationMinutes", ride.getDurationMinutes());
        response.put("status", ride.getStatus());
        response.put("createdAt", ride.getCreatedAt());
        response.put("cancellationReason", ride.getCancellationReason());
        response.put("cancelledBy", ride.getCancelledBy());
        addDriverDetails(response, ride.getDriverId());
        return response;
    }

    // Feature: Look up the assigned driver and add the available contact and vehicle details to the
    // response.
    // Where: RideController.addDriverDetails() below.
    // How: addDriverDetails() uses userRepository.findById() and driverRepository.findByUserId() to
    // read, validate or save the data for this operation. The return/exception handling below
    // supplies its result to the caller.
    private void addDriverDetails(Map<String, Object> response, Long driverId) {
        if (driverId == null) {
            return;
        }

        userRepository.findById(driverId).ifPresent(user -> {
            Map<String, Object> driver = new HashMap<>();
            driver.put("id", user.getId());
            driver.put("fullName", user.getFullName());
            driver.put("phone", user.getPhone());
            driver.put("profilePhoto", user.getProfilePhoto());
            driverRepository.findByUserId(driverId).ifPresent(driverRecord -> {
                driver.put("rating", driverRecord.getRating());
                driver.put("vehicleMake", driverRecord.getVehicleMake());
                driver.put("vehicleYear", driverRecord.getVehicleYear());
                driver.put("licencePlate", driverRecord.getLicencePlate());
                driver.put("vehiclePhoto", driverRecord.getVehiclePhoto());
            });
            response.put("driver", driver);
        });
    }
}
