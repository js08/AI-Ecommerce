//Construct a procedure to find the smallest element greater than or equal to a given value using binary search.

let arr = [20, 40, 60, 70, 80, 90, 110, 120, 130];

function smallesElementGreater(arr, target) {
    let start = 0;
    let end = arr.length - 1;
    console.log('outside whilestart --->', start);
    console.log('outside end --->', end);
    let result = -1;
    while (start <= end) {
        let mid = Math.floor((start + end) / 2);
        console.log('mid --->', mid);

        if (arr[mid] < target) {
            start = mid + 1;
            console.log('less start --->', start);

        } else if (arr[mid] > target) {

            result = arr[mid];
            end = mid - 1;
            console.log('greater end --->', end);

        } else {
            console.log("arr[mid]  inside else -->", arr[mid]);
            //result = result + 1;
            result = arr[mid];
            return result;
        }
        // break;
    }
    console.log('result --->', result);
    return result;
}

console.log(
    'smallesElementGreater --->',
    smallesElementGreater([20, 40, 60, 70, 80, 90, 110, 120, 130], 140)
);
