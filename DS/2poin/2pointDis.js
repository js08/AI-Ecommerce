// // Problem Statement
// // Given a sorted array of integers, remove the duplicate elements in-place such that each element appears only once and return the new length of the array.
// // Do not use extra space for another array.

// // Input
// // arr = [1, 1, 2, 2, 3, 4, 4]

// // Output
// // New Length = 4
// // Modified Array = [1, 2, 3, 4]

// // Explanation
// // Original array:
// // [1, 1, 2, 2, 3, 4, 4]

// // After removing duplicates:
// // [1, 2, 3, 4]
// // New length = 4


// function twoPointDis(arr){

//     let left =0;
//     let right = 0;
//     let result = [];

//     for(let i= 0; i< arr.length; i++){

//         if(arr[left] == arr[right]){
//             right= right + 1;

//         }
//         else if(arr[left] != arr[right]){
//             left = left + 1;
//             result.push(arr[left]);
//             right = right + 1;
//         }


//     }

//     return result;

// }

// console.log("result push--->",twoPointDis( [1,1,1,2,2,2,4,4,5]));


function removeDuplicates(arr) {
  if (arr.length === 0) return 0;

  let i = 0;  // pointer for unique elements

  for (let j = 1; j < arr.length; j++) {
    if (arr[j] !== arr[i]) {
      i++;
      arr[i] = arr[j];
    }
  }

  return i + 1; // new length
}


console.log("result push--->",removeDuplicates( [1,1,1,2,2,2,4,4,5]));
