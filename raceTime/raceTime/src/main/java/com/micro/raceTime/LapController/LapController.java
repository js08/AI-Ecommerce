package com.micro.raceTime.LapController;

//public class LapController {
//}
//
//
//package com.example.stopwatch.controller;

import com.micro.raceTime.model.Lap;
import com.micro.raceTime.repository.LapRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

        import java.util.List;

@RestController // Tells Spring this class handles Web/API requests
@RequestMapping("/api/laps") // All URLs start with http://localhost:8080/api/laps
@CrossOrigin(origins = "http://localhost:3000") // Allows your React app (on port 3000) to talk to this backend
public class LapController {

    @Autowired // Automatically plugs in our Repository "translator"
    private LapRepository lapRepository;

    // 1. CREATE: Save a new lap from the stopwatch
    @PostMapping // Handles POST requests
    public Lap saveLap(@RequestBody Lap lap) {
        // Takes the Lap data sent from React and saves it to Postgres
        return lapRepository.save(lap);
    }

    // 2. READ: Get a list of all saved laps
    @GetMapping // Handles GET requests
    public List<Lap> getAllLaps() {
        // Asks the repository to fetch every row in the table
        return lapRepository.findAll();
    }

    // 3. DELETE: Clear a specific lap by its ID
    @DeleteMapping("/{id}") // Handles DELETE requests for a specific ID
    public void deleteLap(@PathVariable Long id) {
        lapRepository.deleteById(id);
    }
}
