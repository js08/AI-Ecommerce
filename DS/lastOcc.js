//Write a function to perform a linear search and return the index of the last occurrence of a value.

let arr = [4, 2, 7, 2, 2];
function linearSearchLatsOcc(arr, target) {

  //  for (let i = 0; i < arr.length; i++) {

  for (let i = arr.length - 1; i >= 0; i--) {


    console.log('inside for i --->', i);
    // break;

    if (arr[i] === target) {
      console.log('inside if i --->', i);
      return i
    }
  }

  return -1;
}

console.log('result console  --->', linearSearchLatsOcc([4, 2, 7, 2, 2], 900));