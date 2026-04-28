// Problem

// Given an integer array nums and an integer k, return the length of the longest subarray that contains at most k distinct numbers.

// nums = [1, 2, 1, 2, 3]
// k = 2

// output : 4



function distinctNumber(arr, k) {
    let maxLength = 0;
    let left = 0;
    const counts = new Map(); // Keep track of numbers in our window

    for (let right = 0; right < arr.length; right++) {
        let currentNum = arr[right];

        // 1. Add the current number to our count
        counts.set(currentNum, (counts.get(currentNum) || 0) + 1);

        // 2. If we have too many distinct numbers, shrink from the left
        while (counts.size > k) {
            let numberToExit = arr[left];
            counts.set(numberToExit, counts.get(numberToExit) - 1);

            // If a number's count hits 0, it's no longer in the window
            if (counts.get(numberToExit) === 0) {
                counts.delete(numberToExit);
            }
            left++; // Move left side of window forward
        }

        // 3. Update the maximum length found so far
        // The length of the window is (right - left + 1)
        maxLength = Math.max(maxLength, right - left + 1);
    }

    return maxLength;
}

console.log(distinctNumber([1, 2, 1, 2, 3], 2)); // Output: 4