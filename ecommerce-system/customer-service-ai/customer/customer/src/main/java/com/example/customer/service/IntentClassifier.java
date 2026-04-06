//package com.example.customer.service;
//
//public class IntentClassifier {
//}


package com.example.customer.service;

import com.example.customer.client.OpenAiClient;
import com.example.customer.model.dto.IntentResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * Service that uses OpenAI to classify user intent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IntentClassifier {

    private final OpenAiClient openAiClient;

    public Mono<IntentResult> classify(String userMessage) {
        return openAiClient.classifyIntent(userMessage)
                .doOnNext(result -> log.info("Classified intent: {} (confidence={})", result.getIntent(), result.getConfidence()));
    }
}
