//package com.example.customer.model;
//
//public class Conversation {
//}


package com.ecommerce.customerservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity representing a single conversation turn (user message and AI response).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("conversations")
public class Conversation {
    @Id
    private UUID id;
    private String userId;          // User identifier (could be from auth)
    private String sessionId;       // Unique session ID for grouping turns
    private String message;         // User's message
    private String response;        // AI's response
    private String intent;          // Detected intent (e.g., "TRACK_ORDER")
    private Double confidence;      // Confidence of intent detection
    private Instant createdAt;      // Timestamp
}
