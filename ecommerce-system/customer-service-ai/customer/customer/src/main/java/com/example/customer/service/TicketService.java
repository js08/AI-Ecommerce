

package com.example.customer.service;

import com.example.customer.model.Ticket;
import com.example.customer.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;

    /**
     * Create a support ticket when escalation is needed.
     */
    public Mono<Ticket> createTicket(String userId, String subject, String description, String orderId) {
        Ticket ticket = Ticket.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .orderId(orderId)
                .subject(subject)
                .description(description)
                .status("OPEN")
                .priority("MEDIUM")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return ticketRepository.save(ticket)
                .doOnSuccess(t -> log.info("Created ticket {} for user {}", t.getId(), userId));
    }
}