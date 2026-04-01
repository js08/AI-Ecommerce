// Write a function to perform a binary search and return all indices of a specified value.

let arr = [10, 10, 20, 20, 40, 50, 60, 60, 60, 70, 80, 90, 100];
// function allIndices(arr, target) {
//     let start = 0;
//     let end = arr.length - 1;

//     let result = [];
//     let findFirst = false;

//     while (start <= end) {
//         let middle = Math.floor((start + end) / 2);
//         console.log('outside while if middle --->', middle); // 6
//         console.log('inside while start --->', start);
//         console.log('inside while end --->', end);

//         if (arr[middle] < target) {
//             // 60< 10
//             //   start = start + 1; // 0 + 1 = 1
//             console.log('outside while if middle --->', middle); // 6

//             start = middle + 1; // 6 + 1 = 1
//             console.log('inside if start --->', start);

//             //return result;
//         } else if (arr[middle] > target) {
//             // 60 > 10
//             console.log('inside if middle --->', middle);

//             end = middle - 1;
//             console.log('inside else if end --->', end);
//             //return result;
//         } else {
//             firstOccurence = middle;
//             // while (start <= end) {
//             if (findFirst === true) {
//                 end = middle - 1;
//             } else if (findFirst === false) {
//                 start = middle + 1;
//             }
//             result.push(middle);
//             // }
//             console.log('found target result --->', result);
//             //break;
//         }
//     }
//     console.log('inside while result --->', result.length);
//     return result;
// }
// console.log(allIndices(arr, 60));


function getBoundary(arr, target, findFirst) {
    let start = 0;
    let end = arr.length - 1;

    let result = [];
    let findFirst = false;
    let boundaryIndex = -1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        console.log('outside while if middle --->', middle); // 6
        console.log('inside while start --->', start);
        console.log('inside while end --->', end);

        if (arr[middle] < target) {
            // 60< 10
            //   start = start + 1; // 0 + 1 = 1
            console.log('outside while if middle --->', middle); // 6

            start = middle + 1; // 6 + 1 = 1
            console.log('inside if start --->', start);

            //return result;
        } else if (arr[middle] > target) {
            // 60 > 10
            console.log('inside if middle --->', middle);

            end = middle - 1;
            console.log('inside else if end --->', end);
            //return result;
        } else {
            boundaryIndex = middle;
            // while (start <= end) {
            if (findFirst) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
            //  result.push(middle);
            return boundaryIndex;
            // }
            console.log('found target result --->', result);
            //break;
        }
    }
    console.log('inside while result --->', result.length);
    return result;
}
console.log(getBoundary(arr, 60));
