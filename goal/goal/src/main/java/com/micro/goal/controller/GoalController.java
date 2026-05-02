package com.micro.goal.controller;

//public class GoalController {
//}


//package com.micro.goalService.controller;

import com.micro.goal.model.Achievement;
import com.micro.goal.repository.GoalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController // 1. Marks this as an API
@RequestMapping("/api/goals") // 2. Base URL for this service
@CrossOrigin(origins = "http://localhost:3000") // 3. Allow React to connect
public class GoalController {

    @Autowired
    private GoalRepository goalRepository; // 4. Inject the MongoDB tool

    @GetMapping // 5. GET http://localhost:8082/api/goals
    public List<Achievement> getAllAchievements() {
        // 6. Fetch everything saved by the Kafka Consumer from MongoDB
        return goalRepository.findAll();
    }
}
