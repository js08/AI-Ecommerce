// Devise a method to find the subarray with the minimum sum.

function minSum(arr) {
    let findAllSubArr = [];
    // let minSumSub = [];
    // let current = 0;

    let currentMin = arr[0];
    let globalMin = arr[0];

    for (let i = 1; i < arr.length; i++) {
        console.log("i ---->", i)
        currentMin = currentMin + arr[i];
        // for (let j = i; j < arr.length; j++) {
        //     console.log("j --->", j)
        //     //  findAllSubArr.push([...arr[i, j]])
        //     findAllSubArr.push(arr.slice(i, j + 1))


        // }
        //  break;
    }


    console.log("findAllSubArr ---->", findAllSubArr);
}

console.log(minSum([10, 20, 30, 40, 1]));