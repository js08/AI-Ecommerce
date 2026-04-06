//package com.example.customer.util;
//
//public class JsonUtils {
//}


package com.example.customer.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Utility for JSON operations with reactive Mono wrappers.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JsonUtils {

    private final ObjectMapper objectMapper;

    /**
     * Convert an object to JSON string, wrapping errors in Mono.
     */
    public Mono<String> toJson(Object obj) {
        return Mono.fromCallable(() -> objectMapper.writeValueAsString(obj))
                .onErrorResume(e -> {
                    log.error("JSON serialization error", e);
                    return Mono.empty();
                });
    }

    /**
     * Convert JSON string to object of given class.
     */
    public <T> Mono<T> fromJson(String json, Class<T> clazz) {
        return Mono.fromCallable(() -> objectMapper.readValue(json, clazz))
                .onErrorResume(e -> {
                    log.error("JSON deserialization error", e);
                    return Mono.empty();
                });
    }
}