//package com.example.customer.model;
//
//public class Ticket {
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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("tickets")
public class Ticket {
    @Id
    private UUID id;
    private String userId;
    private String orderId;
    private String subject;
    private String description;
    private String status;       // OPEN, IN_PROGRESS, RESOLVED, CLOSED
    private String priority;     // LOW, MEDIUM, HIGH, URGENT
    private String assignedTo;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant closedAt;
}
