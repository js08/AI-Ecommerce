// 15. Longest Substring Without Repeating Characters

// Problem Statement:
// Given a string, determine the length of the longest substring that does not contain any repeated characters.

// Input:

// String = "abcabcbb"

// Output:

// 3

function longestSubString(str) {
    let maxLength = 0;
    let charSet = new Set();
    let left = 0;

    for (let right = 0; right < str.length; right++) {
        while (charSet.has(str[right])) {
            charSet.delete(str[left]);
            left = left + 1;

        }

        charSet.add(str[right]);

       // let currentWindowSize = right -left + 1;
       // max

               maxLength = Math.max(maxLength, right - left + 1)






    }

    

}

console.log(longestSubString('abcabcbb'));