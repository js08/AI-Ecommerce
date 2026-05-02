package com.micro.raceTime.service; // Defines the location of this file in the project

// --- IMPORTS: Bringing in the tools we need ---
import com.micro.raceTime.model.Lap; // The object representing a single race lap
import com.micro.raceTime.model.WindowResult; // The object we use to bundle results
import org.springframework.beans.factory.annotation.Autowired; // For dependency injection
import org.springframework.kafka.core.KafkaTemplate; // The tool used to send messages to Kafka
import org.springframework.kafka.support.SendResult; // Holds the result of a Kafka send attempt
import org.springframework.stereotype.Service; // Marks this as a Spring-managed service class

import java.util.ArrayList; // Used to create dynamic lists
import java.util.List; // The standard interface for lists
import java.util.concurrent.CompletableFuture; // For handling background (asynchronous) tasks
import java.util.stream.Collectors; // Used to transform data collections

@Service // Tells Spring to create and manage one instance of this class
public class AnalyticsService {

    @Autowired // Automatically connects the Kafka tool from the Spring context
    private KafkaTemplate<String, WindowResult> kafkaTemplate; // Our "messenger" to send data to Kafka

    /**
     * Main method: Takes a list of laps and a window size 'k', finds even sums, and alerts Kafka.
     */
    public List<WindowResult> getEvenSumWindows(List<Lap> laps, int k) {

        // Transform the list of Lap objects into a simple list of numbers (millisecond durations)
        List<Integer> arr = laps.stream()
                .map(Lap::getDurationMs) // Reach inside each lap and grab the time
                .collect(Collectors.toList()); // Put all those times into a new list

        List<WindowResult> results = new ArrayList<>(); // A list to store all the even windows we find
        int currentSum = 0; // A variable to keep track of the total sum inside our "window"

        // Loop through the array from left to right (this is our 'sliding window')
        for (int right = 0; right < arr.size(); right++) {

            currentSum += arr.get(right); // Add the newest element on the right to our sum

            // If the window has grown larger than size 'k', we must remove the oldest element
            if (right >= k) {
                currentSum -= arr.get(right - k); // Subtract the element that just fell out of the window
            }

            // Once we have processed at least 'k' elements, our window is full and ready to check
            if (right >= k - 1) {

                // Check if the current window total is an even number (remainder of division by 2 is 0)
                if (currentSum % 2 == 0) {

                    // Create a sub-list containing exactly the elements currently inside the window
                    List<Integer> windowElements = new ArrayList<>(arr.subList(right - k + 1, right + 1));

                    // Package the elements and their sum into a Result object
                    WindowResult foundWindow = new WindowResult(windowElements, currentSum);

                    results.add(foundWindow); // Add this finding to our local list to return to the caller

                    // Call our helper method to broadcast this finding to the rest of the system via Kafka
                    sendGoalToKafka(foundWindow);
                }
            }
        }
        return results; // Return the full list of even windows found during the process
    }

    /**
     * Helper Method: Handles the technical details of talking to the Kafka Broker.
     */
    private void sendGoalToKafka(WindowResult result) {

        // Start the send process to the "goal-topic". This happens in the background.
        CompletableFuture<SendResult<String, WindowResult>> future =
                kafkaTemplate.send("goal-topic", result);

        // Wait for Kafka to respond with either a "Success" or an "Error"
        future.whenComplete((success, ex) -> {

            if (ex == null) {
                // If ex (exception) is null, it worked! Print where the message was stored.
                System.out.println("✅ Sent to Kafka! Offset: " + success.getRecordMetadata().offset());
            } else {
                // If there is an exception, the broker might be down. Log the error message.
                System.err.println("❌ Kafka Error: " + ex.getMessage());
            }
        });
    }
}