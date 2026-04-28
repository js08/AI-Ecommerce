function lsMatch(arr, target) {
  let result = [];

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) {
      result.push(i);
    }
  }

  return result;
}
console.log(
  lsMatch(['Apple', 'Banana', 'Orange', 'Apple', 'Grape', 'Apple'], 'Apple')
);
