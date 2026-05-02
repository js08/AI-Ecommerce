// 1. Package: The address of this file.
// Note: Usually, we use lowercase for package names (e.g., .controller).
package com.micro.raceTime.LapController;

// 2. Imports: Bringing in the Model, the Repository, and Spring's Web tools.
import com.micro.raceTime.model.Lap;
import com.micro.raceTime.model.WindowResult;
import com.micro.raceTime.repository.LapRepository;
import com.micro.raceTime.service.AnalyticsService;
import org.springframework.beans.factory.annotation.Autowired; // For "Injection"
import org.springframework.web.bind.annotation.*; // For Web mapping (Get, Post, etc.)
import java.util.List; // To handle lists of laps

// 3. @RestController: Tells Spring, "This class is an API."
// It automatically converts the data we return (like Lap objects) into JSON text.
@RestController

// 4. @RequestMapping: The "Base URL."
// Any request sent to http://localhost:8080/api/laps will be sent to THIS class.
@RequestMapping("/api/laps")

// 5. @CrossOrigin: A security feature.
// By default, a server on 8080 won't talk to a browser on 3000. This "allows" your React app.
@CrossOrigin(origins = "http://localhost:3000")
public class LapController {

    // 6. @Autowired: This is Dependency Injection.
    // We don't say "new LapRepository()". Spring finds the Repository it created and
    // "plugs it in" here automatically.
    @Autowired
    private LapRepository lapRepository;

    // 7. @PostMapping: Used for CREATING data.
    // When React sends a POST request, this method runs.
//    @PostMapping
//    public Lap saveLap(@RequestBody Lap lap) {
//        // @RequestBody: Tells Spring to take the JSON from the request and
//        // turn it back into a Java "Lap" object.
//        return lapRepository.save(lap); // Saves to Postgres and returns the result
//    }

    @PostMapping("/save")
    public Lap saveLap(@RequestBody Lap lap) {
        return lapRepository.save(lap);
    }

    // 8. @GetMapping: Used for READING data.
    @GetMapping("/get")
    public List<Lap> getAllLaps() {
        // Calls the Repository to get all rows and returns them as a List
        return lapRepository.findAll();
    }


    @Autowired
    private AnalyticsService analyticsService; // Plug in the brain!

//    @GetMapping("/analyze")
//    public int getPatterns(@RequestParam int k, @RequestParam int x) {
//        List<Lap> allLaps = lapRepository.findAll();
//        return analyticsService.countWorkoutPatterns(allLaps, k, x);
//    }
//
//
//    @GetMapping("/analyze-even")
//    public int getEvenPatterns(@RequestParam int k) {
//        // 1. Get all laps from the Postgres DB
//        List<Lap> allLaps = lapRepository.findAll();
//
//        // 2. Pass them to the service
//        return analyticsService.countEvenSumWindows(allLaps, k);
//    }


    @GetMapping("/analyze-even-list")
    public List<WindowResult> getEvenPatternsList(@RequestParam int k) {
        List<Lap> allLaps = lapRepository.findAll();
        return analyticsService.getEvenSumWindows(allLaps, k);
    }

    // 9. @DeleteMapping: Used for REMOVING data.
    // The "{id}" is a variable in the URL (e.g., /api/laps/5).
    @DeleteMapping("/{id}")
    public void deleteLap(@PathVariable Long id) {
        // @PathVariable: Pulls the "5" out of the URL and gives it to the 'id' variable.
        lapRepository.deleteById(id);
    }
}