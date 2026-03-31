//package com.example.customer.client;
//
//public class OpenAiClient {
//}



package com.ecommerce.customerservice.client;

import com.ecommerce.customerservice.model.dto.IntentResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * Reactive client for OpenAI API (Chat Completions).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiClient {

    private final WebClient openAiWebClient;
    private final ObjectMapper objectMapper;

    @Value("${openai.api-key}")
    private String apiKey;

    @Value("${openai.model}")
    private String model;

    @Value("${openai.max-tokens:500}")
    private int maxTokens;

    /**
     * Send a chat request to OpenAI and get the completion.
     *
     * @param messages List of message objects (role, content)
     * @return Mono<String> with the assistant's reply
     */
    public Mono<String> chatCompletion(List<Map<String, String>> messages) {
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", messages,
                "max_tokens", maxTokens,
                "temperature", 0.7
        );

        return openAiWebClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(response -> response.path("choices").get(0).path("message").path("content").asText())
                .doOnError(e -> log.error("OpenAI call failed", e))
                .onErrorResume(e -> Mono.just("I'm sorry, I'm having trouble responding right now. Please try again later."));
    }

    /**
     * Classify intent of a user message.
     */
    public Mono<IntentResult> classifyIntent(String userMessage) {
        String systemPrompt = """
            You are an intent classifier for an e-commerce customer support system.
            Classify the user's message into one of these intents:
            - TRACK_ORDER
            - PRODUCT_QUESTION
            - RETURN_REQUEST
            - COMPLAINT
            - PAYMENT_ISSUE
            - SHIPPING_INFO
            - GENERAL

            Respond with JSON: {"intent": "INTENT_NAME", "confidence": 0.95, "explanation": "short reason"}
            """;

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userMessage)
        );

        return chatCompletion(messages)
                .flatMap(json -> {
                    try {
                        JsonNode node = objectMapper.readTree(json);
                        return Mono.just(IntentResult.builder()
                                .intent(node.get("intent").asText())
                                .confidence(node.get("confidence").asDouble())
                                .explanation(node.get("explanation").asText())
                                .build());
                    } catch (Exception e) {
                        log.error("Failed to parse intent JSON", e);
                        return Mono.just(IntentResult.builder()
                                .intent("GENERAL")
                                .confidence(0.5)
                                .explanation("Fallback due to parsing error")
                                .build());
                    }
                });
    }
}