//package com.example.order;
//
//import org.springframework.boot.SpringApplication;
//import org.springframework.boot.autoconfigure.SpringBootApplication;
//
//@SpringBootApplication
//public class OrderApplication {
//
//	public static void main(String[] args) {
//		SpringApplication.run(OrderApplication.class, args);
//	}
//
//}


// Package declaration - organizes code in folders
package com.example.ecommerce.orderservice;

// Import necessary Spring Boot annotations
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * @SpringBootApplication - This is the most important annotation in Spring Boot
 * It combines three annotations:
 * 1. @Configuration - Marks this class as a source of bean definitions
 * 2. @EnableAutoConfiguration - Tells Spring to automatically configure based on dependencies
 * 3. @ComponentScan - Scans for components in the current package
 * 
 * This is the entry point of our Spring Boot application
 */
@SpringBootApplication

/**
 * @EnableFeignClients - Enables Feign client for making HTTP calls to other services
 * Feign makes REST API calls look like calling a local method
 */
@EnableFeignClients

/**
 * @EnableAsync - Enables asynchronous method execution
 * Methods annotated with @Async will run in separate threads
 */
@EnableAsync

/**
 * @EnableTransactionManagement - Enables Spring's annotation-driven transaction management
 * Methods annotated with @Transactional will run in database transactions
 */
@EnableTransactionManagement
public class OrderServiceApplication {
    
    /**
     * The main method - Java's entry point for any application
     * 
     * @param args Command line arguments passed to the application
     * 
     * SpringApplication.run() does several things:
     * 1. Starts embedded Tomcat server
     * 2. Creates Spring application context (container for all beans)
     * 3. Scans for components and configurations
     * 4. Starts the application and listens for requests
     */
    public static void main(String[] args) {
        // Run the Spring Boot application
        SpringApplication.run(OrderServiceApplication.class, args);
        
        // This line only executes after application starts successfully
        System.out.println("✅ Order Service Started Successfully on port 8080!");
    }
}
