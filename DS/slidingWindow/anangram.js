// Find All Anagrams in a String
//  Problem Statement
// Given two strings s and p, find all start indices of p's anagrams in s.
// An anagram contains the same characters with same frequency.
// Return a list of starting indices in any order.
// If no anagram exists, return an empty list.
// Input:
// s = "cbaebabacd", p = "abc"
// Output:
// [0, 6]


function anan(s, p) {
    const result = [];
    if (s.length < p.length) return result;

    let neededChars = new Map();
    for (let char of p) {
        neededChars.set(char, (neededChars.get(char) || 0) + 1);
    }

    let missingTypes = neededChars.size;
    let left = 0;

    // 'right' is initialized and incremented in the loop header
    for (let right = 0; right < s.length; right++) {
        let charAtRight = s[right];

        // 1. Process character entering from the right
        if (neededChars.has(charAtRight)) {
            neededChars.set(charAtRight, neededChars.get(charAtRight) - 1);
            if (neededChars.get(charAtRight) === 0) {
                missingTypes--;
            }
        }

        // 2. Process character leaving from the left
        if (right - left + 1 > p.length) {
            let charAtLeft = s[left];
            if (neededChars.has(charAtLeft)) {
                if (neededChars.get(charAtLeft) === 0) {
                    missingTypes++;
                }
                neededChars.set(charAtLeft, neededChars.get(charAtLeft) + 1);
            }
            left++; 
        }

        // 3. Match found
        if (missingTypes === 0) {
            result.push(left);
        }
    }

    return result;
}


// function anan(s, p) {
//     const result = [];
//     if (s.length < p.length) {

//         return result;

//     }
//     let neededChars = new Map();
//     // let secondCharMap = new Map();
//     // let left = 0;
//     // for (right = 0; right < p.length; right++) {

//     //     let secondCharacter = s[right];
//     //     if (secondCharMap.get(secondCharacter)) {
//     //         secondCharMap.set(secondCharacter)

//     //     }


//     //     let firstCharacter = s[left];
//     //     if (charMap.get(firstCharacter)) {
//     //         charMap.set(firstCharacter)

//     //     }

//     //     left = left + 1;



//     // }

//     for (let char of p) {
//         if (neededChars.has(char)) {

//             let currentCount = neededChars.get(char);
//             neededChars.set(char, currentCount + 1);

//         } else {
//             neededChars.set(char, 1);
//         }
//     }

//     let missingTypes = neededChars.size;

//     let left = 0;
//     let right = 0;

//     while (right < s.length) {
//         let charAtRight = s[right];
//         // console.log("charAtRight ----> ", charAtRight);


//         //  console.log("neededChars.has(charAtRight) ----> ", neededChars.has(charAtRight));

//         if (neededChars.has(charAtRight)) {
//             let currentNeeded = neededChars.get(charAtRight);
//             //  console.log("currentNeeded ---->", currentNeeded);

//             neededChars.set(charAtRight, currentNeeded - 1);
//             console.log("/////////////////////////// ---->", );
//             console.log("after set neededChars.get(charAtRight) ---->", neededChars.get(charAtRight));
//             console.log("/////////////////////////// ---->", );


//             if (neededChars.get(charAtRight) === 0) {
//                 missingTypes = missingTypes - 1;
//                 //  console.log("missingTypes ---->", missingTypes);
//             }


//         }

//         if (right - left + 1 > p.length) {

//             let charAtLeft = s[left];

//             if (neededChars.has(charAtLeft) === 0) {
//                 missingTypes = missingTypes + 1;

//                 // Increase the frequency requirement back since it's leaving the window
//                 neededChars.set(charAtLeft, neededChars.get(charAtLeft) + 1);
//             }

//             left = left + 1;

//         }

//         // If missingTypes is 0, all character requirements are met; we found an anagram
//         if (missingTypes === 0) {
//             result.push(left);
//         }

//         right = right + 1;
//     }

//     return result;

// }

console.log("final", anan("cbaebabacd", "abc"))



// function findAnagramsInStr(s, p){

//     p = p.split("").sort().join("");

//     let size = p.length;
//     let result = [];

//     for(let left = 0; left <= s.length - size; left++){

//         let newStr = s.slice(left, left + size);

//         newStr = newStr.split("").sort().join("");

//         if(newStr === p){
//             result.push(left);
//         }
//     }

//     return result;
// }