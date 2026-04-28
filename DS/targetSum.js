// Write a function to find all subarrays with a given sum.

// Scenario 1: Standard Positive Integers
// In this case, the target sum is reached by contiguous elements.

// Input Array: [1, 2, 3, 4, 5]

// Target Sum: 9

// Output: * [2, 3, 4] (Indices 1 to 3)

// [4, 5] (Indices 3 to 4)

function sumAllSubArrays(arr, tgSum) {
  let targetSum = tgSum;
  let results = [];

  for (let i = 0; i < arr.length; i++) {
    console.log('i---->', i);
    let currentSum = 0;

    for (let j = i; j < arr.length; j++) {
      console.log('j----->', j);

      //if (currentSum < targetSum) {
        currentSum = currentSum + arr[j];
        console.log('j currentSum----->', currentSum);
      //}
      if (currentSum === targetSum) {
        console.log('print sub arrays----->');
        results.push(arr.slice(i, j + 1));
      }
    }
  }

  return results;
}

console.log('here --->', sumAllSubArrays([1, 2, 3, 4, 5], 9));