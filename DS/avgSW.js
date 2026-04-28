// 3. Average of All Subarrays of Size K
// Problem Statement:
// Given an array of integers and an integer K, compute the average value of each contiguous subarray of size K. Return all the averages in the order in which the subarrays appear.
// Input:
// Array = [1, 3, 2, 6, -1, 4, 1, 8, 2]
// K = 5
// Output:
// [2.2, 2.8, 2.4, 3.6, 2.8]

function avgSW(arr, k) {
    const n = arr.length;
    if (k > n) {
        return null;
    }
    let windowAverge = 0;
    let windowSum = 0;
    const result = new Array();

    for (let i = 0; i < k; i++) {
        windowSum = windowSum + arr[i];
        //  console.log('windowAvg--->', windowSum);
                console.log('inside first  if before updating  windowSum --->', windowSum);

    }

    windowAverge = windowSum / k;
    //  console.log('windowAverge--->', windowAverge);
    result.push(windowAverge);

    // slide the window

    for (let i = k; i < n; i++) {
        // console.log('k slide --->', k);
        console.log('i slide --->', i);
        console.log(' arr[i] --->', arr[i]);
        console.log('inside second if before updating  windowSum --->', windowSum);


        windowSum = windowSum + arr[i]; // add next element

        console.log('inside second if after updating  windowSum --->', windowSum);

        console.log('i-k slide --->', i - k);
        console.log(' arr[i - k] --->', arr[i - k]);

        windowSum = windowSum - arr[i - k]; // add element going out
        console.log(' windowSum --->', windowSum);

        windowAverge = windowSum / k;
        result.push(windowAverge);


    }



    return result;



}

//console.log(avgSW([1, 3, 2, 6, -1, 4, 1, 8, 2], 3));


console.log(avgSW([10, 20, 30, 40, 50, 60, 70, 80, 90], 3));

