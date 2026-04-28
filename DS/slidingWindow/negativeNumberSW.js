// 4. First Negative Number in Every Window of Size K
// Problem Statement:
// You are given an array of integers that may contain both positive and negative values. For every contiguous subarray (window) of size K, find the first negative integer in that window. If a particular window does not contain any negative integer, output 0 for that window.
// Input:
// Array = [12, -1, -7, 8, -15, 30, 16, 28]
// K = 3
// Output:
// [-1, -1, -7, -15, -15, 0]

function firstNegative(arr, k) {
  // Create an empty list to store our final answers for each window
  let result = []; 
  
  // Create a "waiting room" (queue) to remember the positions (indices) of negative numbers
  let queue = []; 

  // --- STEP 1: THE WARM-UP ---
  // We look at the first few numbers (but not quite a full window yet)
  for (let i = 0; i < k - 1; i++) {
    // If the person at this position is negative...
    if (arr[i] < 0) {
      // ...write down their position (index) in our memory queue
      queue.push(i);
    }
  }

  // --- STEP 2: THE SLIDING WINDOW ---
  // Now we start moving. 'i' is the right edge of our sliding window.
  for (let i = k - 1; i < arr.length; i++) {
    
    // STATION A: DISCOVER (Adding the Newcomer)
    // We just moved forward! Check the brand new number that entered the window.
    if (arr[i] < 0) {
      // If it's negative, add its position to the back of our memory queue.
      queue.push(i);
    }

    // STATION B: CLEANUP (Removing the Expired)
    // Check if the person at the front of our line is now behind the window's left edge.
    // (If window size is 3 and we are at index 3, index 0 is now too far back).
    if (queue.length > 0 && queue[0] <= i - k) {
      // If they are too far back, remove them from the front of the queue.
      queue.shift();
    }

    // STATION C: REPORT (Picking the Winner)
    // Does our memory queue have any negative numbers left for this window?
    if (queue.length > 0) {
      // Yes! The one at the very front (queue[0]) is our FIRST negative number.
      // We look up the actual value using that index and add it to our results.
      result.push(arr[queue[0]]);
    } else {
      // No! The queue is empty, so there are no negatives in this window.
      result.push(0);
    }
  }

  // Give back the final list of answers we collected
  return result;
}



