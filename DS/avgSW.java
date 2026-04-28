import java.util.ArrayList;

// javac avgSW.java
// java avgSW

public class avgSW {

    // public static void calculateAvg(int[] arr, int k) {
    public static ArrayList<Double> calculateAvg(int[] arr, int k) {

        int n = arr.length;
        System.out.println("testing --->" + n);

        if (k > n) {
            return null;
        }
        double windowAverage = 0.0;
        double windowSum = 0.0;
        ArrayList<Double> result = new ArrayList<>();

        for (int i = 0; i < k; i++) {
            windowSum = windowSum + arr[i];
        }

        windowAverage = windowSum / k;
        System.out.println("windowAverage" + windowAverage);
        result.add(windowAverage);

        for (int i = k; i < n; i++) {
            // console.log('k slide --->', k);
            // System.out.println('i slide --->', i);
            // System.out.println(' arr[i] --->', arr[i]);
            // System.out.println('inside second if before updating windowSum --->',
            // windowSum);

            windowSum = windowSum + arr[i]; // add next element

            // System.out.println('inside second if after updating windowSum --->',
            // windowSum);

            // System.out.println('i-k slide --->', i - k);
            // System.out.println(' arr[i - k] --->', arr[i - k]);

            windowSum = windowSum - arr[i - k]; // add element going out
            // System.out.println(' windowSum --->', windowSum);

            windowAverage = windowSum / k;
            result.add(windowAverage);

        }

        return result;

    }

    public static void main(String[] args) {
        int[] myNumbers = { 10, 20, 30, 40, 50, 60, 70, 80, 90 };
        int kValue = 3;

        ArrayList<Double> finalAverages = calculateAvg(myNumbers, kValue);
        System.out.println("Fianl Av" + finalAverages);
    }

}
