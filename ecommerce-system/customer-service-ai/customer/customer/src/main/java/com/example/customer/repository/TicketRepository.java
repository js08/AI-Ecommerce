//package com.example.customer.repository;
//
//public class TicketRepository {
//}


package com.ecommerce.customerservice.repository;

import com.ecommerce.customerservice.model.Ticket;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

import java.util.UUID;

public interface TicketRepository extends ReactiveCrudRepository<Ticket, UUID> {
    Flux<Ticket> findByUserIdOrderByCreatedAtDesc(String userId);
    Flux<Ticket> findByStatus(String status);
}