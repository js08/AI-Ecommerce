public class longestSubArraySumK {

    public static int longestSubArraySumK(int[] arr, int k) {

        int left = 0;
        int maxLen = 0;
        int sum = 0;

        for (int right = 0; right < arr.length; right++) {
            sum = sum + arr[right];

            while (sum > k) {
                sum = sum - arr[left];
                left = left + 1;
            }

            maxLen = Math.max(maxLen, right - left + 1);

        }

        return maxLen;

    }

    public static void main(String[] args) {

        int[] arr = { 1, 2, 1, 0, 1, 1, 0 };

        int k = 4;
        System.out.println(longestSubArraySumK(arr, k));

    }
}
