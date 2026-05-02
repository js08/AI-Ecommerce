import java.util.HashSet;

public class LongestSubString {
    public static int longestSubString(String str) {

         int maxLength = 0;
    int charSet = new Set();
    int left = 0;

        HashSet<Character> charSet = new HashSet<>();

        for (int right = 0; right < str.length; right++) {
        while (charSet.contains(str[right])) {
            charSet.remove(str[left]);
            left = left + 1;

        }

        charSet.add(str[right]);
        maxLength = Math.max(maxLength, right - left + 1)

       // let currentWindowSize = right -left + 1;

    }

    public static void main(String[] args){

    }

}