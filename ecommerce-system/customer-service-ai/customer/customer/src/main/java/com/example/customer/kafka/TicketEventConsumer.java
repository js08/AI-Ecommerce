//package com.example.customer.kafka;
//
//public class TicketEventConsumer {
//}



package com.example.customer.kafka;

import com.example.customer.service.TicketService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Slf4j
@Component
@RequiredArgsConstructor
public class TicketEventConsumer {

    private final TicketService ticketService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "${kafka.topics.ticket-events}", groupId = "${spring.kafka.consumer.group-id}")
    public void consumeTicketEvent(String message) {
        try {
            JsonNode event = objectMapper.readTree(message);
            String userId = event.get("userId").asText();
            String subject = event.get("subject").asText();
            String description = event.get("description").asText();
            String orderId = event.has("orderId") ? event.get("orderId").asText() : null;

            ticketService.createTicket(userId, subject, description, orderId)
                    .subscribe(ticket -> log.info("Ticket created from Kafka event: {}", ticket.getId()));
        } catch (Exception e) {
            log.error("Failed to process ticket event", e);
        }
    }
}