// Q3. Remove all occurrences of a given element

// Problem Statement:
// Given an integer array and a value, remove all occurrences of that value in-place and return the new length.

// Input:
// arr = [3, 2, 2, 3], val = 3

// Output:
// 2

function removeAllOcc(arr, k) {
    let writer = 0;
    // let maxLength = 0;
    // let count = 0;

    for (let reader = 0; reader < arr.length; reader++) {
        console.log("reader---->", arr[reader]);
        console.log("outside if arr[writer]---->", arr[writer]);
        if (arr[reader] !== k) {
            // count = count + 1;
            // leftP = leftP + 1;
            console.log("inside if arr[reader]---->", arr[reader]);

            arr[writer] = arr[reader];
            console.log("inside if arr[writer]---->", arr[writer]);
            console.log("///////////////////////", );
            writer = writer + 1;
        }

    }

    return writer;

}

console.log("remov---->", removeAllOcc([3, 2, 2, 3], 3));