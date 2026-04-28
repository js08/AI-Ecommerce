// Design an algorithm to find the second largest element in an array using linear search.

// Input: [12, 35, 1, 10, 34, 1]

// Output: 34

// Explanation: The largest is 35. The next value down is 34.

function secondLarget(arr, target) {
    //let arr = [12, 35, 1, 10, 34, 1];
    let result = 0;
    for (let i = 0; i < arr.length; i++) {
        console.log('oustide if second Largets arr[i]--->', arr[i]);

        console.log('outside ifsecond Largets arr[i+1]--->', arr[i + 1]);
        if (arr[i] > arr[i + 1]) {
            console.log('second Largets arr[i]--->', arr[i]);

            console.log('second Largets arr[i+1]--->', arr[i + 1]);
        }
    }
}
console.log('second Largets--->', secondLarget([12, 35, 1, 10, 34, 1]));