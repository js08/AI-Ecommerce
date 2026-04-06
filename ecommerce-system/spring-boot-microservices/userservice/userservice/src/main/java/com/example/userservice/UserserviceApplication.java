//package com.example.userservice;
//
//import org.springframework.boot.SpringApplication;
//import org.springframework.boot.autoconfigure.SpringBootApplication;
//
//@SpringBootApplication
//public class UserserviceApplication {
//
//	public static void main(String[] args) {
//		SpringApplication.run(UserserviceApplication.class, args);
//	}
//
//}


package com.example.userservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
//import org.springframework.data.r2dbc.repository.config.EnableR2dbcRepositories;

@SpringBootApplication
//@EnableR2dbcRepositories   // Enables reactive R2DBC repositories
public class UserserviceApplication {
	public static void main(String[] args) {
		SpringApplication.run(UserserviceApplication.class, args);
		System.out.print("testing  micro here--->");
	}
}
