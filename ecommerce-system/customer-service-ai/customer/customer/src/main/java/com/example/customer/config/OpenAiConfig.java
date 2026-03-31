//package com.example.customer.config;
//
//public class OpenAiConfig {
//}


package com.ecommerce.customerservice.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for OpenAI.
 * Binds to `openai.*` properties in application.yml.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "openai")
public class OpenAiConfig {
    private String apiKey;
    private String model;
    private int maxTokens;
    private java.time.Duration timeout;
}
