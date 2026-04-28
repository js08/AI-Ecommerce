package com.micro.raceTime.model;

//public class Lap {
//}
//
//
//package com.example.stopwatch.model;

import jakarta.persistence.*; // Import tools to link this class to a database table

@Entity // Tells Hibernate to make a table out of this class
@Table(name = "laps") // Sets the name of the table in Postgres
public class Lap {

    @Id // Marks this field as the Primary Key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Tells Postgres to auto-increment the ID (1, 2, 3...)
    private Long id;

    @Column(name = "duration_ms") // Names the column for the time value
    private int durationMs; // Stores the lap time in milliseconds

    // Default constructor is required by JPA
    public Lap() {}

    // Constructor to easily create a Lap object
    public Lap(int durationMs) {
        this.durationMs = durationMs;
    }

    // Getters and Setters (Allow other classes to see and change the data)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public int getDurationMs() { return durationMs; }
    public void setDurationMs(int durationMs) { this.durationMs = durationMs; }
}
