//package com.example.customer.repository;
//
//public class TicketRepository {
//}


package com.example.customer.repository;

import com.example.customer.model.Ticket;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

import java.util.UUID;

public interface TicketRepository extends ReactiveCrudRepository<Ticket, UUID> {
    Flux<Ticket> findByUserIdOrderByCreatedAtDesc(String userId);
    Flux<Ticket> findByStatus(String status);
}