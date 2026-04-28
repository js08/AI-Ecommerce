package com.micro.raceTime;

import org.springframework.boot.SpringApplication;

public class TestRaceTimeApplication {

	public static void main(String[] args) {
		SpringApplication.from(RaceTimeApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
