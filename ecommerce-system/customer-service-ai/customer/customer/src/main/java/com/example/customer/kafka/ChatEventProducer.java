//package com.example.customer.kafka;
//
//public class ChatEventProducer {
//}


package com.ecommerce.customerservice.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Producer for chat events to Kafka.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChatEventProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${kafka.topics.chat-events}")
    private String chatEventsTopic;

    public void sendChatEvent(String userId, String sessionId, String userMessage, String aiReply, String intent) {
        Map<String, Object> event = new HashMap<>();
        event.put("userId", userId);
        event.put("sessionId", sessionId);
        event.put("userMessage", userMessage);
        event.put("aiReply", aiReply);
        event.put("intent", intent);
        event.put("timestamp", Instant.now().toString());

        try {
            String json = objectMapper.writeValueAsString(event);
            kafkaTemplate.send(chatEventsTopic, userId, json);
            log.debug("Sent chat event to Kafka");
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize chat event", e);
        }
    }
}