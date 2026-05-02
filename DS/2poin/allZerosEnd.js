// Q2. Move all zeros to the end

// Problem Statement:
// Given an integer array, move all zeros to the end while maintaining the relative order of non-zero elements.

// Input:
// arr = [0, 1, 0, 3, 12]

// Output:
// [1, 3, 12, 0, 0]

function allZeroToEnd(arr) {
    let lP = 0;
    // let secondPoint = 1

    for (let rP = 0; rP < arr.length; rP++) {

        if (arr[rP] === 0) {
            rP = rP + 1;
        }

        if (arr[rP] !== 0) {
            arr[lP] = arr[rP];
        }
        // if (arr[lP] !== 0) {

        //     arr[rP] = arr[lP];

        //     lP = lP + 1;
        //   //  rP = rP + 1;


        // } else if (arr[lP] === 0 && arr[rP] === 0) {

        //     lP = lP + 1;
        //    // rP = rP + 1;


        // }

    }

    return arr;

}

console.log("result --->", allZeroToEnd([0, 1, 0, 3, 12]));