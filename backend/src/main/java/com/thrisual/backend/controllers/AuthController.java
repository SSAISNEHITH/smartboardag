package com.thrisual.backend.controllers;

import com.thrisual.backend.dto.DTOs;
import com.thrisual.backend.models.User;
import com.thrisual.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String DEMO_OTP = "123456";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody DTOs.SendOtpRequest request) {
        String target = request.getTarget() != null ? request.getTarget().trim() : "";
        String type = request.getType() != null ? request.getType() : "account";

        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Target email or mobile number is required"));
        }

        // Return the demo OTP so user can test seamlessly
        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "Demo OTP for " + type + " (" + target + ") is " + DEMO_OTP,
            "demoOtp", DEMO_OTP
        ));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody DTOs.VerifyOtpRequest request) {
        String otp = request.getOtp() != null ? request.getOtp().trim() : "";
        if (DEMO_OTP.equals(otp) || "000000".equals(otp)) {
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "verified", true,
                "message", "Verification successful"
            ));
        }
        return ResponseEntity.badRequest().body(Map.of(
            "status", "error",
            "verified", false,
            "message", "Invalid OTP. For demo/testing, please enter " + DEMO_OTP
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody DTOs.RegisterRequest request) {
        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }
        if (request.getMobile() == null || request.getMobile().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mobile number is required"));
        }

        String email = request.getEmail().trim().toLowerCase();
        String mobile = request.getMobile().trim();

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "An account with email '" + email + "' already exists. Please log in."));
        }

        if (userRepository.findByMobile(mobile).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Mobile number '" + mobile + "' is already registered. Please log in or use another number."));
        }

        try {
            User user = new User();
            user.setEmail(email);
            user.setMobile(mobile);
            user.setPassword(passwordEncoder.encode(request.getLoginPassword() != null ? request.getLoginPassword() : "password"));
            user.setViewOnlyPassword(passwordEncoder.encode(request.getViewOnlyPassword() != null ? request.getViewOnlyPassword() : "viewonly"));
            user.setFullName(request.getFullName() != null ? request.getFullName().trim() : "");
            user.setQualification(request.getQualification());
            user.setAdditionalContactInfo(request.getContactInfo());
            user.setPlan(request.getPlan() != null ? request.getPlan() : "15mo");

            userRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "User registered successfully", "status", "success"));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Registration failed: " + ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody DTOs.LoginRequest request) {
        if (request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please provide email and password"));
        }

        String email = request.getEmail().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid email or password"));
        }

        User user = userOpt.get();
        boolean isValid = false;
        boolean isViewOnly = false;

        if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            isValid = true;
            isViewOnly = false;
        } else if (passwordEncoder.matches(request.getPassword(), user.getViewOnlyPassword())) {
            isValid = true;
            isViewOnly = true;
        }

        if (!isValid) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid email or password"));
        }

        DTOs.AuthResponse response = new DTOs.AuthResponse();
        // Mock token for simplicity in connection step
        response.setToken("jwt-token-" + System.currentTimeMillis());
        response.setEmail(user.getEmail());
        response.setFullName(user.getFullName());
        response.setViewOnly(isViewOnly);

        return ResponseEntity.ok(response);
    }
}
