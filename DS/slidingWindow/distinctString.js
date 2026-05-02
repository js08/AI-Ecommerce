// 18. Minimum Window Substring

// Problem Statement:
// You are given two strings s and t. Find the smallest substring of s that contains all the characters of string t, including their frequencies.
// Input:

// s = "ADOBECODEBANC"

// t = "ABC"

// Output:

// "BANC"

function smallestSubstringWithKDistinct(str, t) {
    let smallesLength = 0;
    let left = 0;

    let targetMap = new Map();
    let required;
    let formed;

    for (let i = 0; i < t.length; i++) {

        let char = t[i];
        

        if (targetMap.has(char)) {
            let currentCount = targetMap.get(char);
            console.log("currentCount ---->", currentCount);
        } else {
            console.log("inside else  ---->", char);

            targetMap.set(char, 1)
        }

     }

    // for (let right = 0; right < str.length; right++) {

    //     let currentStr = str[right];
    //     targetMap.set(currentStr);

    //     while (formed === required) {

    //         left = left + 1;

    //     }





    // }

}

console.log("final result--->", smallestSubstringWithKDistinct("ADOBECODEBANC", "t"));