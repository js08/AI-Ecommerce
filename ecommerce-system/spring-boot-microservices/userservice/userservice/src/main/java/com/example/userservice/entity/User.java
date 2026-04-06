package com.example.userservice.entity;
import jakarta.persistence.*;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
//import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Data                     // Generates getters, setters, equals, hashCode, toString
@Builder                  // Enables builder pattern: User.builder().name("John").build()
@NoArgsConstructor        // Needed by R2DBC for object mapping
@AllArgsConstructor       // Needed for the builder to work
//@Table("users")           // Maps this class to the "users" table in DB
@Table(
        name = "users")
public class User {

    @Id                   // Primary key – R2DBC will auto-generate
    private Long id;

    private String email;
    private String name;
    private String passwordHash;   // In real app, store hashed password only

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}