// 5. Longest Subarray with At Most K Zeroes

// Problem:
// Given a binary array nums (containing only 0s and 1s) and an integer k, return the length of the longest subarray containing at most k zeroes.

// Input:
// nums = [1,1,1,0,0,0,1,1,1,1,0], k = 2

// Output:
// 6




function longestSubArray(arr, k) {

    let count = 0;
    let resultLength = 0;
    let left = 0;
    for (let right = 0; right < arr.length; right++) {

        if (arr[right] === 0) {
            count = count + 1;

        }

        while (count > k) {
            if (arr[left] === 0) {
                count = count - 1;
            }

            left = left + 1;
        }

        resultLength = Math.max(resultLength, right - left + 1);

    }

    return resultLength;

}

console.log(longestSubArray([1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], 2));