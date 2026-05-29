// Q4. Find the longest substring without repeating characters

// Problem Statement:
// Given a string, find the length of the longest substring that contains no repeating characters.

// Input:
// s = "abcabcbb"

// Output:
// 3

function lengthOfLongestSubstring(s) {
    let charMap = new Map();

    let left = 0;
    let maxLength = 0;

    for (let right = 0; right < s.length; right++) {

        console.log("s[right] --->", s[right]);

        let currentChar = s[right];


        console.log("charMap.has(currentChar) --->", charMap.has(currentChar));

        console.log("charMap.get(currentChar) --->", charMap.get(currentChar));

        if (charMap.has(currentChar) && charMap.get(currentChar) >= left) {

            left = charMap.get(currentChar) + 1;
            console.log("left --->", left);

        }

        console.log("charMap.set(currentChar, right) --->", charMap.set(currentChar, right));


        charMap.set(currentChar, right);


    }

}

console.log(lengthOfLongestSubstring("abcabcbb"));