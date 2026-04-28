// Problem

// Given an integer array nums and an integer k, return the length of the longest subarray that contains at most k distinct numbers.

// nums = [1, 2, 1, 2, 3]
// k = 2

// output : 4



// we added one item to the map, but still why second time also currentCount shows undefined, can you explain like you explain to a beginner

// currentCount---> undefined
// inside if counts.set(currentNum,1)---> Map(1) { 1 => 1 }
// currentCount---> undefined
// inside if counts.set(currentNum,1)---> Map(2) { 1 => 1, 2 => 1 }
// currentCount---> 1
// inside else counts.set(currentNum, currentCount + 1)---> Map(2) { 1 => 2, 2 => 1 }
// currentCount---> 1
// inside else counts.set(currentNum, currentCount + 1)---> Map(2) { 1 => 2, 2 => 2 }
// currentCount---> undefined
// inside if counts.set(currentNum,1)---> Map(3) { 1 => 2, 2 => 2, 3 => 1 }

function newDistinctNumber(arr, K){

    let maxLength = 0;
    let left=0;
    let counts = new Map();

    for(let right = 0; right< arr.length; right++){
        let currentNum = arr[right];

        let currentCount = counts.get(currentNum);

        console.log("currentCount--->", currentCount);

        if(currentCount == undefined){
            console.log("inside if currentNum--->", currentNum);
            counts.set(currentNum,1);
            console.log("inside if counts.set(currentNum,1)--->", counts.set(currentNum,1));

        }else{
            console.log("inside else currentNum--->", currentNum , "=>", currentCount + 1 );

            counts.set(currentNum, currentCount + 1);
            console.log("inside else counts.set(currentNum, currentCount + 1)--->", counts.set(currentNum, currentCount + 1));

        }

        console.log("counts.size --->", counts.size);

        while(counts.size > K){
            let numberToExit = arr[left];

            let currentCount = counts.get(numberToExit);
                    console.log("inside while currentCount --->", currentCount);

            if(currentCount >1){
                counts.set(numberToExit,  currentCount - 1 );

            }
            else{
                counts.delete(numberToExit);

            }



            left = left + 1;

        }

        let currentWindowSize = right-left + 1;
        if(currentWindowSize > maxLength){
            maxLength = currentWindowSize;
        }

    }

    return maxLength;


}

console.log(newDistinctNumber([1, 2, 1, 2, 3],2));


