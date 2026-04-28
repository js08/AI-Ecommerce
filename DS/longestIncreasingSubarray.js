// Define a function that takes an array of numbers as 'arr'
function longestSubarr(arr) {
    // 1. Safety check: If the input list is totally empty, stop and return an empty list []
    if (arr.length === 0) return [];

    // 2. Start our "current" streak with the very first number from the array
    let current = [arr[0]];

    // 3. Create an empty "longest" list to keep track of the best streak we've found so far
    let longest = [];

    // 4. Start a loop beginning at the second number (index 1) and go to the end of the array
    for (let i = 1; i < arr.length; i++) {
        
        // 5. Check: Is the current number BIGGER than the number that came right before it?
        if (arr[i] > arr[i - 1]) {
            // 6. If it's bigger, the streak is still alive! Add the current number to our 'current' list
            current.push(arr[i]);
        } else {
            // 7. If it's NOT bigger, the streak broke. Let's see if this streak was a winner.
            // Check: Is our finished streak longer than the best one we have saved in 'longest'?
            if (current.length > longest.length) {
                // 8. If yes, take a "photocopy" of 'current' and save it as our new 'longest'
                longest = [...current];
            }

            // 9. Now, start a brand new 'current' streak beginning with this current number
            current = [arr[i]];
        }
    }

    // 10. Final Check: After the loop ends, we might still have a streak in 'current' 
    // that never got compared (this happens if the array ends while going uphill).
    if (current.length > longest.length) {
        // 11. If that final streak is the best one, save it as 'longest'
        longest = [...current];
    }

    // 12. Finally, give back the champion streak we found!
    return longest;
}

// Run the function with our test numbers and print the result to the console
console.log(longestSubarr([1, 3, 5, 4, 7, 10, 11, 2]));