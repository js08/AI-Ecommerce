function maxWindowSliding(nums, k) {
  // --- EDGE CASE HANDLERS ---

  // 1. Check if input is valid
  if (!nums || nums.length === 0 || k <= 0) {
    return [];
  }

  // 2. If window size k is 1, every element is its own maximum
  if (k === 1) {
    return nums;
  }

  // 3. If k is larger than the array, the max is simply the max of the whole array
  if (k > nums.length) {
    return [Math.max(...nums)];
  }

  // --- CORE LOGIC ---
  let results = [];
  let deque = [];

  for (let i = 0; i < nums.length; i++) {
    // Remove indices that have fallen out of the window
    if (deque.length > 0 && deque[0] <= i - k) {
      deque.shift();
    }

    // Maintain monotonic property (keep deque sorted descending)
    while (deque.length > 0 && nums[deque[deque.length - 1]] <= nums[i]) {
      deque.pop();
    }

    deque.push(i);

    // Start recording results once the first window is full
    if (i >= k - 1) {
      results.push(nums[deque[0]]);
    }
  }

  return results;
}


console.log(maxWindowSliding([10, 20, 30, 40, 50, 60], 3));
