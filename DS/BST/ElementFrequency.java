// how to find the frequency of the below elements in js without using hash map

// [1,,11,2,2,3,3,41,4,1,2,3,3,2]

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class ElementFrequency {
    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(Arrays.asList(1, null, 11, 2, 2, 3, 3, 41, 4, 1, 2, 3, 3, 2));
        list.removeIf(e1 -> e1 == null);
        Collections.sort(list);

        int currentCount = 1;

        for (int i = 1; i < list.size(); i++) {

            if (list.get(i).equals(list.get(i - 1))) {
                currentCount++;
            } else {
                System.out.println("Element" + list.get(i-1) + " -> Frequency:" + currentCount);
                currentCount = 1;
            }

        }

        if (!list.isEmpty()) {
            System.out.println("Element" + list.get(list.size() - 1) + " -> Frequency:" + currentCount);
        }
    }
}