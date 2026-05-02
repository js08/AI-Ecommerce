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

/**
 * analyticsService.js
 * Logic to find windows with an even sum.
 */
const getEvenSumWindows = (laps, k) => {
  // 1. Transform the array of lap objects into an array of just numbers
  // This is like the .stream().mapToInt() in Java
//   const arr = laps.map(lap => lap.durationMs);

const arr = laps.map(lap => {
    const rawLap = lap.get ? lap.get({ plain: true }) : lap;
    return rawLap.durationMs;
  });
  
  console.log("Raw Numbers for Math:", arr); // Check if this is [1000, 1200...] or [undefined, undefined...]

  const results = []; // This will hold our "WindowResult" objects
  let currentSum = 0;

  // 2. Sliding Window Loop
  for (let right = 0; right < arr.length; right++) {
    currentSum += arr[right];

    // 3. If window size exceeds K, subtract the leftmost element
    if (right >= k) {
      currentSum -= arr[right - k];
    }

    // 4. Once we have a full window of size K
    if (right >= k - 1) {
      // Check if the sum is even using Modulo
      if (currentSum % 2 === 0) {
        // 5. Capture the window elements
        // .slice(start, end) creates the "snapshot" like Java's subList
        const windowElements = arr.slice(right - k + 1, right + 1);

        // 6. Push a new object into the results array
        // (This replaces the 'new WindowResult()' part of Java)
        results.push({
          elements: windowElements,
          totalSum: currentSum
        });
      }
    }
  }

  return results;
};

// module.exports = { getEvenSumWindows };

// Export the function so it can be imported by the LapController
module.exports = {
 // countWorkoutPatterns,
  getEvenSumWindows
};