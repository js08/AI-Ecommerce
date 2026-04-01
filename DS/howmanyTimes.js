// Determine how many times a target element appears in a sorted array. Solve it efficiently using binary search.
// Input:
// arr = [1, 2, 2, 2, 3, 4]
// target = 2
// Output:
// 3



let arr = [1, 2, 2, 2, 3, 4];

function findBoundary(arr, target) {
    let start = 0;
    let end = arr.length - 1;
    while (start <= end) {
        //  let result = 0;
        let result = [];


        let middle = Math.floor((start + end) / 2);
        console.log('middle', middle);

        if (arr[middle] < target) {
            start = middle + 1;
        } else if (arr[middle] > target) {
            end = middle - 1;
        } else if (arr[middle] === target) {
            result.push(middle);
        }
        console.log('result', result);
        //break;
        return result.length;

    }
}

function howManyTimes(arr, target){
    let firstIndex = findBoundary(arr,target);

}

console.log(howManyTimes(arr, 2));
