////package com.example.userservice.service;
////
////public class UserService {
////}
//
//
//
//package com.example.userservice.service;
//
//import com.example.userservice.dto.UserRequestDto;
//import com.example.userservice.dto.UserResponseDto;
//import com.example.userservice.entity.User;
//import com.example.userservice.repository.UserRepository;
//import lombok.RequiredArgsConstructor;
//import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
//import org.springframework.security.crypto.password.PasswordEncoder;
//import org.springframework.stereotype.Service;
//import reactor.core.publisher.Mono;
//
//import java.time.LocalDateTime;
//
//@Service                     // Spring service component
//@RequiredArgsConstructor     // Lombok: creates constructor for final fields
//public class UserService {
//
//    private final UserRepository userRepository;
//    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
//
//    // Create a new user (reactive)
//    public Mono<UserResponseDto> createUser(UserRequestDto requestDto) {
//        // 1. Check if email already exists
//        return userRepository.existsByEmail(requestDto.getEmail())
//                .flatMap(exists -> {
//                    if (exists) {
//                        // If email exists, return an error Mono
//                        return Mono.error(new RuntimeException("Email already in use"));
//                    }
//                    // 2. Create User entity from DTO
//                    User user = User.builder()
//                            .email(requestDto.getEmail())
//                            .name(requestDto.getName())
//                            .passwordHash(passwordEncoder.encode(requestDto.getPassword()))
//                            .createdAt(LocalDateTime.now())
//                            .updatedAt(LocalDateTime.now())
//                            .build();
//
//                    // 3. Save to DB (reactive) and convert to ResponseDto
//                    return userRepository.save(user)
//                            .map(this::toResponseDto);
//                });
//    }
//
//    // Find user by ID
//    public Mono<UserResponseDto> getUserById(Long id) {
//        return userRepository.findById(id)
//                .switchIfEmpty(Mono.error(new RuntimeException("User not found with id: " + id)))
//                .map(this::toResponseDto);
//    }
//
//    // Update user (partial update – only name can be updated here)
//    public Mono<UserResponseDto> updateUser(Long id, UserRequestDto requestDto) {
//        return userRepository.findById(id)
//                .switchIfEmpty(Mono.error(new RuntimeException("User not found")))
//                .flatMap(existingUser -> {
//                    // Update fields (except password for simplicity)
//                    existingUser.setName(requestDto.getName());
//                    existingUser.setEmail(requestDto.getEmail()); // email change allowed only if not duplicate
//                    existingUser.setUpdatedAt(LocalDateTime.now());
//                    // If password is provided, hash and update
//                    if (requestDto.getPassword() != null && !requestDto.getPassword().isEmpty()) {
//                        existingUser.setPasswordHash(passwordEncoder.encode(requestDto.getPassword()));
//                    }
//                    return userRepository.save(existingUser);
//                })
//                .map(this::toResponseDto);
//    }
//
//    // Delete user
//    public Mono<Void> deleteUser(Long id) {
//        return userRepository.deleteById(id);
//    }
//
//    // Helper: Convert Entity -> Response DTO
//    private UserResponseDto toResponseDto(User user) {
//        return UserResponseDto.builder()
//                .id(user.getId())
//                .email(user.getEmail())
//                .name(user.getName())
//                .createdAt(user.getCreatedAt())
//                .updatedAt(user.getUpdatedAt())
//                .build();
//    }
//}


package com.example.userservice.service;

import com.example.userservice.dto.UserRequestDto;
import com.example.userservice.dto.UserResponseDto;
import com.example.userservice.entity.User;
import com.example.userservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // Create a new user
    @Transactional
    public UserResponseDto createUser(UserRequestDto requestDto) {
        // 1. Check if email already exists
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            throw new RuntimeException("Email already in use");
        }

        // 2. Create User entity from DTO
        User user = User.builder()
                .email(requestDto.getEmail())
                .name(requestDto.getName())
                .passwordHash(passwordEncoder.encode(requestDto.getPassword()))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // 3. Save to DB and convert to ResponseDto
        User savedUser = userRepository.save(user);
        return toResponseDto(savedUser);
    }

    // Find user by ID
    public UserResponseDto getUserById(Long id) {
        return userRepository.findById(id)
                .map(this::toResponseDto)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
    }

    // Update user
    @Transactional
    public UserResponseDto updateUser(Long id, UserRequestDto requestDto) {
        User existingUser = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Update fields
        existingUser.setName(requestDto.getName());
        existingUser.setEmail(requestDto.getEmail());
        existingUser.setUpdatedAt(LocalDateTime.now());

        // If password is provided, hash and update
        if (requestDto.getPassword() != null && !requestDto.getPassword().isEmpty()) {
            existingUser.setPasswordHash(passwordEncoder.encode(requestDto.getPassword()));
        }

        // In JPA, changes to an attached entity are saved automatically at the end of @Transactional,
        // but explicit save is fine too.
        User updatedUser = userRepository.save(existingUser);
        return toResponseDto(updatedUser);
    }

    // Delete user
    @Transactional
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found");
        }
        userRepository.deleteById(id);
    }

    // Helper: Convert Entity -> Response DTO
    private UserResponseDto toResponseDto(User user) {
        return UserResponseDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}