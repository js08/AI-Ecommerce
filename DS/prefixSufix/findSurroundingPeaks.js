function findSurroundingPeaks(cpuMetrics) {
    const n = cpuMetrics.length;
    console.log("n ----->", n);
    if (n == 0) {
        return [];
    }

    const prefMax = new Array(n).fill(0);
    const suffMax = new Array(n).fill(0);
    console.log("prefMax ----->", prefMax);
    console.log("suffMax ----->", suffMax);

    const result = new Array(n);

    prefMax[0] = 0;

    for (let i = 1; i < n; i++) {

        console.log("prefMax[i-1] ----->", prefMax[i - 1]);
        console.log("prefMaxcpuMetrics[i-1] ----->", cpuMetrics[i - 1]);
        prefMax[i] = Math.max(prefMax[i - 1], cpuMetrics[i - 1]);
        console.log("prefMax[i] ----->", prefMax[i]);


    }

    console.log("///////////////////////////////////");

    suffMax[n - 1] = 0;


    for (let i = n - 2; i >= 0; i--) {

        console.log("suffMax[i+1] ----->", suffMax[i + 1]);
        console.log("suffMax cpuMetrics[i+1] ----->", cpuMetrics[i + 1]);

        suffMax[i] = Math.max(suffMax[i + 1], cpuMetrics[i + 1]);

        console.log("suffMax[i] ----->", suffMax[i]);


    }

    for (let i = 0; i < n; i++) {

        result[i] = {

            maxBefore: prefMax[i],
            maxAfter: suffMax[i]

        };

    }

    return result;




}

const cpuMetrics = [40, 85, 35, 90, 50];
console.log(findSurroundingPeaks(cpuMetrics));