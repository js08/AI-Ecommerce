// 6. Count Subarrays of Size K with Sum Equal to X
// Problem Statement:
// You are given an array of integers, an integer K, and a target value X. Count the number of contiguous subarrays of size exactly K whose elements add up to X.
// Input:
// Array = [1, 2, 3, 1, 1, 1, 1]
// K = 3
// X = 6
// Output:
// 2



function sumSubArray(arr, k, x) {

    let left = 0;


    let currentSum = 0;
    let count = 0;

    for (let right = 0; right < arr.length; right++) {

        currentSum = currentSum + arr[right];



        if (right >= k) {
            currentSum = currentSum - arr[left];


            left = left + 1;

        }

        if (right >= k - 1) {
            if (currentSum === x) {
                count++;
            }
        }
    }

    return count;


}

console.log(sumSubArray([1, 2, 3, 1, 1, 1, 1], 3, 6));