// // using sliding window is it possible to calculate max and min of a subarray

function maxMinSubArray(arr, k) {
  // let maxElement = 0;
  // let minElement = 0;

  // We store INDICES in these arrays, not the actual numbers.
  // This helps us know if a number has "expired" and left the window.

  let maxDeque = [];
  let minDeque = [];
  let results = [];
  // let firstElement= 0

  for (let i = 0; i < arr.length; i++) {


    if (maxDeque.length > 0 && maxDeque[0] <= i - k) {
      maxDeque.shift();
    }

    if (minDeque.length > 0 && minDeque[0] <= i - k) {
      minDeque.shift();
    }


    while (maxDeque.length > 0 && arr[maxDeque[maxDeque.length - 1]] < arr[i]) {
      //

      maxDeque.pop();
    }
    maxDeque.push(i);

    if (i >= k - 1) {
      // results.push({arr[]});
      results.push(arr[maxDeque[0]]);


    }




  }

  return results;


}



console.log(maxMinSubArray([10, -1, 20, 40, 50, -2], 3));

// function maxMinSubArray(arr, k) {
//   // We store INDICES in these arrays, not the actual numbers.
//   // This helps us know if a number has "expired" and left the window.
//   let maxDeque = [];
//   let minDeque = [];
//   let results = [];

//   for (let i = 0; i < arr.length; i++) {
//     // --- STEP 1: REMOVE OUTDATED ELEMENTS ---
//     // If the index at the front of the list is too old for the window, remove it.
//     // Example: If i=3 and k=3, the index 0 is no longer in the window [1, 2, 3].
//     if (maxDeque.length > 0 && maxDeque[0] <= i - k) {
//       maxDeque.shift();
//     }
//     if (minDeque.length > 0 && minDeque[0] <= i - k) {
//       minDeque.shift();
//     }

//     // --- STEP 2: MAINTAIN THE "VIP LIST" (MAX) ---
//     // Before adding the new element, kick out anyone smaller than it from the back.
//     // Why? Because as long as this new bigger element is here, the smaller ones
//     // can never be the maximum!
//     while (maxDeque.length > 0 && arr[maxDeque[maxDeque.length - 1]] <= arr[i]) {
//       maxDeque.pop();
//     }
//     maxDeque.push(i);

//     // --- STEP 3: MAINTAIN THE "VIP LIST" (MIN) ---
//     // Kick out anyone larger than the new element from the back.
//     // The smallest element will always stay at the front.
//     while (minDeque.length > 0 && arr[minDeque[minDeque.length - 1]] >= arr[i]) {
//       minDeque.pop();
//     }
//     minDeque.push(i);

//     // --- STEP 4: RECORD THE WINNERS ---
//     // We only start recording once our window has reached size 'k'.
//     if (i >= k - 1) {
//       results.push({
//         window: arr.slice(i - k + 1, i + 1),
//         max: arr[maxDeque[0]], // The front of the deque is the current Max
//         min: arr[minDeque[0]]  // The front of the deque is the current Min
//       });
//     }
//   }

//   return results;
// }

// // Test it!
// const output = maxMinSubArray([10, -1, 20, 40, 50, -2], 3);
// console.table(output);
