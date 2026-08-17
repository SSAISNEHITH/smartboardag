package com.thrisual.backend.dto;

import lombok.Data;

public class DTOs {

    @Data
    public static class RegisterRequest {
        private String email;
        private String mobile;
        private String loginPassword;
        private String viewOnlyPassword;
        private String fullName;
        private String qualification;
        private String contactInfo;
        private String plan;
    }

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
        private boolean viewOnly; // If true, authenticate using viewOnlyPassword
    }

    @Data
    public static class AuthResponse {
        private String token;
        private String email;
        private String fullName;
        private boolean isViewOnly;
    }

    @Data
    public static class SendOtpRequest {
        private String type; // email or mobile
        private String target; // the email address or phone number
    }

    @Data
    public static class VerifyOtpRequest {
        private String type;
        private String target;
        private String otp;
    }
}
