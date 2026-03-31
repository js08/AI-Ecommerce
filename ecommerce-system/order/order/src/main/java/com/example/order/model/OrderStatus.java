//package com.example.order.model;
//
//public class OrderStatus {
//
//}



package com.ecommerce.orderservice.model;

/**
 * Enum (Enumeration) - Defines a fixed set of constants
 * This represents all possible states an order can be in
 * 
 * Enums are type-safe - you can only use these predefined values
 */
public enum OrderStatus {
    /**
     * Order is created but not yet processed
     * User can still cancel
     */
    PENDING("Pending", 1),
    
    /**
     * Payment has been processed successfully
     * Inventory is reserved
     */
    CONFIRMED("Confirmed", 2),
    
    /**
     * Order has been packed and handed to shipping carrier
     */
    SHIPPED("Shipped", 3),
    
    /**
     * Customer has received the order
     */
    DELIVERED("Delivered", 4),
    
    /**
     * User cancelled the order before shipping
     */
    CANCELLED("Cancelled", 5),
    
    /**
     * Payment failed or inventory not available
     */
    FAILED("Failed", 6),
    
    /**
     * Payment processing failed
     */
    PAYMENT_FAILED("Payment Failed", 7);
    
    // Fields for each enum value
    private final String displayName;  // Human-readable name
    private final int code;            // Numeric code for database storage
    
    /**
     * Constructor - Called when creating each enum constant
     * @param displayName Display name for UI
     * @param code Numeric code for database
     */
    OrderStatus(String displayName, int code) {
        this.displayName = displayName;
        this.code = code;
    }
    
    // Getter methods
    public String getDisplayName() {
        return displayName;
    }
    
    public int getCode() {
        return code;
    }
    
    /**
     * Static method to get enum from code
     * @param code Numeric code
     * @return Matching OrderStatus or null
     */
    public static OrderStatus fromCode(int code) {
        for (OrderStatus status : OrderStatus.values()) {
            if (status.code == code) {
                return status;
            }
        }
        return null;
    }
}