// 6. Count Subarrays of Size K with Sum Equal to X
// Problem Statement:
// You are given an array of integers, an integer K, and a target value X. Count the number of contiguous subarrays of size exactly K whose elements add up to X.
// Input:
// Array = [1, 2, 3, 1, 1, 1, 1]
// K = 3
// X = 6
// Output:
// 2

public class sumSubArray {

    public static int countSubArray(int[] arr, int k) {

        int left = 0;
        int targetValue = 6;
        let sum = 0;

        for (int right = 0; right < arr.length; right++) {

            sum = sum + arr[right];

            while(right > k){
              //  arr[left].pop();

            }
        }

        return count;
    }

    public static void main(String[] args, int k) {

        int[] arr = { 1, 2, 3, 1, 1, 1, 1 };
        int windowSize = 3;

        System.out.println()

    }

}
