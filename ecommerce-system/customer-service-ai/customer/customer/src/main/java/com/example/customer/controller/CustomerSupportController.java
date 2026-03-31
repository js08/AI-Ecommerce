

package com.ecommerce.customerservice.controller;

import com.ecommerce.customerservice.model.dto.ChatRequest;
import com.ecommerce.customerservice.model.dto.ChatResponse;
import com.ecommerce.customerservice.service.AIService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

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

    /**
     * Health check.
     */
    @GetMapping("/health")
    public Mono<Map<String, String>> health() {
        return Mono.just(Map.of("status", "UP", "service", "customer-service-ai"));
    }
}