// [10, 20, 30, 40]
// [40, 30, 20, 10]

//  Elaborate a function to traverse an array in reverse order.
function traverseRev(arr) {
  let result = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    console.log('', arr[i]);
    result.push(arr[i]);
  }
  return result;
}

console.log(traverseRev([10, 20, 30, 40]));