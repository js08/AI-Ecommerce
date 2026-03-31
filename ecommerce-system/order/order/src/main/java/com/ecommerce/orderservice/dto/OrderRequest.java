//package com.example.order.dto;
//
//public class OrderRequest {
//
//}

package com.ecommerce.orderservice.dto;

// Validation annotations
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

/**
 * DTO = Data Transfer Object
 * Used to receive data from client (HTTP request body)
 * 
 * Separates API contract from internal entity model
 * Allows us to change entity without breaking API
 */
@Data
public class OrderRequest {
    
    /**
     * @NotNull - Value cannot be null
     * @Valid - Tells Spring to validate nested objects recursively
     */
    @NotNull(message = "Shipping address is required")
    @Valid
    private AddressRequest shippingAddress;
    
    /**
     * @NotBlank - String cannot be null, empty, or only whitespace
     */
    @NotBlank(message = "Payment method is required")
    private String paymentMethod;
    
    /**
     * @NotEmpty - Collection cannot be null or empty
     * @Valid - Validate each item in the list
     */
    @NotEmpty(message = "Order must contain at least one item")
    @Valid
    private List<OrderItemRequest> items;
    
    // Inner class for address validation
    @Data
    public static class AddressRequest {
        @NotBlank(message = "Street is required")
        private String street;
        
        @NotBlank(message = "City is required")
        private String city;
        
        @NotBlank(message = "State is required")
        private String state;
        
        @Pattern(regexp = "\\d{5}", message = "Zip code must be 5 digits")
        private String zipCode;
        
        @NotBlank(message = "Country is required")
        private String country;
    }
    
    @Data
    public static class OrderItemRequest {
        @NotNull(message = "Product ID is required")
        private Long productId;
        
        @Min(value = 1, message = "Quantity must be at least 1")
        @Max(value = 999, message = "Quantity cannot exceed 999")
        private Integer quantity;
    }
}
