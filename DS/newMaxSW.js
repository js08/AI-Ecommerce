function maxSlide(nums, k) {

    let results = [];
    let deque = [];
   // console.log("deque[0]--->", deque[0]);

    for (let i = 0; i < nums.length; i++) {

        if (deque.length > 0 && deque[0] <= i - k) {
            deque.shift();
        }

        while (deque.length > 0 && nums[deque[deque.length - 1]] < nums[i]) {
            deque.pop();

        }

        deque.push(i);

        if (i >= k-1) {

            results.push(nums[deque[0]]);
        }

    }

    return results;


}

console.log(maxSlide([500, 10, 20, 30, 70, 80, 100, 120, 140], 3))