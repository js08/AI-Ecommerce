//package com.example.customer.service;
//
//public class ConversationService {
//}



package com.example.customer.service;

import com.example.customer.model.Conversation;
import com.example.customer.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * Manages conversation history (store/retrieve from R2DBC).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository repository;

    /**
     * Save a conversation turn.
     */
    public Mono<Conversation> save(Conversation conversation) {
        if (conversation.getId() == null) {
            conversation.setId(UUID.randomUUID());
        }
        if (conversation.getCreatedAt() == null) {
            conversation.setCreatedAt(Instant.now());
        }
        return repository.save(conversation);
    }

    /**
     * Get recent messages for a session (limit 10).
     */
    public Flux<Conversation> getSessionHistory(String sessionId, int limit) {
        return repository.findBySessionIdOrderByCreatedAtAsc(sessionId)
                .take(limit);
    }

    /**
     * Build context for OpenAI from recent messages.
     */
    public Mono<String> buildContext(String sessionId) {
        return getSessionHistory(sessionId, 5)
                .map(conv -> "User: " + conv.getMessage() + "\nAI: " + conv.getResponse())
                .collectList()
                .map(list -> String.join("\n", list));
    }
}