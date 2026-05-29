package com.micro.goal.repository;

import com.micro.goal.model.Achievement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<Achievement, Long> {
}