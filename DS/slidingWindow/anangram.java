
import java.util.*;

public class anangram {
    public List<Integer> anangram(String s, String p) {
        // Initialize the maximum length we've found
        List<Integer>  result= new ArrayList<>();
        if (s.length() < p.length()) {
            return result;
        }

        Map<Character, Integer> neededChars = new HashMap<>();
       
    }

    public static void main(String[] args) {
        int[] nums = { 1, 2, 1, 2, 3 };
        int k = 2;
        System.out.println(anangram(nums, k)); // Output: 4
    }
}
