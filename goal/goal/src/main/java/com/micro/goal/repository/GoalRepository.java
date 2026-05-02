package com.micro.goal.repository;

//public class GoalRepository {
//}

//package com.micro.goalService.repository;

import com.micro.goal.model.Achievement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

// 1. MongoRepository: Gives us save(), findAll(), delete(), etc., for MongoDB
@Repository
public interface GoalRepository extends MongoRepository<Achievement, String> {
    // No code needed here! Spring generates the logic automatically.
}
