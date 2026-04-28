/**
 * Sliding Window Algorithm
 * This function finds how many groups of 'k' laps add up to 'x'.
 * * @param {Array} laps - An array of integers (e.g., [1000, 2000, 3000])
 * @param {Number} k - The size of the window (number of contiguous laps)
 * @param {Number} x - The target sum we are looking for
 */
const countWorkoutPatterns = (laps, k, x) => {
  // 1. Initialize variables
  let left = 0;         // The trailing edge of our window
  let currentSum = 0;   // The running total of the current window
  let count = 0;        // The number of matches found

  // 2. Loop through the array using 'right' as the leading edge
  for (let right = 0; right < laps.length; right++) {
    
    // 3. Add the newest lap on the right to our running total
    currentSum += laps[right];

    /**
     * 4. SHRINK THE WINDOW
     * If our window has grown larger than size 'k', we must 
     * remove the element at the 'left' index to keep the window at size 'k'.
     */
    if (right >= k) {
      currentSum -= laps[left]; // Subtract the oldest lap
      left++;                    // Move the left boundary forward
    }

    /**
     * 5. CHECK THE TARGET
     * Once our window has reached the full size of 'k' (at index k-1),
     * we check if the sum matches our target value 'x'.
     */
    if (right >= k - 1) {
      if (currentSum === x) {
        count++; // We found a matching pattern!
      }
    }
  }

  // 6. Return the final result to the controller
  return count;
};

// Export the function so it can be imported by the LapController
module.exports = {
  countWorkoutPatterns
};