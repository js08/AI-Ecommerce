function twoPointSum(arr, target) {
    let left = 0;
    let right = arr.length;
    let sum = 0;

    for (let i = 0; i < arr.length; i++) {
        sum = sum + arr[i];

        if (sum > target) {
            right = right - 1;

        } else if (sum < target) {
            left = left - 1;
        } else {
            return sum;
        }



    }



}

console.log(twoPointSum([1, 2, 3, 4, 7], 6));



// function findPairEqualToTarget(arr, target){
//     let left = 0;
//     let right = arr.length-1
//     let result = []
//     while(left<right){
//         let sum = arr[left] + arr[right];
//         if(sum>target){
//             right--
//         }
//         else if(sum<target){
//             left++
//         }
//         else{
//             result.push([arr[left], arr[right]])
//             left++;
//             right--
//         }
//     }
//     return result;
// }
// arr = [1,2,3,4,5]
// console.log(findPairEqualToTarget(arr, 5))