//package com.example.customer;
//
//import org.springframework.boot.SpringApplication;
//import org.springframework.boot.autoconfigure.SpringBootApplication;
//
//@SpringBootApplication
//public class CustomerApplication {
//
//	public static void main(String[] args) {
//		SpringApplication.run(CustomerApplication.class, args);
//	}
//
//}


package com.example.customer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.r2dbc.repository.config.EnableR2dbcRepositories;
import org.springframework.kafka.annotation.EnableKafka;
import reactor.core.publisher.Hooks;

/**
 * Main entry point for the Customer Service AI application.
 *
 * @SpringBootApplication - enables auto-configuration and component scanning.
 * @EnableR2dbcRepositories - activates reactive database repositories.
 * @EnableKafka - enables Kafka listener annotations.
 */
@SpringBootApplication
@EnableR2dbcRepositories
@EnableKafka
public class CustomerApplication {

	public static void main(String[] args) {
		// Enable trace logging for reactive streams debugging (optional)
		Hooks.enableAutomaticContextPropagation();
		SpringApplication.run(com.example.customer.CustomerApplication.class, args);
	}
}
