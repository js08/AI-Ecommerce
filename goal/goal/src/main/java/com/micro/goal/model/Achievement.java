package com.micro.goal.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String message;
    private int totalSum;
    private LocalDateTime createdAt;

    public Achievement() {}

    public Achievement(String message, int totalSum, LocalDateTime createdAt) {
        this.message = message;
        this.totalSum = totalSum;
        this.createdAt = createdAt;
    }

    // Getters & Setters
}