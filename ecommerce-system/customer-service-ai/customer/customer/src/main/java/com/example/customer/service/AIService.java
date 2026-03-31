package com.ecommerce.customerservice.service;

import com.ecommerce.customerservice.client.OpenAiClient;
import com.ecommerce.customerservice.kafka.ChatEventProducer;
import com.ecommerce.customerservice.model.Conversation;
import com.ecommerce.customerservice.model.dto.ChatRequest;
import com.ecommerce.customerservice.model.dto.ChatResponse;
import com.ecommerce.customerservice.model.dto.IntentResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.*;

/**
 * Core AI orchestration service. It ties together intent classification,
 * conversation memory, OpenAI chat, and optional ticket creation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AIService {

    private final IntentClassifier intentClassifier;
    private final ConversationService conversationService;
    private final OpenAiClient openAiClient;
    private final TicketService ticketService;
    private final ChatEventProducer chatEventProducer;

    /**
     * Main entry point: process a user message and produce an AI response.
     */
    public Mono<ChatResponse> processMessage(ChatRequest request) {
        String sessionId = request.getSessionId() != null ? request.getSessionId() : UUID.randomUUID().toString();

        // 1. Classify intent
        return intentClassifier.classify(request.getMessage())
                .flatMap(intentResult -> {
                    // 2. Build conversation context from history
                    return conversationService.buildContext(sessionId)
                            .flatMap(context -> {
                                // 3. Build messages for OpenAI
                                List<Map<String, String>> messages = buildMessages(context, request.getMessage(), intentResult);

                                // 4. Call OpenAI
                                return openAiClient.chatCompletion(messages)
                                        .flatMap(aiReply -> {
                                            // 5. Save conversation
                                            Conversation conv = Conversation.builder()
                                                    .sessionId(sessionId)
                                                    .userId(request.getUserId())
                                                    .message(request.getMessage())
                                                    .response(aiReply)
                                                    .intent(intentResult.getIntent())
                                                    .confidence(intentResult.getConfidence())
                                                    .createdAt(Instant.now())
                                                    .build();
                                            return conversationService.save(conv)
                                                    .thenReturn(aiReply);
                                        })
                                        .map(aiReply -> {
                                            // 6. Build response
                                            List<String> suggestions = generateSuggestions(intentResult.getIntent());
                                            return ChatResponse.builder()
                                                    .reply(aiReply)
                                                    .intent(intentResult.getIntent())
                                                    .confidence(intentResult.getConfidence())
                                                    .suggestions(suggestions)
                                                    .sessionId(sessionId)
                                                    .timestamp(Instant.now())
                                                    .build();
                                        });
                            });
                })
                .doOnNext(response -> {
                    // Optionally send event to Kafka for analytics
                    chatEventProducer.sendChatEvent(request.getUserId(), sessionId, request.getMessage(), response.getReply(), response.getIntent());
                })
                .doOnError(e -> log.error("Error processing message", e))
                .onErrorResume(e -> Mono.just(ChatResponse.builder()
                        .reply("I'm sorry, I'm having technical difficulties. Please try again later.")
                        .intent("ERROR")
                        .confidence(0.0)
                        .suggestions(List.of("Refresh and retry", "Contact human support"))
                        .sessionId(sessionId)
                        .timestamp(Instant.now())
                        .build()));
    }

    /**
     * Build the message list for OpenAI, including system prompt, context, and current message.
     */
    private List<Map<String, String>> buildMessages(String context, String userMessage, IntentResult intentResult) {
        List<Map<String, String>> messages = new ArrayList<>();

        // System prompt (with dynamic intent hint)
        String systemPrompt = String.format("""
                You are a friendly customer support AI for an e-commerce platform.
                User intent: %s (confidence: %.2f).
                Keep responses concise and helpful. If the user wants to track an order, ask for the order number.
                If they want to return an item, guide them through the process.
                """, intentResult.getIntent(), intentResult.getConfidence());
        messages.add(Map.of("role", "system", "content", systemPrompt));

        // Add conversation history (if any)
        if (context != null && !context.isEmpty()) {
            messages.add(Map.of("role", "assistant", "content", "Previous conversation:\n" + context));
        }

        // Current user message
        messages.add(Map.of("role", "user", "content", userMessage));

        return messages;
    }

    /**
     * Generate follow-up suggestions based on intent.
     */
    private List<String> generateSuggestions(String intent) {
        return switch (intent) {
            case "TRACK_ORDER" -> List.of("Track another order", "Check shipping policy", "Contact carrier");
            case "RETURN_REQUEST" -> List.of("Start a return", "View return policy", "Check refund status");
            case "COMPLAINT" -> List.of("Talk to a human", "File a complaint", "Request callback");
            case "PRODUCT_QUESTION" -> List.of("Compare products", "Check reviews", "See similar items");
            default -> List.of("Track order", "Ask about a product", "Get return help");
        };
    }
}