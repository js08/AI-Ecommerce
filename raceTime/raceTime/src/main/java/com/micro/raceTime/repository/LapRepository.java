package com.micro.raceTime.repository;

//public class LapRepository {
//}
//
//package com.example.stopwatch.repository;

import com.micro.raceTime.model.Lap;
import org.springframework.data.jpa.repository.JpaRepository; // The "magic" library
import org.springframework.stereotype.Repository;

@Repository // Tells Spring this is the data access layer
public interface LapRepository extends JpaRepository<Lap, Long> {
    // We extend JpaRepository<ModelName, PrimaryKeyType>
    // This gives us CRUD operations out of the box without writing any SQL!
}
