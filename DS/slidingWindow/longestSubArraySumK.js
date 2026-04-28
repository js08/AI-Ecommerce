function longestSubArraySumK(arr, k) {
    // These are our 'bookmarks'. 
    // Left keeps track of the start of our window, maxLen remembers our best record.
    let left = 0;
    let sum = 0;
    let maxLen = 0;

    // The 'right' pointer is like a scout, expanding our window to the right one step at a time.
    for (let right = 0; right < arr.length; right++) {
        
        // 1. ADD: We include the new number into our current sum.
        sum = sum + arr[right];

        // 2. CHECK & SHRINK: If the sum is too big, the window is "broken."
        // We use a 'while' loop because we might need to remove multiple 
        // numbers from the left to get back under the limit 'k'.
        while (sum > k) {
            sum = sum - arr[left]; // Remove the number at the left pointer from our sum
            left = left + 1;       // Slide the left side of the window inward
        }

        // 3. RECORD: Now that the window is valid (sum <= k), we measure it.
        // 'right - left + 1' is the formula for the number of elements in the window.
        // We only keep the biggest number we've seen so far.
        maxLen = Math.max(maxLen, right - left + 1);
    }

    // After the scout (right) finishes the array, we return our best record.
    return maxLen;
}