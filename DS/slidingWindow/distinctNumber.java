
import java.util.HashMap;

public class distinctNumber {
    public static int distinctNumber(int[] arr, int k) {
        // Initialize the maximum length we've found
        int maxLength = 0; 
        
        // The 'left' boundary of our sliding window
        int left = 0; 
        
        // HashMap to store: Key (the number) -> Value (how many times it's in our window)
        HashMap<Integer, Integer> counts = new HashMap<>();

        // Loop 'right' from the start to the end of the array
        for (int right = 0; right < arr.length; right++) {
            int currentNum = arr[right];

            // 1. Add currentNum to the map. 
            // getOrDefault handles the case where the number isn't in the map yet.
            counts.put(currentNum, counts.getOrDefault(currentNum, 0) + 1);

            // 2. While we have more than 'k' unique numbers in our map
            while (counts.size() > k) {
                int numberToExit = arr[left];
                
                // Reduce the count of the number exiting from the left
                counts.put(numberToExit, counts.get(numberToExit) - 1);

                // IMPORTANT: If the count reaches 0, remove it entirely 
                // so the map size actually decreases.
                if (counts.get(numberToExit) == 0) {
                    counts.remove(numberToExit);
                }
                
                // Slide the left wall of the window forward
                left++;
            }

            // 3. Calculate current window size: (right - left + 1)
            // Compare it to our record (maxLength) and keep the bigger one.
            maxLength = Math.max(maxLength, right - left + 1);
        }

        return maxLength;
    }

    public static void main(String[] args) {
        int[] nums = {1, 2, 1, 2, 3};
        int k = 2;
        System.out.println(distinctNumber(nums, k)); // Output: 4
    }
}

