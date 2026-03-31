//package com.example.order.model;
//
//public class Order {
//
//}


package com.ecommerce.orderservice.model;

// JPA annotations for database mapping
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * @Entity - Marks this class as a JPA entity (maps to a database table)
 * JPA = Java Persistence API - standard for ORM (Object-Relational Mapping)
 * 
 * This class represents the "orders" table in PostgreSQL
 */
@Entity

/**
 * @Table - Specifies the database table name
 * If omitted, table name defaults to class name (Order)
 */
@Table(name = "orders")

/**
 * Lombok annotations - Automatically generate boilerplate code
 * @Data - Generates getters, setters, equals, hashCode, toString
 * @Builder - Creates builder pattern for object creation
 * @NoArgsConstructor - Generates empty constructor
 * @AllArgsConstructor - Generates constructor with all fields
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    
    /**
     * @Id - Marks this field as the primary key
     * @GeneratedValue - Specifies how the ID is generated
     * strategy = GenerationType.IDENTITY - Uses database auto-increment
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * @Column - Specifies column properties
     * unique = true - No two orders can have same order number
     * nullable = false - This field cannot be null
     */
    @Column(name = "order_number", unique = true, nullable = false, length = 50)
    private String orderNumber;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    /**
     * @Enumerated(EnumType.STRING) - Stores enum as String in database
     * Alternative: EnumType.ORDINAL stores as number (0,1,2...)
     * String is more readable for debugging
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;
    
    /**
     * BigDecimal is used for money because it handles decimal precision correctly
     * float/double can have rounding errors
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal tax;
    
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal shippingCost;
    
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    
    /**
     * @Column(columnDefinition = "jsonb") - PostgreSQL JSONB column type
     * Stores JSON data directly in database
     */
    @Column(columnDefinition = "jsonb")
    private String shippingAddress;  // Stored as JSON string
    
    @Column(name = "payment_method", length = 50)
    private String paymentMethod;
    
    @Column(name = "payment_status", length = 50)
    private String paymentStatus;
    
    /**
     * @CreationTimestamp - Hibernate automatically sets this when entity is created
     * Never changes after initial insert
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * @UpdateTimestamp - Hibernate automatically updates this when entity changes
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    /**
     * @OneToMany - One order has many order items
     * mappedBy = "order" - The 'order' field in OrderItem owns the relationship
     * cascade = CascadeType.ALL - When we save/delete order, also save/delete items
     * fetch = FetchType.LAZY - Items are loaded only when accessed (performance)
     * orphanRemoval = true - If item removed from list, delete from database
     */
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, 
               fetch = FetchType.LAZY, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
    
    /**
     * Helper method to add an item to order
     * Maintains both sides of the bidirectional relationship
     * 
     * @param item The order item to add
     */
    public void addItem(OrderItem item) {
        items.add(item);          // Add to list
        item.setOrder(this);      // Set the order reference in the item
    }
    
    /**
     * Helper method to remove an item from order
     * @param item The order item to remove
     */
    public void removeItem(OrderItem item) {
        items.remove(item);       // Remove from list
        item.setOrder(null);      // Remove the order reference
    }
}