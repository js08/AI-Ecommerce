//package com.example.customer.repository;
//
//public class ConversationRepository {
//}


package com.example.customer.repository;

import com.example.customer.model.Conversation;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * Reactive repository for conversation history.
 */
public interface ConversationRepository extends ReactiveCrudRepository<Conversation, UUID> {

    /**
     * Find all conversations for a given user, ordered by newest first.
     */
    Flux<Conversation> findByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * Find conversations for a specific session, ordered chronologically.
     */
    Flux<Conversation> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    /**
     * Delete all conversations older than a certain time.
     */
    @Query("DELETE FROM conversations WHERE created_at < $1")
    Mono<Void> deleteOlderThan(Instant cutoff);
}
