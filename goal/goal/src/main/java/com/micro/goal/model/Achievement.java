package com.micro.goal.model;

//public class Achievement {
//}
//
//
//package com.micro.goalService.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

// 1. @Document: Tells Spring this class represents a MongoDB record (JSON-like)
@Document(collection = "achievements")
public class Achievement {

    @Id // 2. MongoDB uses String IDs (usually UUIDs) by default
    private String id;

    // 3. Simple fields to store the reward info
    private String message;
    private int totalTime;
    private LocalDateTime achievedAt;

    // 4. Default Constructor (Required by Spring)
    public Achievement() {}

    // 5. Parameterized Constructor to build the object quickly
    public Achievement(String message, int totalTime, LocalDateTime achievedAt) {
        this.message = message;
        this.totalTime = totalTime;
        this.achievedAt = achievedAt;
    }

    // 6. Getters and Setters (So Spring can convert this to JSON for the API)
    public String getId() { return id; }
    public String getMessage() { return message; }
    public int getTotalTime() { return totalTime; }
    public LocalDateTime getAchievedAt() { return achievedAt; }
}
