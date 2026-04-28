// Develop a function to perform a linear search for a range of values in an array.

// Input Array	[12, 5, 8, 20, 15, 3, 30]
// Search Range	Min: 7, Max: 16
// Expected Output	[0, 2, 4] (Indices of 12, 8, and 15)

function lsRange(arr) {
  let min = 7;
  let max = 16;
  let result = [];

  for (let i = 0; i < arr.length; i++) {
    console.log('before if result.push(arr[i]);', result.push(arr[i]));

    if (arr[i] > min && arr[i] < max) {
      result.push(arr[i]);
      console.log('result.push(arr[i]);', result.push(arr[i]));
    }
  }

  return result;
}

console.log(lsRange([12, 5, 8, 20, 15, 3, 30]));