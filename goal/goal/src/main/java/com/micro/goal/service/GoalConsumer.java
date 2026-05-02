//package com.micro.goal.service;
//
////public class GoalConsumer {
////}
////
////
////
////package com.micro.goalService.consumer; // The folder where our listeners live
//
//// 1. Imports: Bringing in the Model, the Repository, and Kafka tools
//import com.micro.goal.model.Achievement;
//import com.micro.goal.repository.GoalRepository;
//import com.micro.goal.dto.WindowResult; // The DTO shared between services
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.kafka.annotation.KafkaListener;
//import org.springframework.stereotype.Service;
//import java.time.LocalDateTime;
//
//@Service // Tells Spring: "This is a background worker, keep it running!"
//public class GoalConsumer {
//
//    @Autowired
//    private GoalRepository goalRepository; // Inject our MongoDB tool to save data
//
//    /**
//     * This is the "Listener" method.
//     * It constantly watches the Kafka topic for new messages.
//     */
//    @KafkaListener(topics = "goal-topic", groupId = "goal-service-group")
//    public void consumeGoalEvent(WindowResult result) {
//
//        // 2. LOGGING: Print to the console so we can see it working in real-time
//        System.out.println("📩 Kafka Message Received: Found a window with sum " + result.getTotalSum());
//
//        // 3. LOGIC: Transform the raw window data into a "User Achievement"
//        // We create a nice message for the user.
//        String achievementMessage = "🏆 Milestone Reached! You hit a target sum of "
//                + result.getTotalSum() + "ms!";
//
//        // 4. MAPPING: Create a new Achievement object for MongoDB
//        Achievement newAchievement = new Achievement(
//                achievementMessage,
//                result.getTotalSum(),
//                LocalDateTime.now() // Record exactly when this happened
//        );
//
//        // 5. PERSIST: Save this achievement into the MongoDB 'achievements' collection
//        goalRepository.save(newAchievement);
//
//        // 6. CONFIRMATION: Show that it was successfully saved to NoSQL
//        System.out.println("⭐ Achievement successfully stored in MongoDB!");
//    }
//}