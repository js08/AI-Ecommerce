import java.util.HashMap;

// javac avgSW.java
// java avgSW


public class newDistinctNumber{

    public static int distinctNumber(int[] arr, int k){

        int maxLength =0;
        int left =0;

        HashMap<Integer, Integer> counts = new HashMap<>();

        for (int right= 0; right< arr.length; right ++){

            int currentNum = arr[right];

            Integer currentCount = counts.get(currentNum);

            if(currentCount == null){
                counts.put(currentNum,1);
            }else{
                counts.put(currentNum, currentCount + 1);

            }


            while(counts.size() > k){

                int numberToExit = arr[left];

                Integer countAtLeft = counts.get(numberToExit);
                if(countAtLeft > 1){
                    counts.put(numberToExit, countAtLeft - 1 );

                }else{
                    counts.remove(numberToExit);

                }

                left = left +1;

            }

            int currentWindowSize = right-left + 1;
        if(currentWindowSize > maxLength){
            maxLength = currentWindowSize;
        }

        }

        return maxLength;


        
    }

    public static void main(String[] args){

        int[] arr ={1, 2, 1, 2, 3};
        int k =2;

        System.out.println(distinctNumber(arr, k));

    }

}