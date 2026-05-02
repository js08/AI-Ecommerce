package com.micro.goal;

import org.springframework.boot.SpringApplication;

public class TestGoalApplication {

	public static void main(String[] args) {
		SpringApplication.from(GoalApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
