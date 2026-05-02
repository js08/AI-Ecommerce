// 1. Package: This is like the folder address for this file so Java can find it.
package com.micro.raceTime.model;

// 2. Imports: Bringing in the JPA "toolbox".
// The '*' means "bring in all tools for persistence" (Table, Id, Column, etc.)
import jakarta.persistence.*;

// 3. @Entity: This tells Spring Boot, "Hey, this isn't just a class,
// it's a blueprint for a Database Table."
@Entity

// 4. @Table: This tells Java exactly what to call the table in Postgres.
@Table(name = "laps")
public class Lap {

    // 5. @Id: Every database table needs a unique ID (Primary Key).
    @Id

    // 6. @GeneratedValue: This tells the database, "You handle the numbers."
    // Every time we save a lap, Postgres automatically makes the ID 1, then 2, then 3.
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // We use 'Long' because IDs can become very large numbers.

    // 7. @Column: Maps this variable to a specific column name in your database.
    @Column(name = "duration_ms")
    private int durationMs; // The actual time in milliseconds.

    // 8. Default Constructor: JPA needs a "blank" version of this object
    // to work its magic behind the scenes. It must have no arguments.
    public Lap() {}

    // 9. Parameterized Constructor: This is a shortcut for us human developers.
    // It lets us do: new Lap(5000) instead of setting it line by line.
    public Lap(int durationMs) {
        this.durationMs = durationMs; // 'this' refers to the variable in line 19.
    }

    // 10. Getters & Setters: Because our variables are 'private' (Encapsulation),
    // other classes cannot touch them directly. They must use these "public doors."

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public int getDurationMs() { return durationMs; }
    public void setDurationMs(int durationMs) { this.durationMs = durationMs; }
}