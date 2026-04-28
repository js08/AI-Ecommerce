// You are given an array of integers and an integer K. Determine the minimum possible sum among all contiguous subarrays of size exactly K.
// Input:
// Array = [4, 2, 1, 7, 8, 1, 2, 8, 1, 0]
// K = 3
// Output:


function minSumSubArray(arr, k) {
    let windowSum = 0;
    for (let i = 0; i < k; i++) {
        windowSum = windowSum + arr[i];
    }

    console.log('windowSum', windowSum);
    let minSum = windowSum;

    // --- STEP 2: SLIDING THE WINDOW ---
    // We start the loop at index 'k' (which is 3) and move to the end.
    for (let i = k; i < arr.length; i++) {
        windowSum = windowSum + arr[i];
        windowSum = windowSum - arr[i - k];
        minSum = Math.min(minSum, windowSum);
        // [arr, k]]

        // call and get the output
        // give me an Object
        // {country:



        //     univ{

        //     }
        //     place
        //     populate the value

        // }
        // univ, india all the universities at india// input will be countrt
        // universities
        // top universities
        // rank
        // r
        // copilot 
        // spring bean life cycles
        // thread questions
        // executor framework
        // how hash map is implemented in java
        // in local
        // spring security
        // how will you secure the services
        // kafka ques
        // more consumers than the partitions
        // how did you acheive paraallelism in your project
        // spring boot life c
        // transactions
        // difference between sns ans sqs
        // aws lambda
        // what version of java
       //  difference between java 8 and java 11


    }

    return minSum;


}

console.log(minSumSubArray([4, 2, 1, 7, 8, 1, 2, 8, 1, 0], 3));