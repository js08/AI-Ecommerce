

//package com.example.customer.controller;
package com.example.customer.controller;

import com.example.customer.model;
import com.example.customer.model;
import com.example.customer.service.AIService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;


import org.springframework.http.codec.ServerSentEvent;
import reactor.core.publisher.Flux;
import java.time.Duration;

// Inside the controller class, add:

@Slf4j
@RestController
@RequestMapping("/api/v1/support")
@RequiredArgsConstructor
public class CustomerSupportController {

    private final AIService aiService;

    /**
     * Synchronous chat endpoint.
     */
    @PostMapping("/chat")
    public Mono<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        log.info("Chat request from user: {}", request.getUserId());
        return aiService.processMessage(request);
    }

    /**
     * Streaming chat endpoint (Server-Sent Events).
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> streamChat(@Valid @RequestBody ChatRequest request) {
        // For simplicity, we can implement streaming by returning chunks via Flux.
        // This would require a different approach (using OpenAI streaming API).
        // For brevity, we'll just return the full response as a single event.
        return aiService.processMessage(request)
                .map(ChatResponse::getReply)
                .flux();
    }



    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChat(@Valid @RequestBody ChatRequest request) {
        return aiService.processMessage(request)
                .flatMapMany(response -> Flux.just(
                        ServerSentEvent.builder(response.getReply())
                                .event("message")
                                .id(response.getSessionId())
                                .retry(Duration.ofSeconds(10))
                                .build()
                ));
    }
    /**
     * Health check.
     */
    @GetMapping("/health")
    public Mono<Map<String, String>> health() {
        return Mono.just(Map.of("status", "UP", "service", "customer-service-ai"));
    }
}