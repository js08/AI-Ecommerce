package com.micro.goal.dto;

//public class WindowResult {
//}
//
//
//package com.micro.goal.dto;

/**
 * Data Transfer Object (DTO) used to receive windowed
 * aggregation results from Kafka.
 */
public class WindowResult {

    // Based on Achievement.java, this represents the summed time/value
    private int totalSum;

    // Default constructor (required for JSON deserialization by Jackson/Kafka)
    public WindowResult() {}

    public WindowResult(int totalSum) {
        this.totalSum = totalSum;
    }

    // Getter matches result.getTotalSum() in GoalConsumer
    public int getTotalSum() {
        return totalSum;
    }

    public void setTotalSum(int totalSum) {
        this.totalSum = totalSum;
    }

    @Override
    public String toString() {
        return "WindowResult{" +
                "totalSum=" + totalSum +
                '}';
    }
}