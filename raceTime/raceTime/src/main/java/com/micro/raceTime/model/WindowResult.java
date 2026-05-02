//package com.micro.raceTime.model;
//
//public class WindowResult {
//}


package com.micro.raceTime.model;

import java.util.List;

public class WindowResult {
    private List<Integer> elements; // The actual lap times in this window
    private int totalSum;           // The sum of those laps

    public WindowResult(List<Integer> elements, int totalSum) {
        this.elements = elements;
        this.totalSum = totalSum;
    }

    // Getters are required so Spring can convert this to JSON
    public List<Integer> getElements() { return elements; }
    public int getTotalSum() { return totalSum; }
}
