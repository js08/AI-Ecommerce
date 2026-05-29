const arr = [1, , 11, 2, 2, 3, 3, 41, 4, 1, 2, 3, 3, 2];

const sortedArr = arr.filter(el => el !== undefined).sort((a, b) => a - b);

let currentCount = 1;

for (let i = 1; i < sortedArr.length; i++) {

    if (sortedArr[i] === sortedArr[i - 1]) {
        currentCount = currentCount + 1;
    } else {
        console.log(`Element: ${sortedArr[i-1]} -> Frequency: ${currentCount}`);

        currentCount = 1;
    }

}

if(sortedArr.length > 0){

    
}